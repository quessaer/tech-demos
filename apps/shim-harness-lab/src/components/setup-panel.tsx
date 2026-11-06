import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { PRESETS } from "@/harness/presets.ts"
import { toolSchema } from "@/harness/tools.ts"
import type { Endpoint, EngineKind, ProviderKind, SkillDraft, ToolKind } from "@/harness/types.ts"

type ShimStatus = { ok: boolean; reason?: string; version?: string } | null

type SetupPanelProps = {
  task: string
  skills: SkillDraft[]
  tool: ToolKind
  endpoint: Endpoint
  engine: EngineKind
  presetId: string | null
  shimStatus: ShimStatus
  pending: boolean
  error: string | null
  onTask: (value: string) => void
  onSkills: (skills: SkillDraft[]) => void
  onTool: (tool: ToolKind) => void
  onEndpoint: (endpoint: Endpoint) => void
  onEngine: (engine: EngineKind) => void
  onPreset: (id: string) => void
  onRun: () => void
}

const providers: { value: ProviderKind; label: string }[] = [
  { value: "mock", label: "Stand-in model (no key)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "compatible", label: "OpenAI-compatible on localhost" },
]

export function SetupPanel(props: SetupPanelProps) {
  const schema = toolSchema(props.tool)
  const realDisabled = props.shimStatus !== null && !props.shimStatus.ok

  function updateSkill(index: number, patch: Partial<SkillDraft>) {
    props.onSkills(props.skills.map((skill, skillIndex) => (skillIndex === index ? { ...skill, ...patch } : skill)))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Model endpoint</CardTitle>
          <CardDescription>
            The stand-in follows two written rules: load the skill whose description shares words
            with the task, then call the one tool. A calculator call uses the first three numbers
            as nights × rate + extra, unless you typed an expression. It is not a neural net.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Endpoint</Label>
            <Select
              value={props.endpoint.provider}
              onValueChange={(value) => {
                if (!value) return
                props.onEndpoint({ ...props.endpoint, provider: value as ProviderKind })
              }}
            >
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {props.endpoint.provider !== "mock" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="model">Model name</Label>
                <Input
                  id="model"
                  value={props.endpoint.model}
                  onChange={(event) => props.onEndpoint({ ...props.endpoint, model: event.target.value })}
                />
              </div>
              {props.endpoint.provider === "compatible" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="base-url">Base URL</Label>
                  <Input
                    id="base-url"
                    value={props.endpoint.baseUrl}
                    onChange={(event) =>
                      props.onEndpoint({ ...props.endpoint, baseUrl: event.target.value })
                    }
                    placeholder="http://127.0.0.1:11434/v1"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="api-key">API key</Label>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  value={props.endpoint.apiKey}
                  onChange={(event) =>
                    props.onEndpoint({ ...props.endpoint, apiKey: event.target.value })
                  }
                  placeholder={props.endpoint.provider === "compatible" ? "Optional for localhost" : "Stored in this browser only"}
                />
                <p className="text-muted-foreground">
                  The key stays in localStorage on this machine. A real Shim run passes it as an
                  environment variable and does not write it into the config file.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3 border border-border px-3 py-2">
            <div>
              <Label htmlFor="real-shim">Use the real Shim CLI</Label>
              <p className="mt-1 text-muted-foreground">
                {props.shimStatus?.ok
                  ? `Optional. First run downloads the official v${props.shimStatus.version ?? "0.1.0"} Linux binary into this app folder and runs it in a temporary workspace.`
                  : (props.shimStatus?.reason ?? "Checking whether this machine can run the official binary.")}
              </p>
            </div>
            <Switch
              id="real-shim"
              checked={props.engine === "shim"}
              disabled={realDisabled}
              onCheckedChange={(checked) => props.onEngine(checked ? "shim" : "lab")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent skills</CardTitle>
          <CardDescription>
            One or two SKILL.md files. The model is shown the name and description. The
            instructions load only if a step calls load_skill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.skills.map((skill, index) => (
            <fieldset key={index} className="space-y-2 border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <legend className="px-1 text-xs font-medium">Skill {index + 1}</legend>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`skill-on-${index}`}>{skill.enabled ? "Included" : "Off"}</Label>
                  <Switch
                    id={`skill-on-${index}`}
                    checked={skill.enabled}
                    onCheckedChange={(checked) => updateSkill(index, { enabled: checked })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`skill-name-${index}`}>Name</Label>
                <Input
                  id={`skill-name-${index}`}
                  value={skill.name}
                  disabled={!skill.enabled}
                  onChange={(event) => updateSkill(index, { name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`skill-description-${index}`}>Description</Label>
                <Input
                  id={`skill-description-${index}`}
                  value={skill.description}
                  disabled={!skill.enabled}
                  onChange={(event) => updateSkill(index, { description: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`skill-body-${index}`}>Instructions</Label>
                <Textarea
                  id={`skill-body-${index}`}
                  value={skill.body}
                  rows={4}
                  disabled={!skill.enabled}
                  onChange={(event) => updateSkill(index, { body: event.target.value })}
                />
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP tool</CardTitle>
          <CardDescription>
            One mock server named lab. Shim would expose it as {schema.name}. The notebook is
            three fixed lines in this demo, not your disk. The calculator only does arithmetic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tool">Tool</Label>
            <Select
              value={props.tool}
              onValueChange={(value) => {
                if (value === "calculator" || value === "file_search") props.onTool(value)
              }}
            >
              <SelectTrigger id="tool" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calculator">Calculator</SelectItem>
                <SelectItem value="file_search">Notebook search</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <pre className="overflow-x-auto border border-border bg-muted/50 p-3 text-[11px] leading-5">
            {JSON.stringify(
              { name: schema.name, description: schema.description, parameters: schema.parameters },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

export function TaskCard(props: SetupPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Task</CardTitle>
        <CardDescription>Presets fill the skills, the tool, and the question.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant={props.presetId === preset.id ? "default" : "outline"}
              data-testid={`preset-${preset.id}`}
              onClick={() => props.onPreset(preset.id)}
            >
              {preset.title}
            </Button>
          ))}
        </div>
        {props.presetId ? (
          <p className="text-muted-foreground">
            {PRESETS.find((preset) => preset.id === props.presetId)?.blurb}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="task">Ask in plain language</Label>
          <Textarea
            id="task"
            data-testid="task"
            value={props.task}
            rows={3}
            onChange={(event) => props.onTask(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" data-testid="run-task" disabled={props.pending || !props.task.trim()} onClick={props.onRun}>
            {props.pending ? "Running…" : "Run task"}
          </Button>
          <Badge variant="secondary">{props.engine === "shim" ? "Real Shim CLI" : "Lab re-creation"}</Badge>
        </div>
        {props.error ? (
          <p role="alert" className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
            {props.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
