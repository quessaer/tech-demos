import { useEffect, useState } from "react"

import { Explainer } from "@/components/explainer.tsx"
import { SetupPanel, TaskCard } from "@/components/setup-panel.tsx"
import { TraceView } from "@/components/trace-view.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { defaultModel } from "@/harness/live.ts"
import { clonePreset } from "@/harness/presets.ts"
import type { Endpoint, EngineKind, RunRequest, SkillDraft, ToolKind, Trace } from "@/harness/types.ts"
import { executeRun } from "@/lib/run-task.ts"
import { loadKeys, saveKey } from "@/lib/storage.ts"

const initial = clonePreset("lisbon")

const emptyEndpoint = (keys: Record<string, string>): Endpoint => ({
  provider: "mock",
  model: "lab-stand-in",
  baseUrl: "http://127.0.0.1:11434/v1",
  apiKey: keys.openai ?? "",
})

export default function App() {
  const [task, setTask] = useState(initial?.task ?? "")
  const [skills, setSkills] = useState<SkillDraft[]>(initial?.skills ?? [])
  const [tool, setTool] = useState<ToolKind>(initial?.tool ?? "calculator")
  const [endpoint, setEndpoint] = useState<Endpoint>(() => emptyEndpoint(loadKeys()))
  const [engine, setEngine] = useState<EngineKind>("lab")
  const [presetId, setPresetId] = useState<string | null>("lisbon")
  const [trace, setTrace] = useState<Trace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [shimStatus, setShimStatus] = useState<{ ok: boolean; reason?: string; version?: string } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    fetch("/api/shim/status")
      .then((response) => response.json() as Promise<{ ok: boolean; reason?: string; version?: string }>)
      .then((status) => {
        if (!cancelled) setShimStatus(status)
      })
      .catch(() => {
        if (!cancelled) {
          setShimStatus({
            ok: false,
            reason: "Real Shim mode needs the dev server from bun run dev. The re-creation still runs.",
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function changeEndpoint(next: Endpoint) {
    const providerChanged = next.provider !== endpoint.provider
    const keys = loadKeys()
    const withModel: Endpoint = {
      ...next,
      model: providerChanged ? defaultModel(next.provider) : next.model,
      apiKey: providerChanged ? (keys[next.provider] ?? "") : next.apiKey,
    }
    setEndpoint(withModel)
    if (withModel.provider !== "mock") saveKey(withModel.provider, withModel.apiKey)
  }

  function applyPreset(id: string) {
    const preset = clonePreset(id)
    if (!preset) return
    setPresetId(id)
    setTask(preset.task)
    setSkills(preset.skills)
    setTool(preset.tool)
    setError(null)
  }

  async function run() {
    const request: RunRequest = { task, skills, tool, endpoint, engine }
    setPending(true)
    setError(null)
    try {
      setTrace(await executeRun(request))
    } catch (caught) {
      setTrace(null)
      setError(caught instanceof Error ? caught.message : "Run failed.")
    } finally {
      setPending(false)
    }
  }

  const panelProps = {
    task,
    skills,
    tool,
    endpoint,
    engine,
    presetId,
    shimStatus,
    pending,
    error,
    onTask: (value: string) => {
      setTask(value)
      setPresetId(null)
    },
    onSkills: (next: SkillDraft[]) => {
      setSkills(next)
      setPresetId(null)
    },
    onTool: (next: ToolKind) => {
      setTool(next)
      setPresetId(null)
    },
    onEndpoint: changeEndpoint,
    onEngine: setEngine,
    onPreset: applyPreset,
    onRun: () => {
      void run()
    },
  }

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Local-first agent harness
            </p>
            <h1 className="text-lg font-medium">Shim harness lab</h1>
          </div>
          <Badge data-testid="engine-badge" variant={engine === "shim" ? "default" : "outline"}>
            {engine === "shim" ? "Real Shim CLI" : "Re-creation"}
          </Badge>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-4">
          <Explainer />
          <SetupPanel {...panelProps} />
        </div>
        <div className="space-y-4">
          <TaskCard {...panelProps} />
          <TraceView trace={trace} pending={pending} />
        </div>
      </main>
    </div>
  )
}
