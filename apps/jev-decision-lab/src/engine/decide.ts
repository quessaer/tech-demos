import {
  ACTIONS,
  type Action,
  type Decision,
  type RouteInput,
} from "./types.ts"

const TRANSIENT =
  /timeout|timed out|429|rate[- ]?limit|503|502|504|econn|network|temporarily|unavailable|overloaded/
const FATAL =
  /unauthorized|forbidden|\b401\b|\b403\b|permission|invalid api key|billing|quota/
const HUMAN = /approve|approval|confirm with|ambiguous|unsure|ask (a )?human|which one/
const STALE = /stale|outdated|wrong cache|cache poison|mismatch/
const BROAD = /\b(compare|survey|landscape|overview|explore)\b/

const RUNNERS: Record<Action, readonly [Action, Action]> = {
  reuse_cache: ["proceed", "retry"],
  research_capped: ["proceed", "ask_human"],
  retry: ["stop_retry", "ask_human"],
  stop_retry: ["ask_human", "retry"],
  ask_human: ["stop_retry", "proceed"],
  proceed: ["research_capped", "reuse_cache"],
}

interface RuleMatch {
  action: Action
  rule: string
  peak: number
}

export function normalizeInput(input: RouteInput): RouteInput {
  return {
    goal: input.goal.trim(),
    taskType: input.taskType,
    lastError: input.lastError.trim(),
    retryCount: clampRetries(input.retryCount),
    cacheHitAvailable: input.cacheHitAvailable,
  }
}

export function choiceConfidence(probabilities: readonly number[]): number {
  const n = probabilities.length
  if (n <= 1) return 1
  const peak = Math.max(...probabilities)
  return (peak - 1 / n) / (1 - 1 / n)
}

export function decideLocal(input: RouteInput): Decision {
  const prepared = normalizeInput(input)
  const match = matchRule(prepared)
  const probabilities = probabilitiesFor(match.action, match.peak)
  return {
    action: match.action,
    confidence: choiceConfidence(ACTIONS.map((action) => probabilities[action])),
    probabilities,
    engine: "local",
    model: "local-rules",
    rule: match.rule,
  }
}

function matchRule(input: RouteInput): RuleMatch {
  const error = input.lastError.toLowerCase()
  const goal = input.goal.toLowerCase()
  const hasError = error.length > 0
  const transient = TRANSIENT.test(error)
  const fatal = FATAL.test(error)
  const needsHuman = fatal || HUMAN.test(`${error} ${goal}`)
  const stale = STALE.test(error)
  const broad = input.taskType === "research" && (goal.length > 80 || BROAD.test(goal))

  if (needsHuman) {
    return {
      action: "ask_human",
      peak: fatal ? 0.9 : 0.78,
      rule: fatal
        ? "Fatal error. A person should decide before another attempt."
        : "The step asks for a human judgment.",
    }
  }

  if (input.retryCount >= 3) {
    return {
      action: "stop_retry",
      peak: 0.92,
      rule: "Retry budget is spent. Stop the loop.",
    }
  }

  if (input.retryCount >= 2 && hasError && !transient) {
    return {
      action: "stop_retry",
      peak: 0.8,
      rule: "The same failure has repeated. Another retry is wasteful.",
    }
  }

  if (input.cacheHitAvailable && !stale) {
    return {
      action: "reuse_cache",
      peak: hasError ? 0.64 : 0.88,
      rule: hasError
        ? "A cache hit is available. Prefer it over retrying the failed call."
        : "A cache hit is available. Reuse it instead of new work.",
    }
  }

  if (hasError && transient && input.retryCount < 2) {
    return {
      action: "retry",
      peak: input.retryCount === 0 ? 0.74 : 0.6,
      rule: "The last error looks transient. One retry is still cheap.",
    }
  }

  if (hasError && input.retryCount === 0) {
    return {
      action: "retry",
      peak: 0.62,
      rule: "First failure. Retry once before escalating.",
    }
  }

  if (hasError) {
    return {
      action: "stop_retry",
      peak: 0.74,
      rule: "The failure is not worth another automatic attempt.",
    }
  }

  if (input.taskType === "research") {
    return {
      action: "research_capped",
      peak: broad ? 0.84 : 0.66,
      rule: broad
        ? "The goal is an open survey. Cap the research."
        : "Research task. Cap the lookup instead of wandering.",
    }
  }

  return {
    action: "proceed",
    peak: 0.86,
    rule: "The path is clear. Continue the task.",
  }
}

function probabilitiesFor(action: Action, peak: number): Record<Action, number> {
  const [first, second] = RUNNERS[action]
  const others = ACTIONS.filter(
    (candidate) => candidate !== action && candidate !== first && candidate !== second,
  )
  const remaining = 1 - peak
  const probabilities = {
    reuse_cache: 0,
    research_capped: 0,
    retry: 0,
    stop_retry: 0,
    ask_human: 0,
    proceed: 0,
  } satisfies Record<Action, number>

  probabilities[action] = peak
  probabilities[first] = remaining * 0.5
  probabilities[second] = remaining * 0.32
  const dust = (remaining - probabilities[first] - probabilities[second]) / others.length
  for (const other of others) probabilities[other] = dust

  const sum = ACTIONS.reduce((total, candidate) => total + probabilities[candidate], 0)
  probabilities[action] += 1 - sum
  return probabilities
}

function clampRetries(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}
