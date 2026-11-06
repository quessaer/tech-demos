import { composeSkill } from "./skills.ts"
import {
  contentTokens,
  expressionFromTask,
  mcpToolName,
  queryFromTask,
  runMockTool,
} from "./tools.ts"
import {
  LAB_LABEL,
  type ModelMessage,
  type ModelTurn,
  type Note,
  type Skill,
  type ToolKind,
  type Trace,
  type TraceStep,
} from "./types.ts"

export function scoreSkill(task: string, skill: Skill): number {
  const taskTokens = new Set(contentTokens(task))
  const skillTokens = contentTokens(`${skill.name.replaceAll("-", " ")} ${skill.description}`)
  const seen = new Set<string>()
  let score = 0
  for (const token of skillTokens) {
    if (seen.has(token)) continue
    seen.add(token)
    if (taskTokens.has(token)) score += 1
  }
  return score
}

export function bestSkill(task: string, skills: Skill[]): Skill | null {
  let winner: { skill: Skill; score: number } | null = null
  for (const skill of skills) {
    const score = scoreSkill(task, skill)
    if (score > 0 && (!winner || score > winner.score)) winner = { skill, score }
  }
  return winner?.skill ?? null
}

function priorCalls(messages: ModelMessage[]): { name: string; result?: string }[] {
  const calls: { name: string; id: string; result?: string }[] = []
  for (const message of messages) {
    if (message.role !== "assistant" || !message.tool_calls) continue
    for (const call of message.tool_calls) {
      const result = messages.find(
        (item) => item.role === "tool" && item.tool_call_id === call.id,
      )
      calls.push({ name: call.name, id: call.id, result: result?.content })
    }
  }
  return calls
}

export function answerFromSkill(skillText: string, result: string): string {
  const trimmed = result.trim()
  if (trimmed.startsWith("Error:") || trimmed.startsWith("No note")) {
    return `The tool failed. ${trimmed}`
  }
  if (/total:/i.test(skillText) && /^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return `Total: ${trimmed}`
  }
  if (/quote/i.test(skillText)) return trimmed
  return trimmed
}

export function planTurn(input: {
  task: string
  skills: Skill[]
  tool: ToolKind
  messages: ModelMessage[]
}): ModelTurn {
  const calls = priorCalls(input.messages)
  const loaded = calls.find((call) => call.name === "load_skill")
  const toolName = mcpToolName(input.tool)
  const toolCall = calls.find((call) => call.name === toolName)
  const id = `call_${calls.length + 1}`

  if (!loaded) {
    const skill = bestSkill(input.task, input.skills)
    if (!skill) {
      return {
        type: "answer",
        text: "No skill description matched this task, so no skill was loaded.",
      }
    }
    return {
      type: "tool",
      calls: [{ id, name: "load_skill", arguments: { name: skill.name } }],
    }
  }

  if (loaded.result === undefined) {
    return { type: "answer", text: "The skill load did not return instructions." }
  }

  if (!toolCall) {
    if (input.tool === "calculator") {
      const expression = expressionFromTask(input.task) ?? ""
      return {
        type: "tool",
        calls: [{ id, name: toolName, arguments: { expression } }],
      }
    }
    return {
      type: "tool",
      calls: [{ id, name: toolName, arguments: { query: queryFromTask(input.task) } }],
    }
  }

  if (toolCall.result === undefined) {
    return { type: "answer", text: "The tool did not return a result." }
  }

  return { type: "answer", text: answerFromSkill(loaded.result, toolCall.result) }
}

export function executeCall(
  name: string,
  args: Record<string, unknown>,
  skills: Skill[],
  tool: ToolKind,
  notes?: Note[],
): string {
  if (name === "load_skill") {
    const skillName = String(args.name ?? "")
    const skill = skills.find((item) => item.name === skillName)
    if (!skill) return `Error: unknown skill ${skillName}`
    return composeSkill(skill)
  }
  if (name === mcpToolName(tool)) return runMockTool(tool, args, notes)
  return `Error: unknown tool ${name}`
}

export function runLab(input: {
  task: string
  skills: Skill[]
  tool: ToolKind
  notes?: Note[]
}): Trace {
  const messages: ModelMessage[] = [{ role: "user", content: input.task }]
  const steps: TraceStep[] = [
    {
      kind: "catalog",
      skills: input.skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
      })),
    },
  ]
  let answer = ""

  for (let step = 0; step < 6; step += 1) {
    const turn = planTurn({
      task: input.task,
      skills: input.skills,
      tool: input.tool,
      messages,
    })
    if (turn.type === "answer") {
      answer = turn.text
      steps.push({ kind: "answer", text: answer })
      break
    }
    const call = turn.calls[0]
    if (!call) break
    const result = executeCall(call.name, call.arguments, input.skills, input.tool, input.notes)
    if (call.name === "load_skill") {
      steps.push({
        kind: "load_skill",
        name: String(call.arguments.name ?? ""),
        body: result,
      })
    } else {
      steps.push({
        kind: "tool",
        name: call.name,
        arguments: call.arguments,
        result,
        via: call.name.startsWith("mcp_") ? "mcp" : "other",
      })
    }
    messages.push({ role: "assistant", tool_calls: [call] })
    messages.push({ role: "tool", tool_call_id: call.id, content: result })
  }

  if (!answer) {
    answer = "The stand-in stopped after the step limit."
    steps.push({ kind: "answer", text: answer })
  }

  return { engine: "lab", engineLabel: LAB_LABEL, steps, answer }
}
