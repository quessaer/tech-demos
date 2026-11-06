# Jev Decision Lab

One screen that routes a single agent step the way TypeSafe Jev does: a typed action, a confidence score, and a probability distribution.

```bash
bun install
bun run dev
```

`bun test` covers the local rules. `bun run build` typechecks and builds.

Local rules are the default and need no key. Turn on **Use live TypeSafe**, paste a key from the TypeSafe console, and Route calls `POST /v1/systemone` (`model: jev-latest`, one Choice question). The Vite dev server proxies `/api/typesafe` to `https://api.typesafe.ai`. The key stays in this browser.
