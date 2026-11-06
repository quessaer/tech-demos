import readline from "node:readline"

import { NOTES, runMockTool } from "../src/harness/tools.ts"
import type { Note, ToolKind } from "../src/harness/types.ts"

type Rpc = {
  jsonrpc?: string
  id?: number
  method?: string
  params?: { name?: string; arguments?: Record<string, unknown> }
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function toolKind(): ToolKind {
  return process.env.SHIM_LAB_TOOL === "file_search" ? "file_search" : "calculator"
}

function notes(): Note[] {
  const raw = process.env.SHIM_LAB_NOTES
  if (!raw) return NOTES
  try {
    const parsed = JSON.parse(raw) as Note[]
    if (Array.isArray(parsed)) return parsed
  } catch {
    return NOTES
  }
  return NOTES
}

function toolSpec(kind: ToolKind) {
  if (kind === "calculator") {
    return {
      name: "calculator",
      description: "Evaluate an arithmetic expression of numbers, parentheses, and + - * /.",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Example: 4 * 180 + 42" },
        },
        required: ["expression"],
        additionalProperties: false,
      },
    }
  }
  return {
    name: "file_search",
    description: "Find a line in the lab notebook by words from the question.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for. Not a file path." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  }
}

const kind = toolKind()
const corpus = notes()
const reader = readline.createInterface({ input: process.stdin })

reader.on("line", (line) => {
  if (!line.trim()) return
  let message: Rpc
  try {
    message = JSON.parse(line) as Rpc
  } catch {
    return
  }
  if (message.id == null) return
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "lab", version: "0.0.1" },
      },
    })
    return
  }
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools: [toolSpec(kind)] } })
    return
  }
  if (message.method === "tools/call") {
    const args = message.params?.arguments ?? {}
    const text = runMockTool(kind, args, corpus)
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        content: [{ type: "text", text }],
        isError: text.startsWith("Error:"),
      },
    })
    return
  }
  send({ jsonrpc: "2.0", id: message.id, result: {} })
})
