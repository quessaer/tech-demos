import type { SkillDraft, ToolKind } from "./types.ts"

export type Preset = {
  id: string
  title: string
  blurb: string
  task: string
  tool: ToolKind
  skills: SkillDraft[]
}

const tripBudget: SkillDraft = {
  name: "trip-budget",
  description:
    "Estimate a trip cost from nights, a nightly rate, and an extra fare such as a train. Use the calculator.",
  body: "Multiply the nights by the nightly rate, then add the extra fare.\nReport one line: Total: <amount>.",
  enabled: true,
}

const noteFinder: SkillDraft = {
  name: "note-finder",
  description:
    "Find a note in the lab notebook, such as a door code, packing list, or cafe. Use file-search and quote the matching line.",
  body: "Search the notebook with the words from the question.\nQuote the matching file and line. Do not invent a code.",
  enabled: true,
}

export const PRESETS: Preset[] = [
  {
    id: "lisbon",
    title: "Lisbon weekend",
    blurb: "One skill, then the calculator.",
    task: "Price a Lisbon weekend: 4 nights at 180 dollars and a 42 dollar train.",
    tool: "calculator",
    skills: [tripBudget, { ...noteFinder, enabled: false }],
  },
  {
    id: "door",
    title: "Studio door code",
    blurb: "One skill, then a notebook search.",
    task: "What is the studio door code?",
    tool: "file_search",
    skills: [{ ...tripBudget, enabled: false }, noteFinder],
  },
  {
    id: "lazy",
    title: "Two skills, one loaded",
    blurb: "Both names are listed. Only the matching skill is opened.",
    task: "What is the studio door code?",
    tool: "file_search",
    skills: [tripBudget, noteFinder],
  },
]

export function clonePreset(id: string): Preset | undefined {
  const preset = PRESETS.find((item) => item.id === id)
  if (!preset) return undefined
  return {
    ...preset,
    skills: preset.skills.map((skill) => ({ ...skill })),
  }
}
