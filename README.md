# Homestead

A browser-based life-simulation game inspired by the classic 2000-era life sims:
autonomous characters driven by needs, smart objects that advertise their uses,
careers, relationships, and a build-your-own-house sandbox — all running
client-side in the browser.

## Documentation

| Doc | What's in it |
|---|---|
| [docs/GAME_PLAN.md](docs/GAME_PLAN.md) | Design & scope: the what and why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical spec: modules, schemas, contracts |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Task-level backlog (M0–M6) with IDs & acceptance criteria |
| [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) | Running list of every image/texture needed (size + generation description) |

## Getting started

```bash
pnpm install
pnpm dev        # launches the client at http://localhost:5173
pnpm test       # sim unit + determinism tests
pnpm typecheck
pnpm build
```

## Repo layout

- `packages/sim` — headless, deterministic simulation engine (no DOM, no rendering deps)
- `packages/client` — PixiJS isometric renderer + UI; runs the sim in a Web Worker
- `docs/` — plans, architecture, asset manifest

## Status

Milestone 0 (foundations): iso lot rendering, camera, click-to-walk pathfinding,
worker-based deterministic sim loop with speed controls. See the development
plan for what's next (M1: needs, autonomy, and the first eight objects).
