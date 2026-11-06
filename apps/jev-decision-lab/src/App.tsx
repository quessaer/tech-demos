import { useState } from "react"
import { decideWithTypeSafe } from "./adapters/typesafe.ts"
import { DecisionPanel } from "./components/decision-panel.tsx"
import { EngineBadge, RouteForm } from "./components/route-form.tsx"
import { ShadowLog } from "./components/shadow-log.tsx"
import { decideLocal } from "./engine/decide.ts"
import { PRESETS } from "./engine/presets.ts"
import { emptyInput, type Decision, type RouteInput } from "./engine/types.ts"
import {
  loadApiKey,
  loadLive,
  loadLog,
  saveApiKey,
  saveLive,
  saveLog,
  type LogEntry,
} from "./lib/storage.ts"

export default function App() {
  const [input, setInput] = useState<RouteInput>(emptyInput)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [live, setLive] = useState(loadLive)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [log, setLog] = useState<LogEntry[]>(loadLog)

  function edit(next: RouteInput) {
    setInput(next)
    setPresetId(null)
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((item) => item.id === id)
    if (!preset) return
    setInput(preset.input)
    setPresetId(id)
    setError(null)
  }

  function changeLive(next: boolean) {
    setLive(next)
    saveLive(next)
    setError(null)
  }

  function changeApiKey(next: string) {
    setApiKey(next)
    saveApiKey(next)
  }

  function remember(entry: LogEntry) {
    setLog((current) => {
      const next = [entry, ...current].slice(0, 40)
      saveLog(next)
      return next
    })
  }

  function clearLog() {
    setLog([])
    saveLog([])
  }

  async function route() {
    setPending(true)
    setError(null)
    try {
      const next = live ? await decideWithTypeSafe(input, apiKey) : decideLocal(input)
      setDecision(next)
      remember({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        input,
        decision: next,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Route failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-svh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-5 py-5">
          <div className="space-y-1">
            <p className="text-muted-foreground tracking-[0.16em] uppercase">
              System One · shadow mode
            </p>
            <h1 className="text-2xl tracking-tight">Jev Decision Lab</h1>
            <p className="max-w-xl text-muted-foreground">
              A typed route for one agent step. Skip a wasteful retry, reuse a cache, or ask a human.
            </p>
          </div>
          <EngineBadge live={live} />
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_19rem]">
        <RouteForm
          input={input}
          presetId={presetId}
          live={live}
          apiKey={apiKey}
          pending={pending}
          onChange={edit}
          onPreset={applyPreset}
          onLive={changeLive}
          onApiKey={changeApiKey}
          onRoute={() => {
            void route()
          }}
        />
        <DecisionPanel decision={decision} error={error} pending={pending} />
        <ShadowLog
          entries={log}
          onClear={clearLog}
          onSelect={(entry) => {
            setInput(entry.input)
            setDecision(entry.decision)
            setPresetId(null)
            setError(null)
          }}
        />
      </main>
    </div>
  )
}
