import { validSkillName } from "./skills.ts"
import type { RunRequest, Skill } from "./types.ts"

export function prepareRun(request: Pick<RunRequest, "task" | "skills">): {
  task: string
  skills: Skill[]
} {
  const task = request.task.trim()
  if (!task) throw new Error("Write a task first.")
  const skills = request.skills
    .filter((skill) => skill.enabled)
    .map((skill) => ({
      name: skill.name.trim(),
      description: skill.description.trim(),
      body: skill.body.trim(),
    }))
  if (skills.length < 1 || skills.length > 2) {
    throw new Error("Enable one or two skills.")
  }
  for (const skill of skills) {
    if (!validSkillName(skill.name)) {
      throw new Error(
        `"${skill.name || "empty"}" is not a valid skill name. Use lowercase letters, digits, hyphens, or underscores.`,
      )
    }
    if (!skill.description) {
      throw new Error(
        `Skill ${skill.name} needs a description. That is the only text the model sees until it loads the skill.`,
      )
    }
    if (!skill.body) throw new Error(`Skill ${skill.name} needs instructions.`)
  }
  if (new Set(skills.map((skill) => skill.name)).size !== skills.length) {
    throw new Error("The two skills need different names.")
  }
  return { task, skills }
}
