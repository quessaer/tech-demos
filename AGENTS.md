# Agent rules

This repository is a sticky monorepo of small tech demos. One app per pick. Never create a new repository.

## Where to write

- Only add or update files under `apps/<kebab-slug>/`.
- You may also update the apps table in `README.md` and `tracking/seen-bookmarks.json`.
- Leave the rest of the repo alone.

## How an app is shaped

- Each app is self-contained. It does not import from other apps.
- From that app's folder, `bun install && bun run dev` starts it.
- Plan first. Follow `skills/project-planning/SKILL.md` and write `apps/<slug>/PLAN.md` before building.
- Use Bun as the runtime, package manager, and script runner.
- Start from an official scaffold via `bunx create-*` (`create-vite`, `create-next-app`, `create-t3-app`, `create-tanstack`, `create-expo`).
- Before any `bun install` or `bun add`, the app must have a root `bunfig.toml` with:

```toml
[install]
minimumReleaseAge = 259200
```

- For UI, use shadcn/ui with a minimalist preset. Add components with `bunx shadcn@latest add <component>` as needed.

## Pull requests

- Every pull request must attach at least one screenshot and at least one video of the running app.
- Never create a new repository for a demo. Open the pull request in this repo.
