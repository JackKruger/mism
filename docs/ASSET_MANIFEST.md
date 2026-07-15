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
| `ui.pie_option_bg` | `.../pie_option_bg.png` | 9-slice 48×48 (16 px corners) | 1 | Pie-menu option bubble: dark blue-slate rounded bubble, subtle rim light along the top edge, thin light border, 94% opacity — 9-slice safe (currently a styled DOM button, U-104) | spec |

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

## 5. Objects (Milestone 1 — C-101…C-108)

Object sprites: **one PNG per rotation per state** — each row below stands
for 4 files, suffixed `_r0`…`_r3` (r0 = the object's rotation-0 facing,
front toward screen lower-right; r1–r3 rotate clockwise). Sizes by
footprint: 1×1-tile objects **64×96** (base diamond + up to 64 px height),
2×1 objects **96×112**. Anchor: footprint-origin tile's bottom diamond
corner at the image's bottom center.

| ID | Path (×4 rotations) | Size (px) | Frames | Description | Status |
|---|---|---|---|---|---|
| `obj.fridge_econocool.default` | `packages/client/public/assets/objects/fridge_econocool/default_r{0-3}.png` | 64×96 | 1 | Compact 2000s-era white refrigerator, rounded top, chrome handle, freezer door above fridge door, slight top-left highlight | placeholder |
| `obj.fridge_econocool.broken` | `.../fridge_econocool/broken_r{0-3}.png` | 64×96 | 1 | Same fridge with door ajar, small puddle at base, sad flickering interior light, sparks decal near hinge | placeholder |
| `obj.stove_sizzleworks.default` | `packages/client/public/assets/objects/stove_sizzleworks/default_r{0-3}.png` | 64×96 | 1 | Freestanding white-enamel gas range, four black burner grates, oven door with dark window, red control knobs along the front rail | placeholder |
| `obj.stove_sizzleworks.dirty` | `.../stove_sizzleworks/dirty_r{0-3}.png` | 64×96 | 1 | Same range with grease splatter around the burners and a crusted pot stain on the cooktop | placeholder |
| `obj.stove_sizzleworks.broken` | `.../stove_sizzleworks/broken_r{0-3}.png` | 64×96 | 1 | Same range with scorched black burner ring, thin smoke wisp, oven door hanging crooked | placeholder |
| `obj.counter_plainview.default` | `packages/client/public/assets/objects/counter_plainview/default_r{0-3}.png` | 64×96 | 1 | Plain kitchen counter module, warm oak cabinet base with one door and drawer, pale speckled laminate top with soft top-left sheen | placeholder |
| `obj.counter_plainview.dirty` | `.../counter_plainview/dirty_r{0-3}.png` | 64×96 | 1 | Same counter with crumbs, a smear stain, and a stack of unwashed plates on the worktop | placeholder |
| `obj.toilet_comfyflush.default` | `packages/client/public/assets/objects/toilet_comfyflush/default_r{0-3}.png` | 64×96 | 1 | Classic white porcelain toilet with tank, lid closed, chrome flush handle, gentle blue-white porcelain shading | placeholder |
| `obj.toilet_comfyflush.dirty` | `.../toilet_comfyflush/dirty_r{0-3}.png` | 64×96 | 1 | Same toilet with seat up, yellow-green grime ring, tiny stink squiggles rising | placeholder |
| `obj.toilet_comfyflush.broken` | `.../toilet_comfyflush/broken_r{0-3}.png` | 64×96 | 1 | Same toilet clogged and overflowing: water pooling at the base, tank lid askew | placeholder |
| `obj.shower_drenchmaster.default` | `packages/client/public/assets/objects/shower_drenchmaster/default_r{0-3}.png` | 64×96 | 1 | Corner shower stall, brushed-steel frame, frosted glass panels (silhouette-friendly), chrome shower head, shallow white tray base | placeholder |
| `obj.shower_drenchmaster.dirty` | `.../shower_drenchmaster/dirty_r{0-3}.png` | 64×96 | 1 | Same stall with soap-scum streaks on the glass and mildew spots along the tray edge | placeholder |
| `obj.shower_drenchmaster.broken` | `.../shower_drenchmaster/broken_r{0-3}.png` | 64×96 | 1 | Same stall with drooping shower head dripping, cracked glass star, small leak puddle outside the tray | placeholder |
| `obj.bed_dreamtime.default` | `packages/client/public/assets/objects/bed_dreamtime/default_r{0-3}.png` | 96×112 | 1 | Cozy double bed, honey-wood headboard at the far end, puffy sky-blue duvet neatly made, two white pillows, soft top-left light | placeholder |
| `obj.bed_dreamtime.dirty` | `.../bed_dreamtime/dirty_r{0-3}.png` | 96×112 | 1 | Same bed unmade: duvet thrown back in a rumpled diagonal, dented pillows, corner of sheet trailing to the floor | placeholder |
| `obj.sofa_sagfree.default` | `packages/client/public/assets/objects/sofa_sagfree/default_r{0-3}.png` | 96×112 | 1 | Two-seat loveseat, plump terracotta upholstery, rounded armrests, short wooden peg legs, seat cushions with a soft center crease | placeholder |
| `obj.tv_tubevision.default` | `packages/client/public/assets/objects/tv_tubevision/default_r{0-3}.png` | 64×96 | 1 | Chunky late-90s CRT television on a low black stand, dark curved screen (off, faint window reflection), silver brand-less front panel | placeholder |
| `obj.tv_tubevision.on` | `.../tv_tubevision/on_r{0-3}.png` | 64×96 | 1 | Same CRT with screen glowing cool blue-white, subtle scanline texture, light spill onto the stand | placeholder |
| `obj.tv_tubevision.broken` | `.../tv_tubevision/broken_r{0-3}.png` | 64×96 | 1 | Same CRT with static-snow screen, jagged crack across the glass, tiny spark burst at one corner | placeholder |

Until these rows land, placed objects render as procedural isometric prisms
(stable per-defId pastel color, darker SW face / lighter SE face, drawn in
`packages/client/src/render/objectView.ts`) pending per-object art.

---

### Changelog
- **2026-07-15** — U-104: added `ui.pie_option_bg` spec (§3) for the object pie-menu bubbles.
- **2026-07-15** — C-101…C-108: §5 filled in — all eight M1 objects × state variants (19 rows, 4 rotation files each); object sprite sizes finalized (1×1 → 64×96, 2×1 → 96×112).
- **2026-07-15** — Client M1 slice: added `ui.toast_bg` spec (§3); noted procedural prism placeholders for objects (§5).
- **2026-07-14** — Initial manifest: M0 terrain/character/UI placeholders, M1 needs-icon specs.
