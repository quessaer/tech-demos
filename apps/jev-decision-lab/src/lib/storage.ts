import type { Decision, RouteInput } from "../engine/types.ts"

const LOG_KEY = "jev-decision-lab:log"
const API_KEY = "jev-decision-lab:api-key"
const LIVE_KEY = "jev-decision-lab:live"
const LOG_LIMIT = 40

export interface LogEntry {
  id: string
  at: string
  input: RouteInput
  decision: Decision
}

export function loadLog(): LogEntry[] {
  return readJson<LogEntry[]>(LOG_KEY, []).filter(isLogEntry).slice(0, LOG_LIMIT)
}

export function saveLog(entries: LogEntry[]): void {
  writeJson(LOG_KEY, entries.slice(0, LOG_LIMIT))
}

export function loadApiKey(): string {
  return readString(API_KEY)
}

export function saveApiKey(apiKey: string): void {
  writeString(API_KEY, apiKey)
}

export function loadLive(): boolean {
  return readString(LIVE_KEY) === "1"
}

export function saveLive(live: boolean): void {
  writeString(LIVE_KEY, live ? "1" : "0")
}

function isLogEntry(value: LogEntry): boolean {
  return Boolean(value && typeof value.id === "string" && value.decision && value.input)
}

function readString(key: string): string {
  try {
    return localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function writeString(key: string, value: string): void {
  try {
    if (!value) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // The demo still works if the browser refuses storage.
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota and private-mode failures.
  }
}
