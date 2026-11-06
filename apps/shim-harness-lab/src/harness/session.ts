import { SHIM_LABEL, type CatalogEntry, type Trace, type TraceStep } from "./types.ts"

export type SessionLine = {
  role?: string
  content?: string
  tool_call_id?: string
  tool_calls?: { id?: string; name?: string; arguments?: unknown }[]
}

export function normalizeArguments(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return { value }
    }
    return { value }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function traceFromSession(
  lines: SessionLine[],
  catalog: CatalogEntry[],
  engineLabel = SHIM_LABEL,
): Trace {
  const results = new Map<string, string>()
  for (const line of lines) {
    if (line.role === "tool" && line.tool_call_id) results.set(line.tool_call_id, line.content ?? "")
  }

  const steps: TraceStep[] = [{ kind: "catalog", skills: catalog }]
  let answer = ""

  for (const line of lines) {
    if (line.role !== "assistant") continue
    const calls = line.tool_calls ?? []
    if (calls.length === 0 && line.content) {
      answer = line.content
      steps.push({ kind: "answer", text: line.content })
      continue
    }
    for (const call of calls) {
      const id = call.id ?? ""
      const name = call.name ?? "tool"
      const args = normalizeArguments(call.arguments)
      const result = results.get(id) ?? ""
      if (name === "load_skill") {
        steps.push({ kind: "load_skill", name: String(args.name ?? ""), body: result })
      } else {
        steps.push({
          kind: "tool",
          name,
          arguments: args,
          result,
          via: name.startsWith("mcp_") ? "mcp" : "other",
        })
      }
    }
  }

  return { engine: "shim", engineLabel, steps, answer }
}
