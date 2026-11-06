import type { Note, ToolKind } from "./types.ts"

export const NOTES: Note[] = [
  { path: "notes/keys.md", text: "The studio door code is 4419." },
  { path: "notes/packing.md", text: "Bring the EU plug adapter." },
  { path: "notes/cafe.md", text: "Lunch is at the tiled cafe on Rua da Prata." },
]

export function mcpToolName(tool: ToolKind): string {
  return tool === "calculator" ? "mcp_lab_calculator" : "mcp_lab_file_search"
}

export function remoteToolName(tool: ToolKind): string {
  return tool === "calculator" ? "calculator" : "file_search"
}

export type JsonSchema = {
  type: "object"
  properties: Record<string, { type: string; description: string }>
  required: string[]
  additionalProperties: false
}

export function toolSchema(tool: ToolKind): {
  name: string
  description: string
  parameters: JsonSchema
} {
  if (tool === "calculator") {
    return {
      name: mcpToolName(tool),
      description:
        "MCP/lab: Evaluate an arithmetic expression of numbers, parentheses, and + - * /.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Example: 4 * 180 + 42",
          },
        },
        required: ["expression"],
        additionalProperties: false,
      },
    }
  }
  return {
    name: mcpToolName(tool),
    description: "MCP/lab: Find a line in the lab notebook by words from the question.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Words to look for. Not a file path.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  }
}

export function evaluateExpression(input: string): number {
  const source = input.trim()
  if (!source) throw new Error("expression is empty")
  let index = 0

  function peek(): string {
    return source[index] ?? ""
  }

  function skip(): void {
    while (peek() === " ") index += 1
  }

  function parseExpression(): number {
    let value = parseTerm()
    for (;;) {
      skip()
      const operator = peek()
      if (operator !== "+" && operator !== "-") break
      index += 1
      const right = parseTerm()
      value = operator === "+" ? value + right : value - right
    }
    return value
  }

  function parseTerm(): number {
    let value = parseFactor()
    for (;;) {
      skip()
      const operator = peek()
      if (operator !== "*" && operator !== "/") break
      index += 1
      const right = parseFactor()
      if (operator === "/" && right === 0) throw new Error("division by zero")
      value = operator === "*" ? value * right : value / right
    }
    return value
  }

  function parseFactor(): number {
    skip()
    if (peek() === "+") {
      index += 1
      return parseFactor()
    }
    if (peek() === "-") {
      index += 1
      return -parseFactor()
    }
    if (peek() === "(") {
      index += 1
      const value = parseExpression()
      skip()
      if (peek() !== ")") throw new Error("missing closing parenthesis")
      index += 1
      return value
    }
    const start = index
    while (/[0-9]/.test(peek())) index += 1
    if (peek() === ".") {
      index += 1
      if (!/[0-9]/.test(peek())) throw new Error("invalid number")
      while (/[0-9]/.test(peek())) index += 1
    }
    if (start === index) throw new Error("expected a number")
    return Number(source.slice(start, index))
  }

  const value = parseExpression()
  skip()
  if (index !== source.length) throw new Error("unexpected characters")
  if (!Number.isFinite(value)) throw new Error("result is not a finite number")
  return value
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return String(rounded)
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "what",
  "of",
  "and",
  "to",
  "for",
  "plus",
  "at",
  "in",
  "on",
  "my",
  "me",
  "do",
  "how",
  "much",
  "with",
  "from",
  "this",
  "that",
  "are",
  "was",
  "be",
  "dollar",
  "dollars",
])

export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

export function expressionFromTask(task: string): string | null {
  const explicit = task.match(/(?:\d+(?:\.\d+)?\s*[+\-*/]\s*)+\d+(?:\.\d+)?/)
  if (explicit?.[0]) return explicit[0].replace(/\s+/g, " ").trim()
  const numbers = task.match(/\d+(?:\.\d+)?/g)
  if (!numbers || numbers.length === 0) return null
  if (numbers.length === 1) return numbers[0]
  if (numbers.length === 2) return `${numbers[0]} * ${numbers[1]}`
  return `${numbers[0]} * ${numbers[1]} + ${numbers[2]}`
}

export function queryFromTask(task: string): string {
  const words = contentTokens(task)
  return words.length > 0 ? words.join(" ") : task.trim()
}

export function searchNotes(notes: Note[], query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return "Error: query is empty"
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    return "Error: query cannot include a path"
  }
  const lowered = trimmed.toLowerCase()
  const phrase = notes.find(
    (note) =>
      note.text.toLowerCase().includes(lowered) || note.path.toLowerCase().includes(lowered),
  )
  if (phrase) return `${phrase.path}: ${phrase.text}`

  const words = contentTokens(trimmed)
  let best: { note: Note; score: number } | null = null
  for (const note of notes) {
    const text = note.text.toLowerCase()
    const score = words.filter((word) => text.includes(word)).length
    if (score > 0 && (!best || score > best.score)) best = { note, score }
  }
  if (!best) return `No note contains "${trimmed}".`
  return `${best.note.path}: ${best.note.text}`
}

export function runMockTool(
  tool: ToolKind,
  args: Record<string, unknown>,
  notes: Note[] = NOTES,
): string {
  if (tool === "calculator") {
    try {
      return formatNumber(evaluateExpression(String(args.expression ?? "")))
    } catch (error) {
      const message = error instanceof Error ? error.message : "calculator failed"
      return `Error: ${message}`
    }
  }
  return searchNotes(notes, String(args.query ?? ""))
}
