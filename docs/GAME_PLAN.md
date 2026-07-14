# Project Plan: "Homestead" — A Browser-Based Life Simulation Game (Sims 1 Clone)

> A full design + engineering plan for building a browser game that recreates the core
> gameplay loop of *The Sims* (2000): controlling a household of autonomous people,
> satisfying their needs, building their home, and growing their careers and relationships.
>
> **Legal note:** this is a *mechanics* clone. All names, art, sounds, and text must be
> original. No Maxis/EA assets, trademarks ("The Sims", "Simoleon", "SimCity"), or
> decompiled data may be used. Mechanics themselves are not copyrightable.

---

## 1. Vision & Scope

### 1.1 Elevator pitch
A single-player, isometric life simulator that runs entirely in the browser. You manage a
household of "Folks": keep their eight needs satisfied, earn money through careers, buy
objects that make life easier, build and decorate the house, and navigate friendships and
romance — all while the clock keeps ticking.

### 1.2 What made Sims 1 work (and what we must replicate)
1. **Needs-driven autonomy** — characters are utility-driven agents; the player nudges,
   the sim acts. The tension between "what I want them to do" and "what they need" *is*
   the game.
2. **Smart objects** — the genius of Sims 1: behavior lives in the *objects*, not the
   people. A fridge advertises "I satisfy Hunger"; the person just picks the best ad.
   This makes content scalable: adding an object adds gameplay.
3. **The money loop** — needs decay → job performance depends on need state → salary buys
   better objects → better objects satisfy needs faster → more free time for skills and
   friends → promotions require skills and friends. A perfect treadmill.
4. **Build/Buy mode as a second game** — half the audience played it as a dollhouse.
5. **Time pressure** — the sim day (1 game minute ≈ 1 real second at normal speed) forces
   constant triage.

### 1.3 In scope (v1.0)
- One residential lot, one controllable household (1–4 adults), isometric 2.5D view.
- 8 needs, autonomous behavior via the advertisement/utility model.
- Live mode with 3 speeds + pause; Build mode; Buy mode.
- ~60 objects across all rooms, ~10 careers with 10 levels each.
- Skills (6), relationships (daily/lifetime scores, friendship, romance stubs).
- NPCs: neighbors who visit, maid, pizza delivery, mail carrier, repair tech.
- Disasters-lite: fires, floods (broken plumbing), dead plants, rot/roaches.
- Save/load in browser (IndexedDB) + export/import save file.
- Original 2D art set, original music/SFX, "Folk-speak" gibberish voices.

### 1.4 Out of scope (v1.0) — candidates for later
- Children/aging, pets, multiple lots/neighborhood screen, multiplayer, user-generated
  content/modding, mobile touch UI (design for it, ship later), 3D rendering.

---

## 2. Core Game Design

### 2.1 Needs (Motives)
Eight motives, each a float in **[-100, +100]**:

| Motive   | Decays | Notes |
|----------|--------|-------|
| Hunger   | fast   | At -80 begins starvation warnings; death at -100 after grace period |
| Energy   | slow, faster when active | Sleep restores; collapse at -100 |
| Comfort  | medium | Restored by sitting/lying on quality furniture |
| Fun      | medium | Personality changes which objects give fun |
| Social   | slow   | Only restored by interactions with other characters |
| Hygiene  | slow   | Low hygiene applies Social interaction penalties |
| Bladder  | steady | At -100: accident → Hygiene crash + embarrassment |
| Room     | none (environmental) | Computed from surroundings: light, art, tidiness, mess |

- **Mood** = weighted sum of motives (weights skew: a starving character's mood is
  dominated by Hunger — use a "worst needs matter more" curve, i.e., weight each motive by
  how negative it is).
- Mood gates job performance, interaction outcomes, and skill-gain speed.
- Decay rates are per-character-tick constants modified by personality (e.g., Active
  characters lose Energy slower, gain Fun from exercise).

### 2.2 Personality
Five axes, 0–10, allocated at character creation from a fixed budget (25 points):
**Neat, Outgoing, Active, Playful, Nice.** Effects:
- Modifies autonomy scoring (Playful folks weight Fun ads higher).
- Modifies decay (Neat characters' Hygiene decays slower; Sloppy ones make messes).
- Gates/skews social interaction success tables.
- Affects skill learning speed (Playful → Creativity faster, Active → Body faster).

### 2.3 The Smart Object / Advertisement system (the heart of the game)
Every interactive object broadcasts **advertisements**:

```
Ad {
  interaction: "Fridge.HaveMeal",
  motiveDeltasAdvertised: { hunger: +65 },   // what it CLAIMS (can differ from actual)
  attenuation: distance falloff curve,
  personalityModifiers: { playful: 1.2 },
  requirements: [adultOnly, notBroken, canReach]
}
```

**Autonomy loop** (runs when a character is idle or re-plans):
1. Collect all reachable ads on the lot.
2. Score each: `score = Σ over motives ( adValue × currentNeedWeight(motive) )`
   where `currentNeedWeight` grows non-linearly as the motive gets low (a starving
   character values +10 Hunger far more than a full one).
3. Apply personality multipliers, distance attenuation, and a small random jitter
   (prevents robotic determinism).
4. Pick from the top 3 by weighted random (Sims-style "pretty good, not perfect" AI).
5. Queue the interaction; player-issued commands always outrank autonomous ones.

**Interactions are object-owned state machines.** Each interaction defines:
- Entry conditions, routing slot (where the character must stand/sit),
- A sequence of stages (animate, wait, loop-until-motive-threshold, spawn side effects
  like dirty dishes),
- Actual motive deltas applied per tick while running,
- Exit and interruption behavior (bladder emergency can interrupt TV, not shower).

This architecture means **new gameplay ships as data**: an object definition + sprites +
interaction scripts, no engine changes.

### 2.4 Time & simulation
- Clock: 1 sim-minute per real second at speed 1; speeds ×3 and ×10; pause (commands can
  still be queued while paused — essential Sims feel).
- Fixed-timestep simulation (e.g., 20 ticks/sec of *sim time*) decoupled from render.
- A sim-day is 24 min real time at speed 1. Carpool arrives 1 hour before shift; missing
  2 days of work = fired.

### 2.5 Economy, careers, bills
- Currency: **§** replaced with our own symbol (e.g., ₣ "Florins"). Starting funds:
  20,000 minus lot cost.
- **Careers:** 10 tracks (e.g., Culinary, Law Enforcement, Science, Arts, Business,
  Athletics, Medicine, Politics, Tech, Crime-analog "Fixer"). Each has 10 levels defined
  purely as data: `{ title, salary, hours, carpoolType, requiredSkills, requiredFriends }`.
- Promotion check on return from work: skills + friend count + mood-at-departure.
  Chance cards (small text events with pick-one outcomes) at ~10% per shift.
- **Bills** every 3 days, proportional to house value. Unpaid → repo agent takes objects.
- Depreciation: objects lose value daily after purchase, floor at 40%.

### 2.6 Skills
Six skills, 0–10, trained by objects/activities: **Cooking, Mechanical, Charisma, Body,
Logic, Creativity.** Training only progresses when relevant motives aren't critical.
Cooking < 2 + stove = fire risk. Mechanical governs repair success/electrocution risk.

### 2.7 Relationships & social interactions
- Per-pair **Daily** (-100..100, decays toward 0) and **Lifetime** (slow-moving average)
  scores. Friend threshold: Daily ≥ 50. Enemy: ≤ -50.
- Interaction menu on click-target-person: Talk, Joke, Compliment, Flirt, Kiss, Insult,
  Fight, Give Gift, Dance… Availability and success probability are functions of both
  characters' personality, mood, daily/lifetime scores, and recent-interaction memory.
- Conversations use **interest topics** (icon speech bubbles); mismatched interests make
  Talk less effective.
- NPCs: the neighborhood has a fixed cast of ~15 NPC households; NPCs walk by daily and
  can be invited in; phone allows Invite / Services / Pizza.

### 2.8 Build & Buy mode
- **Buy mode:** catalog by room and by function; place/rotate (4 directions)/move/sell
  objects; live placement validation (footprint, wall-adjacency, surface slots).
- **Build mode:** walls & diagonal walls, doors, windows, floor tiles, wallpapers,
  terrain paint, pools (stretch), single-story v1 (second story is v1.5). Wall cutaway
  views: Walls Up / Cutaway / Down / Roof.
- Undo stack for build/buy actions. Everything full-refund within the same pause session,
  else depreciated price.

### 2.9 Failure & drama systems
- **Fire:** low-cooking stove use, fireplaces near flammables. Fire spreads tile-to-tile;
  characters panic (drop queue, run, scream); extinguish autonomously if Brave-analog
  or call fire service via phone. Objects and characters can be destroyed.
- **Death:** starvation, fire, drowning (pool ladder removal — yes, we keep the meme),
  electrocution. A Reaper-analog NPC arrives; deceased leaves an urn/tombstone that
  causes Room penalties and ghost visits.
- **Breakage & mess:** plumbing floods, dirty dishes attract roaches → disease debuff.
  Maid/repair NPC services via phone at daily/hourly cost.

### 2.10 UI (recreating the classic layout, modernized)
- Bottom-left control panel: mode switch (Live/Buy/Build), speed controls, clock, funds.
- Character portraits row with mood bars; click to select; needs panel with 8 bars.
- Radial/pop-up **pie menu** on object click (the signature interaction affordance).
- Action queue displayed as icon chips (click to cancel — with the little wiggle).
- Job/Skills/Personality/Relationships tabs.
- Headline speech bubbles + "Folk-speak" gibberish audio; thought balloons for needs.

---

## 3. Technical Architecture

### 3.1 Stack
| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** (strict) | Refactor safety for a large sim codebase |
| Rendering | **PixiJS v8** (WebGL/WebGPU, Canvas fallback) | Best-in-class 2D sprite batching; isometric = sorted sprites |
| UI overlay | **Preact + HTM** (or Svelte) rendered as DOM above the canvas | Panels/menus/dialogs are much cheaper in DOM than in-canvas |
| State/sim | Custom ECS-lite (see below), zero framework | The sim is the product; keep it dependency-free & testable |
| Audio | Howler.js | Sprite-sheet SFX, music channels |
| Build | Vite + Vitest + ESLint + Prettier | Fast iteration, first-class TS |
| Saves | IndexedDB via `idb`, JSON schema-versioned; export/import as file | Offline-friendly |
| Deploy | Static hosting (GitHub Pages/Netlify/Cloudflare Pages), PWA manifest | No server needed for v1 |

### 3.2 Simulation core — deterministic and headless
**Golden rule: the simulation never touches the DOM or PixiJS.** It is a pure TS module:
`(state, commands, dt) → state'`, with a seeded RNG. Benefits:
- Runs in a **Web Worker** (keeps 60fps UI while simulating at ×10 speed).
- Fully unit-testable ("starving character with fridge available eats within N ticks").
- Deterministic replays from (seed + command log) → invaluable for bug reports.
- Future multiplayer/lockstep stays possible.

Entities & components (ECS-lite — typed component maps, systems as functions):
- `Person { needs, personality, skills, inventory, jobRef, queue }`
- `GameObject { defId, tile, rotation, state (clean/dirty/broken), owner }`
- `Lot { grid, walls, floors, rooms (flood-filled), pathfindGraph }`
- Systems (run order matters): `Clock → NeedsDecay → AdBroadcast → Autonomy →
  QueueExecutor → Interactions → Movement/Pathing → RoomScore → Economy → Events`.

### 3.3 World representation & pathfinding
- Lot = **64×64 tile grid**; walls live on tile *edges* (half-wall model like Sims).
- Rooms derived by flood fill over wall edges → used for Room score, light, fire spread.
- Pathfinding: A* over tile centers with wall-edge blocking + object footprints;
  route slots on objects define approach tiles & facing. Doors are edge portals.
  Re-path on world edits (build mode dirties the nav graph regionally).

### 3.4 Rendering (isometric 2.5D)
- Classic 2:1 dimetric projection, tile 64×32 px.
- Depth sort: `sortKey = (x + y) * K + layerBias` per sprite; multi-tile objects split
  into per-tile sprite slices to sort correctly (the standard iso trick).
- Wall cutaway = shader/texture swap per wall sprite based on camera mode.
- Characters: sprite sheets, 4 (later 8) facing directions; animation state machine
  (idle, walk, sit, carry, eat, sleep…). Use **DragonBones/Spine-style skeletal** export
  to sprite sheets if budget allows; otherwise hand-drawn frame animation at 12 fps.
- Zoom ×1/×2/×3 with crisp nearest-neighbor pixel-art scaling; camera pan with
  edge-scroll + drag + rotate later (v1: fixed rotation, matching Sims 1's 4 fixed views —
  ship with 1 view, add 4 in v1.5).

### 3.5 Content pipeline (data-driven everything)
- Object catalog = JSON/TS definitions validated by zod schemas:
  `{ id, name, price, footprint, slots, motiveRatings, ads[], interactions[], sprites }`.
- Interactions authored as **declarative state charts** (JSON) interpreted by the engine
  — our safe, simplified answer to Sims 1's SimAntics VM. Escape hatch: TS behavior
  functions registered by name for the 10% that's genuinely custom.
- Careers, chance cards, social interaction tables, NPC casts: pure data files.
- Localization-ready string tables from day one (en only at launch).

### 3.6 Save format
- Versioned JSON: `{ version, seed, clock, lot, objects[], people[], relationships,
  economy, eventLog }`. Migrations as pure functions `v(n) → v(n+1)`.
- Autosave every sim-day + manual slots (3). Export/import as `.homestead` file.

### 3.7 Performance budgets
- 60 fps render with ~2,500 sprites on a 2019 laptop; sim tick ≤ 4 ms at speed ×10 with
  4 people + 200 objects. Ad scoring is the hotspot → cache reachable-ad lists, dirty
  only on world change; re-score at most every N ticks per idle person.

---

## 4. Art, Audio & Content Plan

- **Art style:** clean pixel-art / hand-painted iso hybrid, original palette; deliberately
  NOT imitating Maxis's exact look. Tile 64×32. Character base + layered outfit tinting
  to multiply variety cheaply.
- **Asset list v1:** ~60 objects × 4 rotations × states; 2 character bodies × 8 heads ×
  6 outfits; walls/floors/doors/windows (~30 patterns); UI icon set (~120 icons);
  8 needs icons; pie-menu art.
- **Audio:** 3 music tracks per mode (Live/Buy/Build — the Buy/Build jazz vibe is core to
  the fantasy, commission original tracks), ~80 SFX, gibberish voice kit (record ~40
  short nonsense phrases per emotional flavor: happy/angry/sad/flirty).
- **Content creation order:** kitchen + bathroom + bedroom first (they close the survival
  loop), then living room (Fun/Social), then career/phone content, then decor.

---

## 5. Milestones & Roadmap

Estimates assume 1–2 developers; each milestone ends in a playable build deployed to
static hosting.

### M0 — Foundations (2 weeks)
Vite/TS/PixiJS scaffold; iso grid rendering; camera pan/zoom; tile picking; worker-based
sim loop skeleton with clock and speed controls; CI (lint, typecheck, tests) + auto-deploy.
**Exit:** walk a placeholder character around an empty lot via click-to-move (A*).

### M1 — The Survival Loop (4 weeks) 🎯 *the make-or-break milestone*
Needs decay + mood; ad broadcast + autonomy scoring; interaction state machines; 8 core
objects (fridge, stove, counter, toilet, shower, bed, sofa, TV); queue UI; needs panel;
hunger/energy/bladder failure states.
**Exit:** a character left alone survives indefinitely in a furnished house; an
unfurnished house visibly kills them. *Playtest gate: is watching this fun?*

### M2 — Money & Careers (3 weeks)
Economy, buy mode (place/rotate/sell/catalog), 3 career tracks, carpool, bills + repo,
skills (Cooking/Mechanical) + skill objects, object breakage + repair, depreciation.
**Exit:** full treadmill loop playable: work → earn → buy → improve → promote.

### M3 — Build Mode (3 weeks)
Walls/doors/windows/floors/wallpaper, room detection, Room motive, wall cutaway modes,
undo, architecture costs.
**Exit:** build a house from an empty lot and live in it.

### M4 — People & Social (4 weeks)
Second/third household member, relationships, ~12 social interactions, conversations,
NPC visitors + phone (invite/services/pizza), Social motive fully live, maid + repair
NPCs, remaining 4 skills, 7 more careers.
**Exit:** make a friend, earn a promotion that requires one, throw a passable dinner.

### M5 — Drama & Polish (3 weeks)
Fire + fire service, death + reaper-analog + urns/ghosts, floods/roaches/disease,
chance cards, romance interactions, "move in" proposal, full 60-object catalog,
audio pass, Folk-speak, tutorials/onboarding, settings, save slots + export.
**Exit:** feature-complete beta.

### M6 — Beta hardening (2 weeks)
Perf profiling to budgets; save migration tests; balance pass (decay rates, prices,
salaries — spreadsheet-driven with sim-in-headless batch runs: run 100 automated
households overnight and chart survival/wealth curves); accessibility pass (keyboard
controls, colorblind-safe need bars, reduced-motion); PWA/offline; bug triage.
**Exit:** v1.0 public release. **Total: ~21 weeks.**

### Post-1.0 backlog (ordered)
Second story + roofs; 4 camera rotations; children & babies; more lots + neighborhood
screen; downloadable house sharing (export lot as file/URL); pets; modding API (the
data-driven object format is 80% of the way there); Steam wrapper via Electron/Tauri.

---

## 6. Testing Strategy

- **Unit:** motive math, ad scoring, promotion logic, pathfinding, save migrations —
  plain Vitest on the headless sim (no browser needed).
- **Simulation tests:** seeded scenario files ("hungry person + fridge → eats ≤ 30 sim-min";
  "no toilet for 12h → accident") run as fast-forwarded headless sims in CI.
- **Determinism test:** same seed + command log twice → identical state hash.
- **Balance harness:** batch headless runs with autonomous-only households; assert
  survival rates and produce CSV telemetry for tuning.
- **E2E smoke:** Playwright — boot, place object, enter build mode, save/load.
- **Playtests:** at each milestone exit; M1's "is it fun to watch" gate is a hard gate.

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Autonomy feels dumb/robotic | Kills the fantasy | It's M1, first thing built; copy Sims' top-3 weighted-random pick; heavy playtesting; tunable data |
| Art volume overwhelms schedule | Slips everything | Ruthless 60-object cap; tinting/palette swaps; buy stock iso packs as placeholders, replace incrementally |
| Iso depth-sorting edge cases | Chronic visual bugs | Adopt per-tile sprite slicing from day 1; regression screenshot tests |
| Perf at ×10 speed in browser | Game feels bad | Worker-based sim + budgets in §3.7 measured from M1 onward, not at the end |
| EA/legal attention | Project risk | Original name/art/audio/text everywhere; "inspired by classic life sims" positioning; no ripped data tables |
| Scope creep (it's The Sims…) | Never ships | This document is the scope contract; new ideas go to post-1.0 backlog only |

## 8. Immediate Next Steps
1. Approve/adjust this plan (esp. scope cuts in §1.3/§1.4 and stack in §3.1).
2. M0 kickoff: scaffold repo (Vite + TS + PixiJS + Vitest + CI + Pages deploy).
3. Spike (timeboxed 3 days): iso renderer + A* walk-to-click — validates the two
   riskiest technical foundations before committing to the schedule.
