import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { PRESETS } from "../engine/presets.ts"
import {
  TASK_LABEL,
  TASK_TYPES,
  isTaskType,
  type RouteInput,
} from "../engine/types.ts"

interface RouteFormProps {
  input: RouteInput
  presetId: string | null
  live: boolean
  apiKey: string
  pending: boolean
  onChange: (input: RouteInput) => void
  onPreset: (id: string) => void
  onLive: (live: boolean) => void
  onApiKey: (apiKey: string) => void
  onRoute: () => void
}

export function RouteForm({
  input,
  presetId,
  live,
  apiKey,
  pending,
  onChange,
  onPreset,
  onLive,
  onApiKey,
  onRoute,
}: RouteFormProps) {
  const goalMissing = input.goal.trim().length === 0
  const keyMissing = live && apiKey.trim().length === 0
  const disabled = pending || goalMissing || keyMissing

  return (
    <Card>
      <CardHeader>
        <CardTitle>Route an agent step</CardTitle>
        <CardDescription>
          The same inputs a cheap router would see before it spends another model call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={presetId === preset.id ? "default" : "outline"}
                aria-pressed={presetId === preset.id}
                onClick={() => onPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!disabled) onRoute()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="goal">Agent goal</Label>
            <Textarea
              id="goal"
              value={input.goal}
              rows={3}
              placeholder="What the agent is trying to do"
              onChange={(event) => onChange({ ...input, goal: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-type">Task type</Label>
              <Select
                value={input.taskType}
                onValueChange={(value) => {
                  if (isTaskType(value)) onChange({ ...input, taskType: value })
                }}
              >
                <SelectTrigger id="task-type" className="w-full">
                  <SelectValue placeholder="Task type" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((taskType) => (
                    <SelectItem key={taskType} value={taskType}>
                      {TASK_LABEL[taskType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retries">Retry count</Label>
              <Input
                id="retries"
                type="number"
                min={0}
                step={1}
                value={input.retryCount}
                onChange={(event) =>
                  onChange({
                    ...input,
                    retryCount: event.target.value === "" ? 0 : Number(event.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="error">Last error</Label>
            <Input
              id="error"
              value={input.lastError}
              placeholder="Optional. Timeout, 403, patch failed…"
              onChange={(event) => onChange({ ...input, lastError: event.target.value })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border border-border px-2.5 py-2">
            <Label htmlFor="cache">Cache hit available</Label>
            <Switch
              id="cache"
              checked={input.cacheHitAvailable}
              onCheckedChange={(checked) =>
                onChange({ ...input, cacheHitAvailable: checked })
              }
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="live">Use live TypeSafe</Label>
                <p className="text-muted-foreground">
                  Off by default. Local rules need no key.
                </p>
              </div>
              <Switch id="live" checked={live} onCheckedChange={onLive} />
            </div>
            {live ? (
              <div className="space-y-1.5">
                <Label htmlFor="api-key">API key</Label>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  placeholder="Kept in this browser only"
                  onChange={(event) => onApiKey(event.target.value)}
                />
                <p className="text-muted-foreground">
                  Sent only to api.typesafe.ai, through the dev server, as a Choice
                  question to jev-latest. Never written to the repo.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-muted-foreground">
              {goalMissing
                ? "Add a goal to route."
                : keyMissing
                  ? "Add an API key, or turn live mode off."
                  : "Returns one action, a confidence, and the distribution."}
            </p>
            <Button type="submit" disabled={disabled}>
              {pending ? "Routing…" : "Route"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function EngineBadge({ live }: { live: boolean }) {
  return <Badge variant="outline">{live ? "Live TypeSafe" : "Local rules"}</Badge>
}
