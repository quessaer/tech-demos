import type { ProviderKind } from "./types.ts"

export function upstreamFor(input: {
  provider: ProviderKind | string
  baseUrl?: string
}): { url: string } | { error: string } {
  if (input.provider === "openai") {
    return { url: "https://api.openai.com/v1/chat/completions" }
  }
  if (input.provider === "anthropic") {
    return { url: "https://api.anthropic.com/v1/messages" }
  }
  if (input.provider === "compatible") {
    const raw = input.baseUrl?.trim() ?? ""
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return {
        error: "Enter a loopback base URL, such as http://127.0.0.1:11434/v1.",
      }
    }
    const host = parsed.hostname
    const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1"
    if (!loopback || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      return {
        error: "The OpenAI-compatible endpoint must be http://127.0.0.1 or http://localhost.",
      }
    }
    const pathname = parsed.pathname.replace(/\/$/, "")
    return { url: `${parsed.origin}${pathname}/chat/completions` }
  }
  return { error: "Choose a model endpoint." }
}
