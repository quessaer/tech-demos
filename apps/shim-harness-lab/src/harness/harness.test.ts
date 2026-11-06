import { describe, expect, test } from "bun:test"
import { anthropicPayload, openAIPayload, parseOpenAICompletion, runLive } from "./live.ts"
import { planTurn, runLab } from "./plan.ts"
import { clonePreset, PRESETS } from "./presets.ts"
import { prepareRun } from "./prepare.ts"
import { traceFromSession } from "./session.ts"
import { buildShimConfig, shimAsset } from "./shim-config.ts"
import { composeSkill, parseSkillMarkdown, skillCatalogPrompt, validSkillName } from "./skills.ts"
import { evaluateExpression, searchNotes } from "./tools.ts"
import { upstreamFor } from "./upstream.ts"
import type { Skill } from "./types.ts"

const secret = "Do not invent a code."

function enabledSkills(id: string): Skill[] {
  const preset = clonePreset(id)
  if (!preset) throw new Error(id)
  return prepareRun(preset).skills
}

describe("skills", () => {
  test("frontmatter sets the name and description and leaves the body out of the catalog", () => {
    const skill = parseSkillMarkdown(composeSkill(enabledSkills("door")[0]!), "fallback")
    expect(skill.name).toBe("note-finder")
    expect(skill.description).toContain("door code")
    expect(skill.body).toContain(secret)
    const prompt = skillCatalogPrompt([skill])
    expect(prompt).toContain("note-finder")
    expect(prompt).not.toContain(secret)
  })

  test("unclosed frontmatter is rejected", () => {
    expect(() => parseSkillMarkdown("---\nname: trip-budget\nhello")).toThrow(/unclosed/)
  })

  test("skill names match Shim's rule", () => {
    expect(validSkillName("trip-budget")).toBe(true)
    expect(validSkillName("Trip")).toBe(false)
    expect(validSkillName("../etc")).toBe(false)
    expect(validSkillName("")).toBe(false)
  })
})

describe("tools", () => {
  test("calculator evaluates the Lisbon fare", () => {
    expect(evaluateExpression("4 * 180 + 42")).toBe(762)
    expect(evaluateExpression("(2 + 3) * 4")).toBe(20)
  })

  test("calculator rejects letters and division by zero", () => {
    expect(() => evaluateExpression("4 * alert(1)")).toThrow(/number|unexpected/)
    expect(() => evaluateExpression("1 / 0")).toThrow(/zero/)
  })

  test("notebook search finds the door code and rejects paths", () => {
    expect(searchNotes(
      [
        { path: "notes/keys.md", text: "The studio door code is 4419." },
        { path: "notes/packing.md", text: "Bring the EU plug adapter." },
      ],
      "studio door code",
    )).toBe("notes/keys.md: The studio door code is 4419.")
    expect(searchNotes([], "../secrets")).toMatch(/^Error:/)
  })
})

describe("stand-in loop", () => {
  test("Lisbon preset loads the budget skill, calls the calculator, and reports the total", () => {
    const preset = clonePreset("lisbon")!
    const { task, skills } = prepareRun(preset)
    const trace = runLab({ task, skills, tool: preset.tool })
    expect(trace.engine).toBe("lab")
    expect(trace.steps.map((step) => step.kind)).toEqual([
      "catalog",
      "load_skill",
      "tool",
      "answer",
    ])
    const loaded = trace.steps.find((step) => step.kind === "load_skill")
    const tool = trace.steps.find((step) => step.kind === "tool")
    expect(loaded && loaded.kind === "load_skill" && loaded.name).toBe("trip-budget")
    expect(loaded && loaded.kind === "load_skill" && loaded.body).toContain("Total:")
    expect(tool && tool.kind === "tool" && tool.name).toBe("mcp_lab_calculator")
    expect(tool && tool.kind === "tool" && tool.arguments).toEqual({ expression: "4 * 180 + 42" })
    expect(tool && tool.kind === "tool" && tool.result).toBe("762")
    expect(trace.answer).toBe("Total: 762")
    expect(trace.engineLabel).toContain("not the Shim binary")
  })

  test("two registered skills leave the unused body unloaded", () => {
    const preset = clonePreset("lazy")!
    const { task, skills } = prepareRun(preset)
    const trace = runLab({ task, skills, tool: preset.tool })
    const catalog = trace.steps.find((step) => step.kind === "catalog")
    expect(catalog && catalog.kind === "catalog" && catalog.skills.map((skill) => skill.name)).toEqual([
      "trip-budget",
      "note-finder",
    ])
    const loads = trace.steps.filter((step) => step.kind === "load_skill")
    expect(loads).toHaveLength(1)
    expect(loads[0]?.kind === "load_skill" && loads[0].name).toBe("note-finder")
    const dumped = JSON.stringify(trace.steps)
    expect(dumped).toContain("4419")
    expect(dumped).not.toContain("Multiply the nights")
    expect(trace.answer).toContain("notes/keys.md")
    expect(trace.answer).toContain("4419")
  })

  test("a task that matches nothing does not load a skill", () => {
    const preset = clonePreset("lisbon")!
    const { skills } = prepareRun(preset)
    const trace = runLab({
      task: "Tell me a joke about pencils.",
      skills,
      tool: "calculator",
    })
    expect(trace.steps.some((step) => step.kind === "load_skill")).toBe(false)
    expect(trace.answer).toContain("no skill was loaded")
  })

  test("every preset runs to an answer", () => {
    for (const preset of PRESETS) {
      const prepared = prepareRun(preset)
      const trace = runLab({ ...prepared, tool: preset.tool })
      expect(trace.answer.length).toBeGreaterThan(0)
    }
  })
})

describe("providers and shim shape", () => {
  test("the OpenAI payload lists skill names and hides the body", () => {
    const skills = enabledSkills("door")
    const payload = openAIPayload({
      model: "gpt-4o-mini",
      skills,
      tool: "file_search",
      messages: [{ role: "user", content: "What is the studio door code?" }],
    })
    const system = payload.messages[0]?.content ?? ""
    expect(system).toContain("note-finder")
    expect(system).not.toContain(secret)
    expect(payload.tools.map((tool) => tool.function.name)).toEqual([
      "load_skill",
      "mcp_lab_file_search",
    ])
  })

  test("Anthropic tools use input_schema and merge tool results", () => {
    const skills = enabledSkills("lisbon")
    const payload = anthropicPayload({
      model: "claude-sonnet-4-5",
      skills,
      tool: "calculator",
      messages: [
        { role: "user", content: "Price it" },
        {
          role: "assistant",
          tool_calls: [{ id: "a", name: "load_skill", arguments: { name: "trip-budget" } }],
        },
        { role: "tool", tool_call_id: "a", content: "instructions" },
        { role: "tool", tool_call_id: "b", content: "second" },
      ],
    })
    expect(payload.tools[0]?.input_schema.required).toEqual(["name"])
    const userTurns = payload.messages.filter((message) => message.role === "user")
    const toolTurn = userTurns.find((message) => Array.isArray(message.content))
    expect(Array.isArray(toolTurn?.content) && toolTurn.content).toHaveLength(2)
  })

  test("a scripted live model still records load_skill before the answer", async () => {
    const skills = enabledSkills("door")
    const trace = await runLive({
      task: "What is the studio door code?",
      skills,
      tool: "file_search",
      provider: "openai",
      model: "gpt-4o-mini",
      complete: async (payload) => {
        const messages = (payload as { messages: { role: string }[] }).messages
        const loaded = messages.some((message) => message.role === "tool")
        if (!loaded) {
          return {
            choices: [
              {
                message: {
                  content: "",
                  tool_calls: [
                    {
                      id: "call_skill",
                      function: {
                        name: "load_skill",
                        arguments: JSON.stringify({ name: "note-finder" }),
                      },
                    },
                  ],
                },
              },
            ],
          }
        }
        return { choices: [{ message: { content: "notes/keys.md: The studio door code is 4419." } }] }
      },
    })
    expect(trace.steps.some((step) => step.kind === "load_skill")).toBe(true)
    expect(trace.answer).toContain("4419")
    expect(trace.engine).toBe("lab")
  })

  test("OpenAI tool arguments parse back into an object", () => {
    const completion = parseOpenAICompletion({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "call_calc",
                function: { name: "mcp_lab_calculator", arguments: "{\"expression\":\"4 * 180 + 42\"}" },
              },
            ],
          },
        },
      ],
    })
    expect(completion.toolCalls[0]?.arguments).toEqual({ expression: "4 * 180 + 42" })
  })

  test("a real Shim session log becomes the same trace shape", () => {
    const lines = [
      { role: "user", content: "Price 4 nights at 180 plus a 42 train" },
      {
        role: "assistant",
        tool_calls: [{ id: "call_skill", name: "load_skill", arguments: { name: "trip-budget" } }],
      },
      {
        role: "tool",
        content: "---\nname: trip-budget\n---\nMultiply the nights.\n",
        tool_call_id: "call_skill",
      },
      {
        role: "assistant",
        tool_calls: [
          { id: "call_calc", name: "mcp_lab_calculator", arguments: { expression: "4 * 180 + 42" } },
        ],
      },
      { role: "tool", content: "762", tool_call_id: "call_calc" },
      { role: "assistant", content: "Total: 762" },
    ]
    const trace = traceFromSession(lines, [{ name: "trip-budget", description: "Estimate a trip." }])
    expect(trace.engine).toBe("shim")
    expect(trace.steps.map((step) => step.kind)).toEqual(["catalog", "load_skill", "tool", "answer"])
    const tool = trace.steps.find((step) => step.kind === "tool")
    expect(tool && tool.kind === "tool" && tool.via).toBe("mcp")
    expect(tool && tool.kind === "tool" && tool.result).toBe("762")
    expect(trace.answer).toBe("Total: 762")
  })

  test("Shim config names the key variable and does not store the key", () => {
    const config = buildShimConfig({
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      api: "openai",
      apiKeyEnv: "OPENAI_API_KEY",
      tool: "calculator",
      notes: [],
      runtimePath: "/usr/bin/bun",
      mcpScript: "/app/server/mcp-stdio.ts",
    })
    const dumped = JSON.stringify(config)
    expect(config.models[0]?.api_key_env).toBe("OPENAI_API_KEY")
    expect(dumped).not.toContain("sk-")
    expect(config.mcp_servers.lab.env.SHIM_LAB_TOOL).toBe("calculator")
    expect(shimAsset("linux", "x64")?.sha256).toHaveLength(64)
    expect(shimAsset("darwin", "arm64")).toBeNull()
  })

  test("the model proxy only allows official hosts and loopback", () => {
    expect(upstreamFor({ provider: "openai" }).url).toBe(
      "https://api.openai.com/v1/chat/completions",
    )
    expect(
      upstreamFor({ provider: "compatible", baseUrl: "http://127.0.0.1:11434/v1" }).url,
    ).toBe("http://127.0.0.1:11434/v1/chat/completions")
    expect("error" in upstreamFor({ provider: "compatible", baseUrl: "https://example.com/v1" })).toBe(
      true,
    )
  })

  test("the stand-in asks for the calculator only after the skill result exists", () => {
    const skills = enabledSkills("lisbon")
    const first = planTurn({
      task: "4 nights at 180 and a 42 train",
      skills,
      tool: "calculator",
      messages: [],
    })
    expect(first.type).toBe("tool")
    if (first.type !== "tool") return
    const second = planTurn({
      task: "4 nights at 180 and a 42 train",
      skills,
      tool: "calculator",
      messages: [
        { role: "assistant", tool_calls: first.calls },
        { role: "tool", tool_call_id: first.calls[0]!.id, content: "Total: <amount>" },
      ],
    })
    expect(second.type).toBe("tool")
    if (second.type !== "tool") return
    expect(second.calls[0]?.name).toBe("mcp_lab_calculator")
  })
})
