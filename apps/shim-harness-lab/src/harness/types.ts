export type ToolKind = "calculator" | "file_search"

export type ProviderKind = "mock" | "openai" | "anthropic" | "compatible"

export type EngineKind = "lab" | "shim"

export type SkillDraft = {
  name: string
  description: string
  body: string
  enabled: boolean
}

export type Skill = {
  name: string
  description: string
  body: string
}

export type Note = {
  path: string
  text: string
}

export type Endpoint = {
  provider: ProviderKind
  model: string
  baseUrl: string
  apiKey: string
}

export type RunRequest = {
  task: string
  skills: SkillDraft[]
  tool: ToolKind
  endpoint: Endpoint
  engine: EngineKind
}

export type CatalogEntry = {
  name: string
  description: string
}

export type TraceStep =
  | { kind: "catalog"; skills: CatalogEntry[] }
  | { kind: "load_skill"; name: string; body: string }
  | {
      kind: "tool"
      name: string
      arguments: Record<string, unknown>
      result: string
      via: "mcp" | "other"
    }
  | { kind: "answer"; text: string }

export type Trace = {
  engine: EngineKind
  engineLabel: string
  steps: TraceStep[]
  answer: string
}

export type ModelMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content?: string
  tool_call_id?: string
  tool_calls?: { id: string; name: string; arguments: Record<string, unknown> }[]
}

export type ToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ModelTurn =
  | { type: "tool"; calls: ToolCall[] }
  | { type: "answer"; text: string }

export const LAB_LABEL =
  "Faithful re-creation of Shim's loop. This is not the Shim binary."

export const SHIM_LABEL = "Shim v0.1.0, the official binary. Trace from its session log."
