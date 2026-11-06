import { Badge } from "@/components/ui/badge.tsx"
import type { Trace, TraceStep } from "@/harness/types.ts"

const captions: Record<TraceStep["kind"], string> = {
  catalog: "Only names and descriptions enter the prompt. The instruction files stay closed.",
  load_skill: "The harness opened this SKILL.md because the task matched it.",
  tool: "The model asked for this tool. The harness ran it and passed the result back.",
  answer: "No further tool call. This is the final text.",
}

function stepTitle(step: TraceStep, index: number): string {
  const number = String(index + 1).padStart(2, "0")
  if (step.kind === "catalog") return `${number}  Skill catalog`
  if (step.kind === "load_skill") return `${number}  load_skill  ${step.name}`
  if (step.kind === "tool") return `${number}  ${step.name}`
  return `${number}  Answer`
}

export function TraceView({ trace, pending }: { trace: Trace | null; pending: boolean }) {
  return (
    <section
      data-testid="trace"
      className="bg-[oklch(0.2_0.028_255)] text-[oklch(0.96_0.01_250)] ring-1 ring-[oklch(0.32_0.04_255)]"
      aria-busy={pending}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">Trace</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-white/70">
            {trace
              ? trace.engineLabel
              : "Run a task to see the catalog, the skill that was opened, the tool call, and the answer."}
          </p>
        </div>
        {trace ? (
          <Badge variant="outline" className="border-white/20 text-[oklch(0.96_0.01_250)]">
            {trace.engine === "shim" ? "Real binary" : "Re-creation"}
          </Badge>
        ) : null}
      </div>
      {pending ? (
        <p className="px-4 py-6 text-sm" role="status">
          Running the loop…
        </p>
      ) : null}
      {!pending && !trace ? (
        <p className="px-4 py-8 text-sm text-white/70">
          Nothing has run yet. The Lisbon weekend preset is ready.
        </p>
      ) : null}
      {trace && !pending ? (
        <ol className="divide-y divide-white/10" data-testid="trace-steps">
          {trace.steps.map((step, index) => (
            <li key={`${step.kind}-${index}`} className="px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-[oklch(0.86_0.08_85)]">
                {stepTitle(step, index)}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/60">{captions[step.kind]}</p>
              <StepBody step={step} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function StepBody({ step }: { step: TraceStep }) {
  if (step.kind === "catalog") {
    return (
      <ul className="mt-3 space-y-2">
        {step.skills.map((skill) => (
          <li key={skill.name} className="border border-white/10 px-3 py-2">
            <p className="text-sm">{skill.name}</p>
            <p className="mt-1 text-xs leading-5 text-white/75">{skill.description}</p>
            <p className="mt-1 text-[11px] text-white/45">Instructions not loaded</p>
          </li>
        ))}
      </ul>
    )
  }
  if (step.kind === "load_skill") {
    return (
      <pre className="mt-3 overflow-x-auto border border-white/10 bg-black/20 p-3 text-xs leading-5 whitespace-pre-wrap">
        {step.body}
      </pre>
    )
  }
  if (step.kind === "tool") {
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="border border-white/10 px-3 py-2">
          <p className="text-[11px] tracking-wide text-white/50 uppercase">Arguments</p>
          <pre className="mt-1 text-xs leading-5 whitespace-pre-wrap">
            {JSON.stringify(step.arguments, null, 2)}
          </pre>
        </div>
        <div className="border border-white/10 px-3 py-2">
          <p className="text-[11px] tracking-wide text-white/50 uppercase">Result</p>
          <pre className="mt-1 text-xs leading-5 whitespace-pre-wrap" data-testid="tool-result">
            {step.result}
          </pre>
        </div>
      </div>
    )
  }
  return (
    <p className="mt-3 text-base leading-7" data-testid="final-answer">
      {step.text}
    </p>
  )
}
