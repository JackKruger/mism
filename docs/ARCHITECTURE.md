# Homestead — Technical Architecture Specification

> Companion to [`GAME_PLAN.md`](./GAME_PLAN.md) (design/scope) and
> [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) (task breakdown).
> This document defines *how the code is structured*: module boundaries, data
> schemas, runtime contracts, and the rules that keep the codebase healthy.

---

## 1. Architectural Principles

1. **Headless simulation.** The sim core (`packages/sim`) imports nothing from
   PixiJS, the DOM, or the UI. It is a pure state machine driven by ticks and
   commands. Enforced by ESLint `no-restricted-imports` + a dedicated
   `tsconfig` with `"lib": ["ES2022"]` (no `DOM`).
2. **Determinism.** All randomness flows through one seeded PRNG owned by the
   sim state. Identical `(seed, commandLog)` ⇒ identical state hash. No
   `Date.now()`, no `Math.random()`, no iteration over unordered structures
   inside sim code.
3. **Data-driven content.** Objects, interactions, careers, socials, chance
   cards, NPCs are JSON/TS data validated by zod schemas at build time.
   Engine code never special-cases a specific object id (registered behavior
   functions are the escape hatch, keyed by name in data).
4. **One-way data flow.** UI/renderer *read* sim snapshots and *send* commands.
   They never mutate sim state directly.
5. **Everything versioned.** Save schema, content schema, and worker protocol
   all carry version numbers with explicit migration paths.

---

## 2. Repository Layout (pnpm monorepo)

```
homestead/
├─ package.json                  # pnpm workspaces, scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .github/workflows/ci.yml      # lint + typecheck + test + build + deploy
├─ docs/                         # this folder
├─ packages/
│  ├─ sim/                       # ★ headless simulation engine (zero deps)
│  │  ├─ src/
│  │  │  ├─ core/                # ECS store, RNG, event bus, clock, scheduler
│  │  │  ├─ world/               # grid, walls, rooms, floodfill, nav graph
│  │  │  ├─ path/                # A*, route slots, portals, path cache
│  │  │  ├─ people/              # needs, mood, personality, skills, queue
│  │  │  ├─ autonomy/            # ad collection, scoring, choice
│  │  │  ├─ interactions/        # statechart interpreter + behavior registry
│  │  │  ├─ objects/             # object instances, state (dirty/broken), slots
│  │  │  ├─ social/              # relationships, social interaction resolution
│  │  │  ├─ economy/             # funds, bills, depreciation, repo
│  │  │  ├─ career/              # jobs, carpool, promotion, chance cards
│  │  │  ├─ events/              # fire, flood, death, roaches, disease
│  │  │  ├─ commands/            # command types + validation + appliers
│  │  │  ├─ save/                # serialize, deserialize, migrations
│  │  │  └─ index.ts             # createSim(), tick(), applyCommand(), snapshot()
│  │  └─ test/                   # unit + scenario tests
│  ├─ content/                   # ★ game data (no logic)
│  │  ├─ schemas/                # zod schemas for every content type
│  │  ├─ objects/*.json          # object catalog
│  │  ├─ interactions/*.json     # statecharts
│  │  ├─ careers/*.json
│  │  ├─ socials/*.json
│  │  ├─ chance-cards/*.json
│  │  ├─ npcs/*.json
│  │  ├─ strings/en.json         # all user-facing text
│  │  └─ build.ts                # validate + bundle → content.bundle.json
│  ├─ client/                    # ★ the browser app
│  │  ├─ src/
│  │  │  ├─ boot/                # asset preload, worker spawn, main loop
│  │  │  ├─ worker/              # sim-worker entry + protocol client
│  │  │  ├─ render/              # PixiJS: layers, iso, sprites, animation
│  │  │  │  ├─ iso/              # projection math, depth sort, tile picking
│  │  │  │  ├─ terrain/          # ground, floors
│  │  │  │  ├─ walls/            # wall sprites, cutaway modes
│  │  │  │  ├─ objects/          # object sprite views, state variants
│  │  │  │  ├─ chars/            # character animation state machines
│  │  │  │  └─ fx/               # bubbles, plumbob-analog marker, particles
│  │  │  ├─ input/               # pointer→tile/object/person hit testing, camera
│  │  │  ├─ ui/                  # Preact: panels, pie menu, catalogs, dialogs
│  │  │  ├─ audio/               # music/SFX manager (Howler)
│  │  │  ├─ persistence/         # IndexedDB slots, autosave, export/import
│  │  │  └─ app.tsx
│  │  └─ public/assets/          # spritesheets, audio, fonts
│  ├─ balance/                   # headless batch-run harness + CSV telemetry
│  └─ e2e/                       # Playwright smoke tests
└─ tools/
   ├─ atlas/                     # spritesheet packing pipeline
   └─ scenario-runner/           # CLI: run scenario file, assert outcomes
```

Dependency rule (enforced in CI via `dependency-cruiser`):

```
content ← sim ← client
         sim ← balance
   (content types shared via packages/content/schemas)
UI (client/ui) may not import from client/render internals; both talk via stores.
```

---

## 3. Simulation Core (`packages/sim`)

### 3.1 State model — ECS-lite

Not a full archetype ECS; a **typed component store** keyed by entity id.
Entities: `PersonId`, `ObjectId` (branded number types).

```ts
interface SimState {
  version: number;              // save schema version
  seed: RngState;               // xoshiro128** state, serializable
  clock: Clock;                 // tick, simMinute, day, weekday, speed
  lot: Lot;                     // grid, walls, floors, rooms, navVersion
  people: Store<Person>;
  objects: Store<ObjInstance>;
  relationships: RelMatrix;     // Map<pairKey, {daily, lifetime, flags}>
  household: Household;         // funds, bills, memberIds
  npcs: NpcDirectory;           // off-lot cast + visit scheduler state
  activeEvents: ActiveEvent[];  // fires, floods, deaths in progress
  eventLog: RingBuffer<SimEvent>; // for UI toasts & debugging (bounded)
}
```

`Store<T>` = `{ ids: Id[]; byId: Map<Id, T> }` with insertion-ordered ids
(ordered iteration ⇒ determinism).

### 3.2 Public API (the only surface the client sees)

```ts
createSim(config: { seed: number; content: ContentBundle; scenario?: Scenario }): SimHandle;

interface SimHandle {
  tick(n?: number): void;                       // advance n fixed ticks
  apply(cmd: Command): CommandResult;           // validate + enqueue/execute
  snapshot(): Readonly<SimSnapshot>;            // render-friendly view (see §5.3)
  serialize(): SaveFileV1;
  hashState(): string;                          // for determinism tests
  subscribe(listener: (events: SimEvent[]) => void): Unsub;
}
```

Fixed timestep: **1 tick = 3 sim-seconds** ⇒ 20 ticks per sim-minute ⇒ at
speed 1 (1 sim-min/real-sec) the worker runs 20 ticks/sec; ×3 → 60; ×10 → 200.
Tick budget: **≤ 2 ms mean, ≤ 4 ms p99** with reference load (4 people,
200 objects) so ×10 stays real-time.

### 3.3 System pipeline (fixed order, one pass per tick)

| # | System | Reads | Writes | Notes |
|---|--------|-------|--------|-------|
| 1 | `ClockSystem` | clock | clock | day rollover fires `NewDay` |
| 2 | `ScheduledEvents` | clock, npcs | activeEvents, spawns | carpool, mail, bills, visitors |
| 3 | `NeedsDecay` | people, activeInteraction | people.needs | decay tables × personality mods |
| 4 | `MoodSystem` | needs | person.mood | worst-needs-weighted curve (§3.5) |
| 5 | `AdBroadcast` | objects, lot | adCache | incremental; dirtied by world edits (§3.6) |
| 6 | `Autonomy` | idle people, adCache | person.queue | only for people with empty queue |
| 7 | `QueueExecutor` | queue | activeInteraction, path requests | pops next action, requests routing |
| 8 | `Movement` | paths | person.pos/facing | tile-to-tile, speed by animation |
| 9 | `InteractionRunner` | activeInteraction | needs, object state, spawns | statechart interpreter (§4) |
| 10 | `SocialResolver` | pending socials | relationships, needs | success tables |
| 11 | `RoomScore` | rooms, objects | roomScore per room | cached; dirtied by change |
| 12 | `HazardSystem` | activeEvents | spread, damage, panic | fire/flood tick |
| 13 | `EconomySystem` | clock, household | funds, bills, depreciation | daily hooks |
| 14 | `LifecycleSystem` | needs, events | death, ghosts | terminal states |
| 15 | `EventFlush` | eventLog | → subscribers | batch per tick |

### 3.4 Commands (the write API)

All player intent is a serializable command (this is also the replay log):

```ts
type Command =
  | { t: 'QueueInteraction'; person: PersonId; object: ObjectId; interaction: string }
  | { t: 'CancelQueued';     person: PersonId; queueIndex: number }
  | { t: 'SetSpeed';         speed: 0 | 1 | 3 | 10 }
  | { t: 'BuyObject';        defId: string; tile: Tile; rotation: Rot }
  | { t: 'MoveObject';       object: ObjectId; tile: Tile; rotation: Rot }
  | { t: 'SellObject';       object: ObjectId }
  | { t: 'BuildWall';        edges: WallEdge[] }        // drag = batch
  | { t: 'DemolishWall';     edges: WallEdge[] }
  | { t: 'PlaceFloor';       tiles: Tile[]; floorId: string }
  | { t: 'PlaceDoor' | 'PlaceWindow'; edge: WallEdge; defId: string }
  | { t: 'UsePhone';         person: PersonId; action: PhoneAction }
  | { t: 'AcceptChanceCard'; person: PersonId; choice: 0 | 1 }
  | { t: 'DebugCheat';       code: string };            // dev builds only

interface CommandResult { ok: boolean; error?: CommandError; undo?: Command }
```

Build/buy commands return an inverse `undo` command; the client keeps the
undo stack (sim stays stateless about UI concerns).

### 3.5 Needs & mood math (canonical formulas)

```
needs: each m ∈ [-100, +100]
decay: m -= baseDecay[m] * personalityMod * activityMod * dtMinutes
weight(m) = ((100 - m) / 200)^2            // 0 when full … 1 when empty, convex
mood = Σ moodWeight[m] * curve(m) / Σ moodWeight[m]   // curve maps -100..100 → -100..100,
                                                       // steeper below 0 ("pain hurts more")
adScore(person, ad) = Σ_m adValue[m] * weight(person.m) * persMult(person, ad)
                      * attenuation(dist) + jitter(rng, ±5%)
choice = weightedRandom(top3(scores))
```

All constants live in `content/tuning.json` — never inline in code — so the
balance harness can sweep them.

### 3.6 Advertisement cache

Naive scoring is `people × objects × interactions` per tick — wasteful.
Design:

- `AdIndex`: flat array of `{objectId, interactionId, motiveVec, flags}`
  rebuilt **only** when: object added/removed/moved, object state changes
  (broken/dirty), or a door/wall edit changes reachability (`lot.navVersion++`).
- Reachability: per-person room-graph BFS cached against `navVersion`.
- Autonomy runs for a person only when: queue empty AND
  (`ticksSinceLastPlan > 40` OR any motive crossed a threshold bucket).

### 3.7 Pathfinding

- Grid A* on tile centers; walls block edge crossings; object footprints
  block tiles; doors are passable edges.
- **Route slots**: each interaction declares required standing/sitting tiles
  + facing relative to the object (rotated with the object). Path target =
  nearest free slot; slots are reserved on approach to avoid two people
  claiming one chair.
- Path invalidation: on `navVersion` change, in-flight paths re-validate the
  next 2 tiles lazily (cheap) instead of global re-plan.
- Failure behavior: unreachable target ⇒ interaction fails with "wave arms"
  feedback event (the classic complaint stomp) and the ad is suppressed for
  that person for N minutes.

### 3.8 World / lot model

```ts
interface Lot {
  size: 64;                          // tiles per side (v1 fixed)
  floors: Uint16Array;               // floorId per tile (0 = none)
  terrain: Uint8Array;               // grass/dirt paint
  walls: Map<EdgeKey, Wall>;         // EdgeKey = (x,y,dir N|W) packed int
  rooms: RoomIndex;                  // floodfill result: roomId per tile,
                                     //   room → {tiles, doors, windows, score}
  navVersion: number;
}
```

- Walls live on the N and W edges of tiles (every edge has exactly one owner).
- Room floodfill runs incrementally on wall/door edits (only affected region).
- `RoomScore` inputs: base per room, + art/plants/lights ratings, − mess
  objects (dirty plates, puddles, ash, roaches), window daylight bonus
  (clock-dependent), corpse/urn penalty.

### 3.9 Fire & hazards (representative event system)

- Fire = set of burning tiles with intensity; each tick: damage object on
  tile, chance to ignite adjacent flammable tiles (flammability from object
  defs; walls slow spread).
- Person reaction: `Panic` interaction is force-pushed (priority > player
  commands); Brave-stat check allows `Extinguish` (routed to adjacent tile).
- Firefighter NPC: spawns at lot edge after phone call, extinguishes
  deterministically, fines for false alarms.
- Flood: puddle objects spawn from broken plumbing per tick until repaired;
  puddles add Room penalty and `Mop` ads.

### 3.10 Save / load

- `SaveFileV1` = full `SimState` JSON with typed arrays base64-encoded +
  content bundle hash (refuse load across incompatible content without
  migration) + command-log tail (last 1000, for bug reports).
- Migrations: `migrations: ((old: unknown) => unknown)[]` applied in order;
  every migration ships with a fixture save in `sim/test/fixtures/saves/`.
- Client persistence: IndexedDB `saves` store (3 manual slots + rotating
  3 autosaves), export/import as gzipped `.homestead` file (via
  CompressionStream).

---

## 4. Interaction Statecharts (content-defined behavior)

The engine ships an interpreter for a small, declarative statechart format —
our safe answer to SimAntics. Example (`interactions/fridge_have_meal.json`):

```jsonc
{
  "id": "fridge.have_meal",
  "name": "@str:interaction.have_meal",       // string-table ref
  "ad": { "hunger": 65 },
  "cost": 20,                                  // charged on start
  "requires": ["object.notBroken", "person.adult"],
  "slot": { "type": "stand", "offset": [0, 1], "facing": "object" },
  "states": {
    "start":  { "do": "anim:open_fridge", "next": "carry" },
    "carry":  { "do": "spawnCarried:meal_raw",
                "route": { "surface": ["counter", "table"] },   // find aux object
                "onFail": "eat_standing", "next": "prep" },
    "prep":   { "do": "anim:prepare", "durationMin": 10,
                "skillCheck": { "skill": "cooking", "lt": 2, "chance": 0.15,
                                 "then": "event:StartFire" },
                "next": "cook_or_eat" },
    "eat":    { "do": "anim:eat", "perMin": { "hunger": +8, "comfort": +1 },
                "untilMotive": { "hunger": 90 }, "next": "finish" },
    "finish": { "do": "spawnAt:plate_dirty@surface", "next": "$exit" }
  },
  "interruptible": { "below": { "bladder": -85 }, "notDuring": ["prep"] }
}
```

Interpreter contract:
- `do` verbs are a **closed set** (~25 verbs: anim, spawn, destroy, motiveDelta,
  route, skillCheck, event, sound, faceTo, sit, stand, carry, drop, payFunds…).
  New verbs require engine work; combinations don't.
- `behavior:` verb escape hatch calls a TS function from a registry
  (`registerBehavior('tv.pick_channel', fn)`) for the genuinely custom 10%.
- Zod schema validates every statechart at content build time; a CI check
  walks all reachable states (no orphans, no missing anims, all string refs
  resolve).

Social interactions use the same interpreter with a paired-statechart
extension (initiator + target run mirrored charts with sync points).

---

## 5. Client Architecture (`packages/client`)

### 5.1 Process model

```
Main thread                         Worker
┌─────────────────────┐   cmds →   ┌──────────────────┐
│ PixiJS render loop  │ ─────────→ │ sim tick loop     │
│ Preact UI           │ ← snaps    │ (20–200 tps)      │
│ input/camera        │ ← events   │ owns SimHandle    │
│ audio               │            └──────────────────┘
└─────────────────────┘
```

**Worker protocol** (versioned, all messages structured-cloneable):

```ts
// main → worker
{ t: 'Init', seed, contentBundle, save? }
{ t: 'Cmd', cmd: Command, reqId }
{ t: 'SetSpeed', speed }
{ t: 'RequestSave', reqId }
// worker → main
{ t: 'Ready' }
{ t: 'Snapshot', snap: SimSnapshot, tick }        // see cadence below
{ t: 'Events', events: SimEvent[], tick }
{ t: 'CmdResult', reqId, result }
{ t: 'SaveBlob', reqId, data }
```

Snapshot cadence: full snapshot on init/load; afterwards **delta snapshots**
every render-relevant tick (changed entities only, keyed by a per-entity
`dirtyTick`). Target: < 20 KB/frame at speed 1. Positions are interpolated
on the main thread between snapshots for smooth 60 fps movement.

### 5.2 Rendering

- **Layers** (Pixi containers, bottom→top): terrain → floors → wall-back →
  objects+people (one z-sorted container) → wall-front → fx/bubbles →
  build-mode overlays → screen-space UI handled by DOM.
- **Iso math**: tile (x,y) → screen `((x−y)·32, (x+y)·16)`; picking inverts it
  then refines via per-object hit masks.
- **Depth sort**: single sorted container using
  `zIndex = (x + y) * 1000 + layer`; multi-tile objects are pre-sliced into
  per-tile sprites in the atlas pipeline (`tools/atlas` cuts them; metadata
  records the slice origin).
- **Wall cutaway**: 4 modes (up/cutaway/down/roof-later); cutaway swaps wall
  sprites to short variants when a wall is south of a room containing a
  selected/visible person; implemented as texture swap, not shader, for v1.
- **Character animation**: state machine per person driven by snapshot fields
  (`activityAnim`, `facing`, `carrying`); sprite sheets at 12 fps, 4 facings
  (mirrored to fake 2 of them). Anim names are a shared enum validated
  against content at build time.
- **Object states**: object defs list sprite variants (`clean/dirty/broken/on/off`);
  view layer picks variant from snapshot state.

### 5.3 SimSnapshot (render contract)

Renderer-facing read model — flat, no Maps, no methods:

```ts
interface SimSnapshot {
  tick: number; clock: {...}; funds: number;
  people: PersonView[];      // id, tile, subTile, facing, anim, carrying,
                             // needs (rounded), mood, queueIcons[], selected flags
  objects: ObjView[];        // id, defId, tile, rot, stateVariant, fxFlags
  lot: LotView;              // floors/walls/rooms as typed arrays (transferable)
  bubbles: BubbleView[];     // speech/thought bubbles with ttl
}
```

### 5.4 UI (Preact) structure

```
ui/
├─ store.ts            # nanostores: snapshot atom, selection, mode, panel state
├─ panels/ControlPanel # mode switch, speed, clock, funds
├─ panels/NeedsPanel   # 8 bars + mood diamond
├─ panels/PersonTabs   # Job / Skills / Personality / Relationships / Inventory
├─ panels/Queue        # action chips w/ cancel
├─ pie/PieMenu         # radial menu; options come from a CmdResult-style
│                      #   'QueryInteractions' round-trip to the worker
├─ catalog/BuyCatalog  # room/function tabs, item cards, price, drag-to-place
├─ catalog/BuildTools  # wall/floor/door/window/paint tools
├─ dialogs/            # chance cards, warnings, save/load, settings
└─ hud/Toasts          # event feed (promotion, bills, fire!)
```

Placement flow (buy mode): pointer drag renders a **ghost sprite** with
validity tinting computed *client-side* from a mirrored placement-rules
module (shared from `sim/` — same code bundled both sides) so feedback is
instant; the authoritative check still happens in the worker on drop.

### 5.5 Input & camera

- Camera: pan (drag / edge / WASD), zoom ×1/×2/×3 (nearest-neighbor).
- Hit testing priority: UI DOM → people → objects (hit mask) → tile.
- Click person = select; click object = pie menu (options fetched for the
  currently selected person); build/buy modes swap the input controller
  (strategy pattern: `LiveInput | BuyInput | BuildInput`).

### 5.6 Audio

- Channels: music (per mode, crossfade on mode switch), ambient, SFX, voice.
- SFX triggered by `SimEvent`s (event → sound map in content).
- Folk-speak: per-person pitch offset over a shared gibberish sample bank;
  triggered by conversation events with flavor (happy/angry/sad/flirty).

---

## 6. Content Pipeline

```
content/*.json ──zod validate──► content build ──► content.bundle.json ─┐
assets/src/*.png ──tools/atlas──► spritesheets + slice metadata ────────┼─► client build
strings/en.json ──ref check (every @str: resolves)──────────────────────┘
```

- CI fails on: schema violation, dangling references (interaction → anim,
  ad → interaction, career → skill, sprite variant → atlas frame), unreachable
  statechart states, missing strings.
- Object definition schema (abridged):

```ts
ObjectDef = {
  id, name: StrRef, price, category: RoomCat, funcCat: FuncCat,
  footprint: [w, h], wallMounted?: boolean, requiresSurface?: boolean,
  surfaceSlots?: SlotDef[],            // counters/tables accept carried items
  flammability: 0..10, depreciationCurve: 'standard' | 'electronics' | 'none',
  motiveRatings: {...},                // shown in catalog (comfort 7 etc.)
  states: { default, dirty?, broken?, on? } → spriteRef,
  breakage?: { mtbfUses, repairSkill, repairMin },
  interactions: InteractionRef[],
  npcInteractions?: InteractionRef[],  // maid cleans, etc.
}
```

---

## 7. Cross-Cutting Concerns

### 7.1 Error handling & telemetry
- Worker crash ⇒ main thread shows "simulation hiccup" dialog, offers reload
  from last autosave; crash report bundle = save + command tail + state hash.
- Dev overlay (toggle `~`): tick time graph, entity counts, ad-cache stats,
  path cache hit rate, snapshot size.

### 7.2 Testing infrastructure
- **Unit** (Vitest, `packages/sim`): pure-function coverage of formulas §3.5,
  pathfinding, floodfill, migrations, statechart interpreter (table-driven).
- **Scenario tests**: YAML files = initial lot + people + assertions with
  time bounds (`expect person.hunger > 0 within 30 simMin`). Runner
  fast-forwards headless sim. These are the *behavioral* regression suite.
- **Determinism gate** (CI): run canonical scenario twice + across Node
  versions, compare `hashState()` per 1000 ticks.
- **Golden-image tests**: Playwright screenshots of fixed scenes (iso sort,
  cutaway, zoom) diffed against goldens (0.1% pixel tolerance).
- **Balance harness** (`packages/balance`): N seeded households × autonomy-only
  × 30 sim-days → CSV (survival, funds, mood curves) + plots; run nightly.

### 7.3 Performance budgets (CI-enforced where possible)
| Metric | Budget | Measured by |
|---|---|---|
| Sim tick (ref load) | ≤ 2 ms mean / 4 ms p99 | perf test in CI (Node) |
| Snapshot delta size | ≤ 20 KB/frame speed 1 | perf test |
| Render frame | ≤ 8 ms on 2019 laptop | manual + dev overlay |
| Initial load (cold) | ≤ 5 s / ≤ 15 MB transfer | Lighthouse CI |
| Save/load round trip | ≤ 500 ms | perf test |

### 7.4 Accessibility
Keyboard: full camera + speed + panel navigation; pie menu arrow-key
navigable. Needs bars use pattern + color (colorblind-safe ramp from the
design tokens). Reduced-motion setting disables screen shake/particles.
UI scale setting (0.75×–1.5×). All text via string table (i18n-ready).

### 7.5 Security/privacy
No server, no accounts, no analytics in v1. Save import validates against
schema with size caps (zip-bomb guard on decompress).

---

## 8. Key Decisions & Alternatives Considered

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Sim placement | Web Worker | main thread | ×10 speed needs headroom; UI isolation |
| State style | mutable store + systems | immutable/redux | GC pressure at 200 tps; determinism doesn't need immutability |
| Renderer | PixiJS | raw WebGL, Phaser, DOM | batching + maturity; Phaser brings unneeded scene/physics weight |
| UI | Preact DOM overlay | in-canvas UI | text layout, a11y, dev speed |
| Behavior authoring | JSON statecharts + verb set | full script VM (SimAntics-like), hardcoded TS | safety + data-driven, without building a language |
| Iso sorting | zIndex + pre-sliced sprites | topological sort, depth buffer tricks | simplest approach that survives multi-tile objects |
| Monorepo | pnpm workspaces | single package | enforces the sim/client firewall |
```
