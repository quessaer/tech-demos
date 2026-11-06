const STORAGE_KEY = "shim-harness-lab:keys"

export function loadKeys(): Record<string, string> {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const keys: Record<string, string> = {}
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") keys[name] = value
    }
    return keys
  } catch {
    return {}
  }
}

export function saveKey(provider: string, apiKey: string): void {
  if (typeof localStorage === "undefined") return
  const keys = loadKeys()
  keys[provider] = apiKey
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}
