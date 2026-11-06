# Shim harness lab

One page that shows how a harness like [Shim](https://github.com/Balanov/shim) runs a task: a model endpoint, one or two Agent Skills, one MCP tool, and a step-by-step trace.

```bash
bun install
bun run dev
```

`bun test` covers the stand-in loop. `bun run build` typechecks and builds.

The default engine is a faithful re-creation and needs no API key. **Use the real Shim CLI** downloads the official v0.1.0 Linux binary on first use, runs it in a temporary workspace, and shows that process's session log. OpenAI, Anthropic, and a loopback OpenAI-compatible endpoint are optional. Keys stay in this browser.
