---
name: verify
description: Build, launch, and drive the Homestead client in headless Chromium to verify changes end-to-end.
---

# Verifying Homestead

## Build & serve

```bash
pnpm install
pnpm build                                   # typecheck + vite build
cd packages/client && pnpm preview --port 4173 --strictPort &   # serves dist/
```

Dev server alternative: `pnpm dev` (port 5173, no build needed).

## Drive (headless Chromium)

Playwright is NOT a repo dependency; install `playwright-core` in the
scratchpad and launch the pre-installed browser:

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:4173/");
```

## Flows worth driving

- **Boot:** wait ~2.5 s, screenshot; HUD `#clock` should read "Day 1 — 07:00".
- **Sim speed:** at speed 1 the clock advances 1 sim-min per real second;
  `page.keyboard.press("Space")` pauses (clock freezes); button
  `[data-speed='10']` ≈ 10 min/sec. Read `#clock` before/after sleeps.
- **Walk:** `page.mouse.click(x, y)` on a tile sends the Folk walking;
  compare screenshots ~1 s apart. Clicking again mid-walk re-plans.
- **Camera:** mouse down-move-up = pan (no walk command if moved > 6 px);
  `page.mouse.wheel(0, -200)` = zoom step.

## Gotchas

- Headless software GL reports ~18 fps and "GPU stall due to ReadPixels"
  warnings — environment noise, not a regression.
- One 404 in the console at boot is expected: the texture loader probes for
  final art (docs/ASSET_MANIFEST.md paths) and falls back to procedural
  placeholders.
- Sim-only changes are faster to check headless: `pnpm --filter @homestead/sim test`
  covers determinism; but still drive the client for anything user-visible.
