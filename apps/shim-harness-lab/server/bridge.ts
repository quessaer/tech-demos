import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"

import { planTurn } from "../src/harness/plan.ts"
import { prepareRun } from "../src/harness/prepare.ts"
import { traceFromSession, type SessionLine } from "../src/harness/session.ts"
import { composeSkill } from "../src/harness/skills.ts"
import {
  buildShimConfig,
  SHIM_VERSION,
  shimAsset,
  shimDownloadUrl,
} from "../src/harness/shim-config.ts"
import { NOTES } from "../src/harness/tools.ts"
import { SHIM_LABEL, type ModelMessage, type RunRequest, type Trace } from "../src/harness/types.ts"
import { upstreamFor } from "../src/harness/upstream.ts"

type OpenAIMessage = {
  role?: string
  content?: unknown
  tool_call_id?: string
  tool_calls?: {
    id?: string
    function?: { name?: string; arguments?: string }
  }[]
}

function fromOpenAI(messages: OpenAIMessage[]): ModelMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: (message.role as ModelMessage["role"]) ?? "user",
      content: typeof message.content === "string" ? message.content : "",
      tool_call_id: message.tool_call_id,
      tool_calls: message.tool_calls?.map((call) => ({
        id: call.id ?? "call",
        name: call.function?.name ?? "tool",
        arguments: parseArguments(call.function?.arguments),
      })),
    }))
}

function parseArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function startMockModel(input: {
  task: string
  skills: ReturnType<typeof prepareRun>["skills"]
  tool: RunRequest["tool"]
}): Promise<{ baseUrl: string; close: () => void }> {
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })
    request.on("end", () => {
      let payload: { messages?: OpenAIMessage[] } = {}
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { messages?: OpenAIMessage[] }
      } catch {
        payload = {}
      }
      const turn = planTurn({
        task: input.task,
        skills: input.skills,
        tool: input.tool,
        messages: fromOpenAI(payload.messages ?? []),
      })
      const message =
        turn.type === "answer"
          ? { role: "assistant", content: turn.text }
          : {
              role: "assistant",
              content: "",
              tool_calls: turn.calls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            }
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify({ choices: [{ message }] }))
    })
  })
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = address && typeof address === "object" ? address.port : 0
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        close: () => server.close(),
      })
    })
  })
}

export async function ensureShimBinary(appRoot: string): Promise<string> {
  const asset = shimAsset(process.platform, process.arch)
  if (!asset) {
    throw new Error("The real Shim CLI in this lab runs on Linux x64 or arm64.")
  }
  const directory = path.join(appRoot, ".shim-bin")
  const dest = path.join(directory, "shim")
  if (fs.existsSync(dest)) return dest
  const response = await fetch(shimDownloadUrl(asset))
  if (!response.ok) throw new Error(`Could not download Shim v${SHIM_VERSION} (${response.status}).`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const hash = crypto.createHash("sha256").update(bytes).digest("hex")
  if (hash !== asset.sha256) throw new Error("The Shim download checksum did not match the v0.1.0 release.")
  fs.mkdirSync(directory, { recursive: true })
  const archive = path.join(directory, asset.file)
  fs.writeFileSync(archive, bytes)
  await runCommand("tar", ["-xzf", archive, "-C", directory])
  const extracted = path.join(directory, asset.binaryName)
  fs.chmodSync(extracted, 0o755)
  fs.renameSync(extracted, dest)
  return dest
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited ${code}`))
    })
  })
}

function endpointTarget(request: RunRequest, mockBaseUrl: string | null): {
  baseUrl: string
  api: "openai" | "anthropic"
  model: string
  apiKeyEnv?: string
  apiKey?: string
} {
  const endpoint = request.endpoint
  if (endpoint.provider === "mock") {
    if (!mockBaseUrl) throw new Error("The stand-in model server did not start.")
    return { baseUrl: mockBaseUrl, api: "openai", model: "lab-stand-in" }
  }
  if (endpoint.provider === "openai") {
    const apiKey = endpoint.apiKey.trim()
    if (!apiKey) throw new Error("Add an OpenAI API key. It is sent only for this run.")
    return {
      baseUrl: "https://api.openai.com/v1",
      api: "openai",
      model: endpoint.model.trim() || "gpt-4o-mini",
      apiKeyEnv: "OPENAI_API_KEY",
      apiKey,
    }
  }
  if (endpoint.provider === "anthropic") {
    const apiKey = endpoint.apiKey.trim()
    if (!apiKey) throw new Error("Add an Anthropic API key. It is sent only for this run.")
    return {
      baseUrl: "https://api.anthropic.com",
      api: "anthropic",
      model: endpoint.model.trim() || "claude-sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      apiKey,
    }
  }
  const upstream = upstreamFor({ provider: "compatible", baseUrl: endpoint.baseUrl })
  if ("error" in upstream) throw new Error(upstream.error)
  const baseUrl = endpoint.baseUrl.trim().replace(/\/$/, "")
  const apiKey = endpoint.apiKey.trim()
  return {
    baseUrl,
    api: "openai",
    model: endpoint.model.trim() || "local",
    apiKeyEnv: apiKey ? "OPENAI_API_KEY" : undefined,
    apiKey: apiKey || undefined,
  }
}

export async function runShimRequest(
  request: RunRequest,
  options: { appRoot: string; runtimePath?: string },
): Promise<Trace> {
  const prepared = prepareRun(request)
  const runtimePath = options.runtimePath ?? process.execPath
  const mcpScript = path.join(options.appRoot, "server", "mcp-stdio.ts")
  const binary = await ensureShimBinary(options.appRoot)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shim-lab-"))
  const workspace = path.join(root, "workspace")
  const configDir = path.join(root, "config")
  fs.mkdirSync(path.join(workspace, ".shim", "skills"), { recursive: true })
  fs.mkdirSync(path.join(configDir, "sessions"), { recursive: true })
  for (const skill of prepared.skills) {
    const directory = path.join(workspace, ".shim", "skills", skill.name)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, "SKILL.md"), composeSkill(skill))
  }

  let closeMock = () => {}
  try {
    let mockBaseUrl: string | null = null
    if (request.endpoint.provider === "mock") {
      const mock = await startMockModel({
        task: prepared.task,
        skills: prepared.skills,
        tool: request.tool,
      })
      mockBaseUrl = mock.baseUrl
      closeMock = mock.close
    }
    const target = endpointTarget(request, mockBaseUrl)
    const config = buildShimConfig({
      baseUrl: target.baseUrl,
      model: target.model,
      api: target.api,
      apiKeyEnv: target.apiKeyEnv,
      tool: request.tool,
      notes: NOTES,
      runtimePath,
      mcpScript,
    })
    const configPath = path.join(configDir, "config.json")
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    const env = { ...process.env }
    if (target.apiKeyEnv && target.apiKey) env[target.apiKeyEnv] = target.apiKey
    const outcome = await runShim(binary, configPath, workspace, prepared.task, env)
    if (outcome.code !== 0) {
      throw new Error(outcome.stderr.trim() || outcome.stdout.trim() || `shim exited ${outcome.code}`)
    }
    const sessionPath = newestSession(path.join(configDir, "sessions"))
    const lines = fs
      .readFileSync(sessionPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SessionLine)
    return traceFromSession(
      lines,
      prepared.skills.map((skill) => ({ name: skill.name, description: skill.description })),
      SHIM_LABEL,
    )
  } finally {
    closeMock()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function newestSession(directory: string): string {
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
  const latest = files[files.length - 1]
  if (!latest) throw new Error("Shim finished without a session log.")
  return path.join(directory, latest)
}

function runShim(
  binary: string,
  configPath: string,
  workspace: string,
  task: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      ["--config", configPath, "--workspace", workspace, "run", "--yes", "--verbose", "--max-steps", "8", task],
      { env },
    )
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
    }, 90_000)
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export function shimStatus(): { ok: boolean; reason?: string; version: string } {
  const asset = shimAsset(process.platform, process.arch)
  if (!asset) {
    return {
      ok: false,
      version: SHIM_VERSION,
      reason: "The official binary bridge in this lab supports Linux x64 and arm64. The re-creation still runs.",
    }
  }
  return { ok: true, version: SHIM_VERSION }
}
