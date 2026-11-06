import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

import type { RunRequest } from "../src/harness/types.ts"
import { upstreamFor } from "../src/harness/upstream.ts"
import { runShimRequest, shimStatus } from "./bridge.ts"

const MAX_BODY = 200_000

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error("Request is too large.")
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader("content-type", "application/json")
  response.end(JSON.stringify(body))
}

export async function proxyModel(body: {
  provider?: string
  baseUrl?: string
  apiKey?: string
  payload?: unknown
}): Promise<{ status: number; body: unknown }> {
  const provider = body.provider ?? ""
  const upstream = upstreamFor({ provider, baseUrl: body.baseUrl })
  if ("error" in upstream) return { status: 400, body: { error: upstream.error } }
  const headers: Record<string, string> = { "content-type": "application/json" }
  const apiKey = body.apiKey?.trim() ?? ""
  if (provider === "anthropic") {
    if (!apiKey) return { status: 400, body: { error: "Add an Anthropic API key. It stays in this browser." } }
    headers["x-api-key"] = apiKey
    headers["anthropic-version"] = "2023-06-01"
  } else if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`
  }
  const result = await fetch(upstream.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body.payload ?? {}),
  })
  const text = await result.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    parsed = { error: text.slice(0, 500) || `Model request failed (${result.status}).` }
  }
  return { status: result.status, body: parsed }
}

function attach(appRoot: string) {
  return (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
    const url = request.url?.split("?")[0]
    if (request.method === "GET" && url === "/api/shim/status") {
      sendJson(response, 200, shimStatus())
      return
    }
    if (request.method !== "POST" || (url !== "/api/shim/run" && url !== "/api/model")) {
      next()
      return
    }
    readBody(request)
      .then(async (raw) => {
        const parsed = JSON.parse(raw) as RunRequest & {
          provider?: string
          baseUrl?: string
          apiKey?: string
          payload?: unknown
        }
        if (url === "/api/shim/run") {
          const trace = await runShimRequest(parsed, { appRoot })
          sendJson(response, 200, trace)
          return
        }
        const proxied = await proxyModel(parsed)
        sendJson(response, proxied.status, proxied.body)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Request failed."
        sendJson(response, 400, { error: message })
      })
  }
}

export function shimDevPlugin(appRoot: string): Plugin {
  const handle = attach(appRoot)
  return {
    name: "shim-dev",
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
