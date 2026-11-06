import { executeCall } from "./plan.ts"
import { systemPrompt } from "./skills.ts"
import { toolSchema } from "./tools.ts"
import {
  LAB_LABEL,
  type ModelMessage,
  type ProviderKind,
  type Skill,
  type ToolKind,
  type Trace,
  type TraceStep,
} from "./types.ts"

export type Completion = {
  text: string
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[]
}

type OpenAIToolCall = {
  id?: string
  function?: { name?: string; arguments?: string }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function toolDefinitions(tool: ToolKind) {
  const schema = toolSchema(tool)
  return [
    {
      name: "load_skill",
      description:
        "Load the full instructions for an available skill by name. Skills are listed in the system prompt.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Skill name" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
    },
  ]
}

export function openAIPayload(input: {
  model: string
  skills: Skill[]
  tool: ToolKind
  messages: ModelMessage[]
}) {
  const tools = toolDefinitions(input.tool).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
  return {
    model: input.model,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt(input.skills) },
      ...input.messages.map((message) => ({
        role: message.role,
        content: message.content ?? "",
        tool_call_id: message.tool_call_id,
        tool_calls: message.tool_calls?.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      })),
    ],
    tools,
  }
}

export function anthropicPayload(input: {
  model: string
  skills: Skill[]
  tool: ToolKind
  messages: ModelMessage[]
}) {
  const tools = toolDefinitions(input.tool).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }))
  const converted: { role: "user" | "assistant"; content: string | Record<string, unknown>[] }[] =
    input.messages.map((message) => {
    if (message.role === "assistant" && message.tool_calls?.length) {
      const content: Record<string, unknown>[] = []
      if (message.content) content.push({ type: "text", text: message.content })
      for (const call of message.tool_calls) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        })
      }
      return { role: "assistant" as const, content }
    }
    if (message.role === "tool") {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id,
            content: message.content ?? "",
          },
        ],
      }
    }
    return {
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.content ?? "",
    }
  })
  const messages: typeof converted = []
  for (const message of converted) {
    const last = messages[messages.length - 1]
    if (
      last &&
      last.role === message.role &&
      Array.isArray(last.content) &&
      Array.isArray(message.content)
    ) {
      last.content.push(...message.content)
      continue
    }
    messages.push(message)
  }
  return {
    model: input.model,
    max_tokens: 1024,
    system: systemPrompt(input.skills),
    messages,
    tools,
  }
}

export function parseOpenAICompletion(payload: unknown): Completion {
  const record = asRecord(payload)
  const choices = Array.isArray(record.choices) ? record.choices : []
  const choice = asRecord(choices[0])
  const message = asRecord(choice.message)
  const text = typeof message.content === "string" ? message.content : ""
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  const toolCalls = rawCalls.map((item, index) => {
    const call = item as OpenAIToolCall
    return {
      id: call.id || `call_${index + 1}`,
      name: call.function?.name || "tool",
      arguments: asRecord(call.function?.arguments),
    }
  })
  return { text, toolCalls }
}

export function parseAnthropicCompletion(payload: unknown): Completion {
  const record = asRecord(payload)
  const content = Array.isArray(record.content) ? record.content : []
  let text = ""
  const toolCalls: Completion["toolCalls"] = []
  for (const item of content) {
    const block = asRecord(item)
    if (block.type === "text" && typeof block.text === "string") text += block.text
    if (block.type === "tool_use") {
      toolCalls.push({
        id: typeof block.id === "string" ? block.id : `call_${toolCalls.length + 1}`,
        name: typeof block.name === "string" ? block.name : "tool",
        arguments: asRecord(block.input),
      })
    }
  }
  return { text, toolCalls }
}

export function parseCompletion(provider: ProviderKind, payload: unknown): Completion {
  if (provider === "anthropic") return parseAnthropicCompletion(payload)
  return parseOpenAICompletion(payload)
}

export function providerError(payload: unknown): string | null {
  const record = asRecord(payload)
  if (typeof record.error === "string") return record.error
  const nested = asRecord(record.error)
  if (typeof nested.message === "string") return nested.message
  return null
}

export async function runLive(input: {
  task: string
  skills: Skill[]
  tool: ToolKind
  provider: Exclude<ProviderKind, "mock">
  model: string
  complete: (payload: unknown) => Promise<unknown>
}): Promise<Trace> {
  const messages: ModelMessage[] = [{ role: "user", content: input.task }]
  const steps: TraceStep[] = [
    {
      kind: "catalog",
      skills: input.skills.map((skill) => ({ name: skill.name, description: skill.description })),
    },
  ]
  let answer = ""

  for (let step = 0; step < 6; step += 1) {
    const payload =
      input.provider === "anthropic"
        ? anthropicPayload({
            model: input.model,
            skills: input.skills,
            tool: input.tool,
            messages,
          })
        : openAIPayload({
            model: input.model,
            skills: input.skills,
            tool: input.tool,
            messages,
          })
    const response = await input.complete(payload)
    const failure = providerError(response)
    if (failure && !asRecord(response).choices && !asRecord(response).content) {
      throw new Error(failure)
    }
    const completion = parseCompletion(input.provider, response)
    if (completion.toolCalls.length === 0) {
      answer = completion.text.trim() || "The model returned an empty answer."
      steps.push({ kind: "answer", text: answer })
      break
    }
    messages.push({
      role: "assistant",
      content: completion.text,
      tool_calls: completion.toolCalls,
    })
    for (const call of completion.toolCalls) {
      const result = executeCall(call.name, call.arguments, input.skills, input.tool)
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
      messages.push({ role: "tool", tool_call_id: call.id, content: result })
    }
  }

  if (!answer) {
    answer = "The live model stopped after the step limit."
    steps.push({ kind: "answer", text: answer })
  }

  return {
    engine: "lab",
    engineLabel: `${LAB_LABEL} Live ${input.provider} model, still the lab harness.`,
    steps,
    answer,
  }
}

export function defaultModel(provider: ProviderKind): string {
  if (provider === "anthropic") return "claude-sonnet-4-5"
  if (provider === "openai") return "gpt-4o-mini"
  if (provider === "compatible") return "local"
  return "lab-stand-in"
}
