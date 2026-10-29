import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatPercent, formatTime } from "../lib/format.ts"
import type { LogEntry } from "../lib/storage.ts"

interface ShadowLogProps {
  entries: LogEntry[]
  onClear: () => void
  onSelect: (entry: LogEntry) => void
}

export function ShadowLog({ entries, onClear, onSelect }: ShadowLogProps) {
  return (
    <Card className="xl:sticky xl:top-4 xl:max-h-[calc(100svh-2rem)]">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Shadow log</CardTitle>
            <CardDescription>
              {entries.length === 0
                ? "Decisions stay in this browser."
                : `${entries.length} saved locally`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={entries.length === 0}
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">
            Each route is appended here so you can compare them. Nothing is uploaded in local mode.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="w-full border border-border px-2.5 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => onSelect(entry)}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground">{entry.decision.action}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatPercent(entry.decision.confidence)}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-muted-foreground">
                    {entry.input.goal}
                  </span>
                  <span className="mt-1 flex justify-between gap-2 text-muted-foreground">
                    <span>
                      {entry.decision.engine === "local" ? "local" : entry.decision.model}
                    </span>
                    <span className="tabular-nums">{formatTime(entry.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
