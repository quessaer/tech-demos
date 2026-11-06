import type { Note, ToolKind } from "./types.ts"
import { remoteToolName } from "./tools.ts"

export const SHIM_VERSION = "0.1.0"

export type ShimAsset = {
  file: string
  binaryName: string
  sha256: string
}

const ASSETS: Record<string, ShimAsset> = {
  "linux-x64": {
    file: "shim_linux_amd64.tar.gz",
    binaryName: "shim_linux_amd64",
    sha256: "a0a47e730d047ae1e4bd05156c75593b584ba47c4ab82063fc86f9a0df9536d2",
  },
  "linux-arm64": {
    file: "shim_linux_arm64.tar.gz",
    binaryName: "shim_linux_arm64",
    sha256: "ce8144b44697f55376ba2ffbf2c2c03d5bd0fb1ae00b7721dddbd176dac8e309",
  },
}

export function shimAsset(platform: string, arch: string): ShimAsset | null {
  const key = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : ""
  if (platform !== "linux" || !key) return null
  return ASSETS[`linux-${key}`] ?? null
}

export function shimDownloadUrl(asset: ShimAsset): string {
  return `https://github.com/Balanov/shim/releases/download/v${SHIM_VERSION}/${asset.file}`
}

export type ShimConfig = {
  version: 1
  language: "en"
  permissions: "auto"
  default_model: "lab"
  models: {
    name: "lab"
    provider: "custom"
    api: "openai" | "anthropic"
    base_url: string
    model: string
    api_key_env?: string
  }[]
  mcp_servers: {
    lab: {
      command: string
      args: string[]
      env: { SHIM_LAB_TOOL: string; SHIM_LAB_NOTES: string }
    }
  }
}

export function buildShimConfig(input: {
  baseUrl: string
  model: string
  api: "openai" | "anthropic"
  apiKeyEnv?: string
  tool: ToolKind
  notes: Note[]
  runtimePath: string
  mcpScript: string
}): ShimConfig {
  const model: ShimConfig["models"][number] = {
    name: "lab",
    provider: "custom",
    api: input.api,
    base_url: input.baseUrl,
    model: input.model,
  }
  if (input.apiKeyEnv) model.api_key_env = input.apiKeyEnv
  return {
    version: 1,
    language: "en",
    permissions: "auto",
    default_model: "lab",
    models: [model],
    mcp_servers: {
      lab: {
        command: input.runtimePath,
        args: [input.mcpScript],
        env: {
          SHIM_LAB_TOOL: remoteToolName(input.tool),
          SHIM_LAB_NOTES: JSON.stringify(input.notes),
        },
      },
    },
  }
}
