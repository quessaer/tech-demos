export const ACTIONS = [
  "reuse_cache",
  "research_capped",
  "retry",
  "stop_retry",
  "ask_human",
  "proceed",
] as const

export type Action = (typeof ACTIONS)[number]

export const TASK_TYPES = [
  "lookup",
  "research",
  "tool_call",
  "code_edit",
  "synthesis",
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export type EngineId = "local" | "typesafe"

export interface RouteInput {
  goal: string
  taskType: TaskType
  lastError: string
  retryCount: number
  cacheHitAvailable: boolean
}

export interface Decision {
  action: Action
  confidence: number
  probabilities: Record<Action, number>
  engine: EngineId
  model: string
  rule: string
}

export const ACTION_LABEL: Record<Action, string> = {
  reuse_cache: "Reuse the cached result",
  research_capped: "Research, but cap it",
  retry: "Retry the last step",
  stop_retry: "Stop the retry loop",
  ask_human: "Ask a human",
  proceed: "Proceed with the task",
}

export const TASK_LABEL: Record<TaskType, string> = {
  lookup: "Lookup",
  research: "Research",
  tool_call: "Tool call",
  code_edit: "Code edit",
  synthesis: "Synthesis",
}

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value)
}

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value)
}

export function emptyInput(): RouteInput {
  return {
    goal: "",
    taskType: "lookup",
    lastError: "",
    retryCount: 0,
    cacheHitAvailable: false,
  }
}
