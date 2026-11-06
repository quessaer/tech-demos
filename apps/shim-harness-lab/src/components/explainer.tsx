import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx"

const facts = [
  ["About 7 MB", "One static program. No installer stack."],
  ["No telemetry", "Nothing phones home. No account."],
  ["Skills stay lazy", "The model sees names first, and the file only if it asks."],
  ["Keys stay out", "Shim reads an environment variable. It does not save the key."],
]

export function Explainer() {
  return (
    <Card data-testid="explainer">
      <CardHeader>
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Why this exists
        </p>
        <CardTitle className="text-base">What Shim is</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6">
        <p>
          Coding agents usually show up as a whole product: a chat window, a model menu, and a
          private way to attach tools. Shim is the thin piece in the middle. It is one program,
          about 7 MB, with no extra libraries and no telemetry. It does not run the model. It
          connects a model you already have to instructions and tools you choose.
        </p>
        <p>
          You point it at OpenAI, Anthropic, or a model on your own machine. Skills are plain
          text files named SKILL.md. MCP tools are other programs, each with a JSON description
          of its inputs. Shim shows the model the skill names, opens a skill only when the task
          needs it, calls a tool, and keeps the transcript on your computer.
        </p>
        <p>
          This page runs that loop so you can watch it. The default model is a stand-in with two
          fixed rules, so the demo needs no key and repeats the same steps. The switch further
          down can run the real Shim program instead.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {facts.map(([title, detail]) => (
            <div key={title} className="border border-border bg-muted/60 px-3 py-2">
              <dt className="font-medium">{title}</dt>
              <dd className="text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
