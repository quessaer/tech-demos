import type { RouteInput } from "./types.ts"

export interface Preset {
  id: string
  label: string
  detail: string
  input: RouteInput
}

export const PRESETS: readonly Preset[] = [
  {
    id: "cache",
    label: "Cache hit",
    detail: "Warm lookup",
    input: {
      goal: "Fetch the open invoice total for customer 1842",
      taskType: "lookup",
      lastError: "",
      retryCount: 0,
      cacheHitAvailable: true,
    },
  },
  {
    id: "research",
    label: "Broad research",
    detail: "Open survey",
    input: {
      goal: "Survey the landscape of typed decision models and compare how each one routes agent retries",
      taskType: "research",
      lastError: "",
      retryCount: 0,
      cacheHitAvailable: false,
    },
  },
  {
    id: "retry",
    label: "Flaky tool",
    detail: "Transient 503",
    input: {
      goal: "Call the billing API for invoice 1842",
      taskType: "tool_call",
      lastError: "HTTP 503 temporarily unavailable",
      retryCount: 0,
      cacheHitAvailable: false,
    },
  },
  {
    id: "stop",
    label: "Retry loop",
    detail: "Third failure",
    input: {
      goal: "Apply the migration patch and rerun the suite",
      taskType: "code_edit",
      lastError: "Patch failed: tests still red",
      retryCount: 3,
      cacheHitAvailable: false,
    },
  },
  {
    id: "human",
    label: "Needs a person",
    detail: "Permission error",
    input: {
      goal: "Refund this charge if it looks like a duplicate, otherwise leave it",
      taskType: "tool_call",
      lastError: "403 forbidden — approval required",
      retryCount: 1,
      cacheHitAvailable: false,
    },
  },
  {
    id: "proceed",
    label: "Clear path",
    detail: "No error, no cache",
    input: {
      goal: "Rename the helper and update its call sites",
      taskType: "code_edit",
      lastError: "",
      retryCount: 0,
      cacheHitAvailable: false,
    },
  },
]
