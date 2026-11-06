# Jev Decision Lab

## Goal

Show, on one screen, how a System One model routes an agent step: a typed action, a confidence score, and a probability distribution, instead of a chat reply.

## Single-user MVP

One local page. Fill in a goal, task type, optional last error, retry count, and a cache-hit toggle. Press Route. See the chosen action, a confidence bar, and the distribution. A shadow log on the right remembers decisions in `localStorage`. Preset buttons load scenarios worth showing.

The default engine is deterministic local rules, so the demo runs with zero keys. An optional "Use live TypeSafe" toggle plus an API key field (memory and `localStorage` only) calls `POST https://api.typesafe.ai/v1/systemone` through a thin adapter. The dev server proxies that call so the browser is not blocked by CORS.

### Out of scope

Real agent integration, multi-agent orchestration, billing UX, auth, and a backend.

## Tasks

1. Scaffold the Vite app and render an empty lab shell.
2. Form and preset buttons produce a route input.
3. Local rules return a typed decision; the result panel shows the action, confidence, and probabilities.
4. Shadow log appends each decision, survives refresh, and clears.
5. Live toggle sends the same input through the TypeSafe Choice adapter and renders the same panel.
6. Unit-test the local rules only.

## Stack

- Vite + React + TypeScript via `bunx create-vite` — one screen, no server routes; Next.js would add a framework this demo does not use.
- shadcn/ui Lyra preset — minimalist, sharp controls without a custom design system.
- Bun — runtime, package manager, and `bun test` for the rules engine.
- Ordered local rules plus a fixed distribution — same fields as a Jev Choice (`choice`, `probabilities`, `confidence`) with no key. Confidence uses TypeSafe’s published formula.
- `fetch` to `POST /v1/systemone` — the request and Choice response are documented; the official SDK targets Node and is unnecessary in the browser.
- Vite dev proxy — forwards `/api/typesafe` to `https://api.typesafe.ai` so live mode works from `bun run dev`.

## Layout

- `src/engine/` — types, presets, pure `decideLocal`.
- `src/adapters/` — `DecisionEngine` interface, local adapter, TypeSafe HTTP adapter.
- `src/components/` — route form, decision panel, shadow log.
- `src/lib/storage.ts` — log and API key in `localStorage`.
- `src/App.tsx` — one screen that wires them.

## Testing and hooks

`bun test` covers action selection, probability sums, the published Choice confidence formula, and determinism. No git hooks; the app's `lint` script is the scaffold's oxlint.

## After the first slice

The form, local decision, and shadow log run end to end. The Choice-shaped result is enough for the screen, so Score and Noul stay deferred. Live mode stays a thin `POST /v1/systemone` call through the Vite proxy.

## Deferred

- Wiring this into a real agent loop — the demo stops at the decision.
- Score and Noul questions — the route is one Choice.
- Accounts, saved keys on a server, billing — single user, key stays in the browser.
- Calibration charts and batch evals — not needed to show one decision.
