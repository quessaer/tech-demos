# Shim harness lab

## Goal

Show one person how a Shim-shaped agent harness runs a task: a model endpoint, lazy Agent Skills, one MCP tool, and a step-by-step trace.

## Single-user MVP

One page. The visitor reads a plain-language panel about what Shim is, picks a model endpoint, registers one or two `SKILL.md` skills and one mock MCP tool, then runs a natural-language task. The trace shows the skill catalog (names and descriptions only), each `load_skill`, each MCP call with arguments and result, and the final answer. Three presets fill the form.

The default model is a deterministic stand-in, so the page runs with no API key. Optional endpoints are OpenAI, Anthropic, and an OpenAI-compatible server on localhost. The key stays in `localStorage` and is sent only for that run.

Optional second engine: the official Shim v0.1.0 CLI. A Vite middleware shells out to the Linux binary (downloaded on first use, checksum-checked, cached under `.shim-bin/`). It writes a throwaway workspace and config, points Shim at the same stand-in model or the chosen endpoint, and serves a newline JSON-RPC MCP process for the selected tool. The trace is Shim's session JSONL. API keys are process environment variables, never written into Shim's config. This mode is labeled as the real binary. The default engine is labeled as a faithful re-creation.

### Out of scope

Chat history, skill install from GitHub, real third-party MCP servers, shell or file writes, permission prompts, sessions resume, accounts, and a hosted backend.

## Tasks

1. Scaffold the Vite app and render the explainer plus an empty trace.
2. Presets, skill editors, and the MCP tool picker produce a run request.
3. The stand-in loop loads at most one matching skill, calls the mock tool, and renders the trace.
4. Optional live endpoints run the same loop against OpenAI, Anthropic, or a loopback OpenAI-compatible URL.
5. Optional real-CLI mode returns a trace parsed from Shim's JSONL session.
6. Unit-test skill parsing, the stand-in planner, both tools, and JSONL trace parsing.

## Stack

- Vite + React + TypeScript via `bunx create-vite` — one screen; a framework router would not remove any wiring.
- shadcn/ui Lyra preset — the same minimalist component set as the other demo, restyled as a cool instrument bench so the two apps are not copies.
- Bun — runtime, package manager, and `bun test` for the harness core.
- In-process stand-in loop — same shape as Shim's agent (`internal/agent`): catalog in the prompt, `load_skill` on demand, then a namespaced MCP tool, bounded steps. No extra agent framework.
- Hand-rolled arithmetic parser and notebook search — the tools are the demo; `eval` and a math package are the wrong dependency.
- Newline JSON-RPC MCP process — matches Shim's stdio client. The MCP SDK speaks a wider protocol than this bridge needs.
- Official `shim` v0.1.0 static binary — verified locally: `load_skill` then `mcp_lab_calculator` returned `Total: 762` through a mock OpenAI server. Go on this machine is 1.22, and Shim asks for 1.25, so the bridge uses the release binary instead of a source build.

## Layout

- `src/harness/` — types, skill parser, tools, stand-in planner, live turn parsing, session-JSONL parser. No React.
- `src/components/` — explainer, setup form, trace.
- `src/lib/storage.ts` — API key in `localStorage`.
- `server/bridge.ts` — binary cache, temp workspace, Shim invocation, model allowlist. Run by Bun from the Vite dev server.
- `server/mcp-stdio.ts` — the one mock MCP server Shim spawns.
- `src/App.tsx` — one screen.

## Testing and hooks

`bun test` covers frontmatter parsing, lazy prompt text, calculator, notebook search, preset traces, unused-skill laziness, and a real Shim JSONL fixture. No git hooks. `lint` stays the scaffold's oxlint. `bun run build` must pass.

## After the first slice

The presets run in the browser. The official v0.1.0 Linux binary also ran through the dev-server bridge: `load_skill`, then `mcp_lab_calculator` with `4 * 180 + 42`, answer `Total: 762`, trace read from the session JSONL. Real CLI mode stays optional and off by default. The page does not wait on a download.

## Deferred

- Streaming tokens, cancellation, and session resume — one finished trace is the demo.
- Confirm-each-tool permission mode — Shim's `ask` mode waits on a terminal; `--yes` in a temp workspace is enough to show the loop.
- Installing skills from GitHub and attaching arbitrary MCP servers — the visitor edits two local skills and one mock tool.
- Shell and workspace file tools — they are part of real Shim, and a live model might call them inside the temp workspace; the lab does not offer them as buttons.
