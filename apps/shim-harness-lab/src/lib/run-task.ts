import { defaultModel, providerError, runLive } from "@/harness/live.ts"
import { runLab } from "@/harness/plan.ts"
import { prepareRun } from "@/harness/prepare.ts"
import type { RunRequest, Trace } from "@/harness/types.ts"

function errorMessage(payload: unknown, status: number): string {
  return providerError(payload) ?? `Request failed (${status}).`
}

export async function executeRun(request: RunRequest): Promise<Trace> {
  const prepared = prepareRun(request)
  if (request.engine === "shim") {
    let response: Response
    try {
      response = await fetch("/api/shim/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      })
    } catch {
      throw new Error("Real Shim mode needs the dev server from bun run dev.")
    }
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) throw new Error(payload.error || "Shim run failed.")
    return payload as Trace
  }
  if (request.endpoint.provider === "mock") {
    return runLab({ task: prepared.task, skills: prepared.skills, tool: request.tool })
  }
  const provider = request.endpoint.provider
  return runLive({
    task: prepared.task,
    skills: prepared.skills,
    tool: request.tool,
    provider,
    model: request.endpoint.model.trim() || defaultModel(provider),
    complete: async (payload) => {
      const response = await fetch("/api/model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl: request.endpoint.baseUrl,
          apiKey: request.endpoint.apiKey,
          payload,
        }),
      })
      const json = (await response.json()) as unknown
      if (!response.ok) throw new Error(errorMessage(json, response.status))
      return json
    },
  })
}
