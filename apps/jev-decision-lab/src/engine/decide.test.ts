import { describe, expect, test } from "bun:test"
import { decideLocal, choiceConfidence } from "./decide.ts"
import { PRESETS } from "./presets.ts"
import { ACTIONS, emptyInput, type RouteInput } from "./types.ts"

function route(overrides: Partial<RouteInput> = {}): RouteInput {
  return { ...emptyInput(), goal: "Do the task", ...overrides }
}

function sum(probabilities: Record<string, number>): number {
  return Object.values(probabilities).reduce((total, value) => total + value, 0)
}

describe("decideLocal", () => {
  test("preset scenarios pick the action they are meant to show", () => {
    const expected = {
      cache: "reuse_cache",
      research: "research_capped",
      retry: "retry",
      stop: "stop_retry",
      human: "ask_human",
      proceed: "proceed",
    } as const

    for (const preset of PRESETS) {
      expect(decideLocal(preset.input).action).toBe(expected[preset.id as keyof typeof expected])
    }
  })

  test("a cache hit beats a transient retry", () => {
    const decision = decideLocal(
      route({
        taskType: "tool_call",
        lastError: "HTTP 503 temporarily unavailable",
        cacheHitAvailable: true,
      }),
    )
    expect(decision.action).toBe("reuse_cache")
  })

  test("a stale cache is not reused", () => {
    const decision = decideLocal(
      route({
        lastError: "stale cache entry",
        cacheHitAvailable: true,
        retryCount: 0,
      }),
    )
    expect(decision.action).toBe("retry")
  })

  test("a repeated non-transient failure stops the loop before the hard cap", () => {
    const decision = decideLocal(
      route({
        lastError: "Patch failed: tests still red",
        retryCount: 2,
      }),
    )
    expect(decision.action).toBe("stop_retry")
  })

  test("the first ordinary failure retries once", () => {
    const decision = decideLocal(route({ lastError: "syntax error in the patch", retryCount: 0 }))
    expect(decision.action).toBe("retry")
  })

  test("an auth failure asks a human even when a cache exists", () => {
    const decision = decideLocal(
      route({
        lastError: "401 unauthorized",
        cacheHitAvailable: true,
        retryCount: 0,
      }),
    )
    expect(decision.action).toBe("ask_human")
  })

  test("a short research goal is less confident than a broad survey", () => {
    const short = decideLocal(route({ goal: "Find the refund policy", taskType: "research" }))
    const broad = decideLocal(
      route({
        goal: "Survey the landscape of typed decision models and compare how each one routes agent retries",
        taskType: "research",
      }),
    )
    expect(short.action).toBe("research_capped")
    expect(broad.action).toBe("research_capped")
    expect(broad.confidence).toBeGreaterThan(short.confidence)
  })

  test("negative and non-finite retry counts are treated as zero", () => {
    const negative = decideLocal(route({ lastError: "boom", retryCount: -4 }))
    const missing = decideLocal(route({ lastError: "boom", retryCount: Number.NaN }))
    expect(negative.action).toBe("retry")
    expect(missing.action).toBe("retry")
  })

  test("every decision is a distribution over the fixed action set", () => {
    const samples = [
      ...PRESETS.map((preset) => preset.input),
      route({ goal: "", retryCount: 9, lastError: "nope" }),
    ]

    for (const input of samples) {
      const decision = decideLocal(input)
      expect(ACTIONS).toContain(decision.action)
      expect(Object.keys(decision.probabilities).sort()).toEqual([...ACTIONS].sort())
      expect(sum(decision.probabilities)).toBeCloseTo(1)
      const winner = Math.max(...Object.values(decision.probabilities))
      expect(decision.probabilities[decision.action]).toBeCloseTo(winner)
      expect(decision.confidence).toBeGreaterThan(0)
      expect(decision.confidence).toBeLessThanOrEqual(1)
      expect(decision.confidence).toBeCloseTo(
        choiceConfidence(ACTIONS.map((action) => decision.probabilities[action])),
      )
      expect(decision.engine).toBe("local")
    }
  })

  test("the same input returns the same decision", () => {
    const input = route({
      taskType: "lookup",
      cacheHitAvailable: true,
      retryCount: 1,
      lastError: "HTTP 503 temporarily unavailable",
    })
    expect(decideLocal(input)).toEqual(decideLocal(input))
  })
})

describe("choiceConfidence", () => {
  test("matches the published Choice formula", () => {
    expect(choiceConfidence([1, 0, 0, 0, 0, 0])).toBeCloseTo(1)
    expect(choiceConfidence([1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6])).toBeCloseTo(0)
    expect(choiceConfidence([0.6, 0.3, 0.1])).toBeCloseTo(0.4)
    expect(choiceConfidence([0.6, 0.2, 0.2])).toBeCloseTo(0.4)
  })
})
