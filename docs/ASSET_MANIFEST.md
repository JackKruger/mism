# Homestead — Asset Manifest (running doc)

> **Purpose:** every image/texture the game needs, with exact size and a
> generation-ready description. The game currently runs on programmatic
> placeholders; drop a final PNG at the listed path and it replaces the
> placeholder with no code change (paths are wired via this manifest's IDs).
>
> **Process rule:** any task that adds a new placeholder MUST add a row here
> in the same commit. Status: `placeholder` (procedural stand-in in code),
> `spec` (needed soon, nothing in code yet), `final` (real asset delivered).
>
> **Global style guide for generation:** clean 2D isometric game art,
> dimetric 2:1 projection (tiles are 64×32 px diamonds), soft top-left
> sunlight, saturated-but-cozy palette, crisp edges, transparent background
> (PNG, no anti-aliased halo against white). No text baked into images.
> Multi-frame sheets are laid out in a horizontal strip unless stated.

## 1. Terrain & ground (Milestone 0)

| ID | Path | Size (px) | Frames | Description | Status |
|---|---|---|---|---|---|
| `terrain.grass_a` | `packages/client/public/assets/terrain/grass_a.png` | 64×32 | 1 | Isometric floor-tile diamond of tidy mowed lawn grass, mid green, very subtle blade texture, flat top-down lighting, seamless when tiled edge-to-edge with itself and `grass_b` | placeholder |
| `terrain.grass_b` | `packages/client/public/assets/terrain/grass_b.png` | 64×32 | 1 | Variant of `grass_a`, 4% darker and slightly different texture noise, used as checker alternate so the grid reads | placeholder |
| `terrain.tile_hover` | `packages/client/public/assets/terrain/tile_hover.png` | 64×32 | 1 | Tile cursor: crisp white diamond outline, 2 px stroke, 40% opacity soft white fill, gentle outer glow — overlays the hovered tile | placeholder |
| `terrain.tile_blocked` | `packages/client/public/assets/terrain/tile_blocked.png` | 64×32 | 1 | Same as `tile_hover` but red stroke/fill — shown when hovering an unwalkable target | placeholder |

## 2. Characters (Milestone 0–1)

Character frames are 64×96 px (feet baseline at y=88, centered x=32) so heads
overlap the tile behind them correctly. Facing directions: **SE, SW, NE, NW**
(SE = toward lower-right). Sheets: one PNG per animation per facing,
horizontal strip.

| ID | Path | Size (px) | Frames | Description | Status |
|---|---|---|---|---|---|
| `char.base.idle_se` | `packages/client/public/assets/char/base/idle_se.png` | 128×96 (2×64) | 2 | Adult person, neutral build, simple casual outfit (teal shirt, dark trousers), standing relaxed facing screen lower-right; 2-frame idle sway (weight shift + blink). Style: friendly stylized proportions (~5 heads tall), clean shapes, readable at 50% zoom | placeholder |
| `char.base.idle_sw` | `.../idle_sw.png` | 128×96 | 2 | Same, facing lower-left | placeholder |
| `char.base.idle_ne` | `.../idle_ne.png` | 128×96 | 2 | Same, facing upper-right (back three-quarter view) | placeholder |
| `char.base.idle_nw` | `.../idle_nw.png` | 128×96 | 2 | Same, facing upper-left (back three-quarter view) | placeholder |
| `char.base.walk_se` | `.../walk_se.png` | 512×96 (8×64) | 8 | Same character, 8-frame walk cycle facing lower-right, relaxed everyday gait, arms swinging naturally, contact-down-passing-up timing | placeholder |
| `char.base.walk_sw` | `.../walk_sw.png` | 512×96 | 8 | Walk cycle facing lower-left | placeholder |
| `char.base.walk_ne` | `.../walk_ne.png` | 512×96 | 8 | Walk cycle facing upper-right | placeholder |
| `char.base.walk_nw` | `.../walk_nw.png` | 512×96 | 8 | Walk cycle facing upper-left | placeholder |
| `char.shadow` | `packages/client/public/assets/char/shadow.png` | 48×24 | 1 | Soft elliptical ground shadow blob, black at 30% opacity, heavily blurred edge | placeholder |
| `char.select_marker` | `packages/client/public/assets/char/select_marker.png` | 32×40 | 1 | Floating selection marker above the active character's head: faceted emerald-green crystal spinner (our own shape — a rounded teardrop gem, NOT a plumbob copy), subtle inner glow | placeholder |

## 3. UI (Milestone 0–1)

| ID | Path | Size (px) | Frames | Description | Status |
|---|---|---|---|---|---|
| `ui.icon_pause` | `packages/client/public/assets/ui/icon_pause.png` | 32×32 | 1 | Pause icon, two rounded vertical bars, warm off-white on transparent, slight bottom-right drop shadow | placeholder |
| `ui.icon_speed1` | `.../icon_speed1.png` | 32×32 | 1 | Single right-pointing rounded play triangle, same style | placeholder |
| `ui.icon_speed3` | `.../icon_speed3.png` | 32×32 | 1 | Double play triangles | placeholder |
| `ui.icon_speed10` | `.../icon_speed10.png` | 32×32 | 1 | Triple play triangles | placeholder |
| `ui.panel_bg` | `.../panel_bg.png` | 9-slice 48×48 (16 px corners) | 1 | UI panel background: deep blue-slate rounded rectangle, soft inner bevel, 92% opacity — 9-slice safe (uniform corners) | spec |
| `ui.toast_bg` | `.../toast_bg.png` | 9-slice 32×32 (10 px corners) | 1 | Toast/notification background: deep blue-slate rounded pill, thin light border, 94% opacity — 9-slice safe (currently a styled DOM div) | spec |

## 4. Needs & mood icons (Milestone 1 — spec ahead of build)

All 40×40 px, single frame, consistent icon family: filled pictogram, warm
off-white on transparent, 3 px rounded stroke feel, readable at 20×20.

| ID | Path | Description | Status |
|---|---|---|---|
| `ui.need_hunger` | `packages/client/public/assets/ui/needs/hunger.png` | Fork and knife crossed over a plate | spec |
| `ui.need_energy` | `.../energy.png` | Crescent moon with one z-sparkle | spec |
| `ui.need_comfort` | `.../comfort.png` | Cozy armchair side view | spec |
| `ui.need_fun` | `.../fun.png` | Beach ball with star burst | spec |
| `ui.need_social` | `.../social.png` | Two overlapping chat bubbles | spec |
| `ui.need_hygiene` | `.../hygiene.png` | Bar of soap with two bubbles | spec |
| `ui.need_bladder` | `.../bladder.png` | Water drop with motion ticks | spec |
| `ui.need_room` | `.../room.png` | House outline with sparkle inside | spec |

## 5. Objects (Milestone 1 — spec, added as C-10x tasks start)

Object sprites: one PNG per rotation per state. Sizes depend on footprint —
a 1×1-tile object renders inside 64×80 (base diamond + up to 48 px height);
2×1 objects inside 96×96. Exact per-object sizes will be added when each
object task begins; the eight M1 objects (fridge, counter, stove, toilet,
shower, bed, sofa, TV) will each get rows here with per-rotation
descriptions.

| ID | Path | Size (px) | Frames | Description | Status |
|---|---|---|---|---|---|
| _(pending C-101…C-110)_ | | | | | |

Until these rows land, placed objects render as procedural isometric prisms
(stable per-defId pastel color, darker SW face / lighter SE face, drawn in
`packages/client/src/render/objectView.ts`) pending per-object art.

---

### Changelog
- **2026-07-15** — Client M1 slice: added `ui.toast_bg` spec (§3); noted procedural prism placeholders for objects (§5).
- **2026-07-14** — Initial manifest: M0 terrain/character/UI placeholders, M1 needs-icon specs.
