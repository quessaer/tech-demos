# tech-demos

A daily playground of small, single-user demos. Each app tries a technology picked from an X bookmark. One app per pick, in this repo.

## Apps

| App | Pick | What it shows |
| --- | --- | --- |
| [jev-decision-lab](apps/jev-decision-lab/) | [TypeSafe Jev](https://x.com/Mahaximus_/status/2114720998679363705) | A one-screen agent router. It returns a typed action, a confidence score, and a probability distribution. Local rules run with no API key; live Jev is optional. |

Run a demo from its own folder:

```bash
cd apps/jev-decision-lab
bun install && bun run dev
```
