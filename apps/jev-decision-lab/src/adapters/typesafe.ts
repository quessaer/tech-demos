import { choiceConfidence, normalizeInput } from "../engine/decide.ts"
import {
  ACTIONS,
  isAction,
  type Action,
  type Decision,
  type RouteInput,
} from "../engine/types.ts"

const MODEL = "jev-latest"

const CRITERIA: Record<Action, string> = {
  reuse_cache:
    "A cached result for this task is available and still appropriate. Skip new work.",
  research_capped:
    "The goal is open-ended research. Do a bounded lookup instead of an open investigation.",
  retry: "The last attempt failed for a transient reason and another try is still cheap.",
  stop_retry: "Further automatic retries are wasteful. Stop the retry loop.",
  ask_human:
    "The next step needs a person: approval, ambiguity, or a fatal error the agent should not guess through.",
  proceed:
    "The path is clear. Continue the task without a retry, a cache hit, or a human.",
}

export async function decideWithTypeSafe(
  input: RouteInput,
  apiKey: string,
): Promise<Decision> {
  const key = apiKey.trim()
  if (!key) {
    throw new Error("Add a TypeSafe API key to route in live mode.")
  }

  const prepared = normalizeInput(input)
  let response: Response
  try {
    response = await fetch("/api/typesafe/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        state: {
          goal: prepared.goal,
          task_type: prepared.taskType,
          last_error: prepared.lastError || null,
          retry_count: prepared.retryCount,
          cache_hit_available: prepared.cacheHitAvailable,
        },
        questions: {
          route: {
            type: "choice",
            instructions:
              "Which single next action should this agent take? Prefer the cheapest action that still makes progress.",
            criteria: CRITERIA,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed"
    throw new Error(`Could not reach TypeSafe (${message}).`)
  }

  if (!response.ok) {
    throw new Error(await formatHttpError(response))
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error("TypeSafe returned a response that was not JSON.")
  }

  return parseChoice(body)
}

function parseChoice(body: unknown): Decision {
  if (!isRecord(body)) throw new Error("TypeSafe returned an empty response.")

  const model = typeof body.model === "string" ? body.model : MODEL
  if (!isRecord(body.answers) || !isRecord(body.answers.route)) {
    throw new Error("TypeSafe response is missing the route Choice.")
  }

  const route = body.answers.route
  if (route.type !== "choice" || typeof route.choice !== "string") {
    throw new Error("TypeSafe did not return a Choice for the route.")
  }
  if (!isAction(route.choice)) {
    throw new Error(`TypeSafe returned an unknown action: ${route.choice}`)
  }
  if (!isRecord(route.probabilities)) {
    throw new Error("TypeSafe Choice is missing probabilities.")
  }

  const probabilities = emptyProbabilities()
  for (const action of ACTIONS) {
    const value = route.probabilities[action]
    probabilities[action] = typeof value === "number" && Number.isFinite(value) ? value : 0
  }

  const confidence =
    typeof route.confidence === "number" && Number.isFinite(route.confidence)
      ? route.confidence
      : choiceConfidence(ACTIONS.map((action) => probabilities[action]))

  return {
    action: route.choice,
    confidence,
    probabilities,
    engine: "typesafe",
    model,
    rule: `Choice from ${model}.`,
  }
}

async function formatHttpError(response: Response): Promise<string> {
  const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180)
  if (response.status === 401) return "TypeSafe rejected the API key."
  if (response.status === 429) return "TypeSafe rate limit. Wait a moment, then route again."
  if (detail) return `TypeSafe returned ${response.status}: ${detail}`
  return `TypeSafe returned ${response.status}.`
}

function emptyProbabilities(): Record<Action, number> {
  return {
    reuse_cache: 0,
    research_capped: 0,
    retry: 0,
    stop_retry: 0,
    ask_human: 0,
    proceed: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
