import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ACTION_LABEL, ACTIONS, type Decision } from "../engine/types.ts"
import { barWidth, formatPercent, formatProbability } from "../lib/format.ts"

interface DecisionPanelProps {
  decision: Decision | null
  error: string | null
  pending: boolean
}

export function DecisionPanel({ decision, error, pending }: DecisionPanelProps) {
  const ranked = decision
    ? [...ACTIONS].sort(
        (left, right) => decision.probabilities[right] - decision.probabilities[left],
      )
    : []

  return (
    <Card aria-busy={pending}>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
        <CardDescription>
          A Choice, not a paragraph. The bar is confidence. The chart is the full distribution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p role="alert" className="border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-destructive">
            {error}
          </p>
        ) : null}

        {decision ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground tracking-[0.14em] uppercase">Chosen action</p>
                <Badge variant="secondary">
                  {decision.engine === "local" ? "local rules" : decision.model}
                </Badge>
              </div>
              <p className="text-3xl leading-none tracking-tight text-foreground">
                {decision.action}
              </p>
              <p>{ACTION_LABEL[decision.action]}</p>
              <p className="text-muted-foreground">{decision.rule}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <p className="text-muted-foreground">Confidence</p>
                <p className="tabular-nums">
                  {formatPercent(decision.confidence)}
                  <span className="ml-2 text-muted-foreground">
                    {formatProbability(decision.confidence)}
                  </span>
                </p>
              </div>
              <div
                className="h-2 bg-muted"
                role="meter"
                aria-label="Confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(decision.confidence * 100)}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: barWidth(decision.confidence) }}
                />
              </div>
              <p className="text-muted-foreground">
                How far the leading probability sits above an even split.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">Probabilities</p>
              <ul className="space-y-1.5">
                {ranked.map((action) => {
                  const probability = decision.probabilities[action]
                  const chosen = action === decision.action
                  return (
                    <li
                      key={action}
                      className="grid grid-cols-[minmax(0,8.5rem)_1fr_2.5rem] items-center gap-2"
                    >
                      <span className={chosen ? "text-foreground" : "text-muted-foreground"}>
                        {action}
                      </span>
                      <div className="h-1.5 bg-muted">
                        <div
                          className={
                            chosen
                              ? "h-full bg-primary transition-[width] duration-300"
                              : "h-full bg-foreground/30 transition-[width] duration-300"
                          }
                          style={{ width: barWidth(probability) }}
                        />
                      </div>
                      <span className="text-right tabular-nums">
                        {formatProbability(probability)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        ) : (
          <div className="space-y-2 border border-dashed border-border px-3 py-8 text-center">
            <p>No decision yet.</p>
            <p className="text-muted-foreground">
              Load a preset or fill the form, then press Route.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
