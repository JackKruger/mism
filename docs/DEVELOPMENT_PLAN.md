# Homestead — Development Plan & Task Breakdown

> Companion to [`GAME_PLAN.md`](./GAME_PLAN.md) (design) and
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (technical spec).
> This is the working backlog: every task has an ID, estimate, dependencies,
> and acceptance criteria (AC). Import into your tracker of choice; IDs are
> stable and referenced from commits (`feat(sim): ad scoring [S-204]`).

**Estimate scale:** S = ≤1 day · M = 2–3 days · L = 4–7 days · XL = needs breaking down (flagged).
**Prefixes:** `F` foundations · `S` sim · `R` render · `U` UI · `C` content · `A` art/audio · `Q` quality/testing · `O` ops.

Team assumption: 1–2 developers + contracted art/audio. Rows marked ⚠ are on
the critical path.

---

## Milestone 0 — Foundations (Weeks 1–2)

**Goal:** empty lot on screen, character walks to a clicked tile, sim runs in a worker, CI deploys every commit.
**Exit demo:** click around a 64×64 lot; character pathfinds there at 60 fps; speed controls change sim rate.

### Epic F1: Repository & toolchain
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| F-101 ⚠ | Scaffold pnpm monorepo (`sim`, `content`, `client`, `balance`, `e2e`, `tools`) with strict TS, base tsconfig, ESLint+Prettier | M | — | `pnpm i && pnpm build && pnpm test` green on clean clone |
| F-102 ⚠ | Enforce sim isolation: sim tsconfig without DOM lib, `no-restricted-imports`, dependency-cruiser rules in CI | S | F-101 | importing `pixi.js` from `sim/` fails CI |
| F-103 ⚠ | CI workflow: lint, typecheck, unit tests, build, artifact upload | S | F-101 | red PR on any failure; <5 min runtime |
| F-104 | Auto-deploy `client` to static hosting on main merge (Pages/Netlify) + PR preview deploys | S | F-103 | merged commit reachable at public URL |
| F-105 | Dev scripts: `pnpm dev` (Vite + content watch), `pnpm sim:repl` (headless sim REPL for debugging) | S | F-101 | documented in README |

### Epic F2: Sim skeleton
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| F-201 ⚠ | Core types: branded IDs, `Store<T>`, `SimState`, seeded RNG (xoshiro128**) with serializable state | M | F-101 | RNG: same seed ⇒ same first 10k draws (test) |
| F-202 ⚠ | Fixed-timestep tick loop + `Clock` (tick→simMinute→day), speeds 0/1/3/10 | S | F-201 | 20 ticks = 1 sim-min; day rollover event fires |
| F-203 ⚠ | Command bus: `apply(cmd)` validation/dispatch pattern, command log ring buffer | S | F-201 | invalid command returns typed error, valid ones logged |
| F-204 ⚠ | `SimHandle` public API + `hashState()` (stable JSON hash) | S | F-201..203 | determinism test: 2 runs, equal hashes each 1000 ticks |
| F-205 ⚠ | Web Worker harness + protocol v1 (Init/Cmd/Snapshot/Events), main-thread client wrapper | M | F-204 | sim runs at ×10 with main thread idle; protocol round-trip test |
| F-206 | Snapshot builder v1 (full snapshots; deltas deferred to F-306) | S | F-205 | snapshot serializable via structuredClone |

### Epic F3: World, path, render bootstrap
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| F-301 ⚠ | Lot model: 64×64 grid, terrain array, tile coordinate helpers | S | F-201 | unit tests for tile/edge packing |
| F-302 ⚠ | A* pathfinding on grid (no walls yet) + path smoothing, deterministic tie-breaking | M | F-301 | 1000-path fuzz test: all optimal length; <0.1 ms/path avg |
| F-303 ⚠ | PixiJS bootstrap: app, layer containers, iso projection module (world↔screen), camera pan/zoom | M | F-101 | 60 fps rendering 64×64 terrain grid at all zooms |
| F-304 ⚠ | Tile picking (screen→tile) + hover highlight + click-to-move command | S | F-302, F-303 | click sends `QueueInteraction(walkTo)`; person view moves |
| F-305 ⚠ | Person entity + `Movement` system + placeholder character sprite with 4-facing walk anim, position interpolation between snapshots | M | F-302, F-206 | smooth 60 fps walk while sim at any speed |
| F-306 | Delta snapshots (dirty-entity tracking) + interpolation buffer | M | F-305 | snapshot ≤ 20 KB/frame in ref scene (perf test) |
| F-307 | Dev overlay: FPS, tick time, entity counts, snapshot size (toggle `~`) | S | F-305 | visible in dev builds only |

**M0 definition of done:** all ⚠ tasks complete; deployed demo; determinism + perf tests in CI.

---

## Milestone 1 — The Survival Loop (Weeks 3–6) 🎯

**Goal:** one autonomous person survives in a furnished house, dies in an empty one. *This milestone validates the entire game.*
**Exit demo + fun gate:** 15-minute unscripted watch session with 3 testers; if watching autonomy isn't engaging, we stop and tune before proceeding.

### Epic S1: Needs & mood
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| S-101 ⚠ | Needs component (8 motives), decay tables from `tuning.json`, activity modifiers | M | F-202 | scenario test: all motives hit -100 in expected sim-hours ±5% |
| S-102 ⚠ | Mood formula (worst-needs-weighted, §3.5 of architecture) | S | S-101 | table-driven tests incl. edge values |
| S-103 | Personality component + decay/scoring modifiers (Neat/Outgoing/Active/Playful/Nice) | M | S-101 | Neat 10 vs 0: hygiene decay differs per tuning table |
| S-104 ⚠ | Failure states: hunger starvation timer, energy collapse (pass-out anim + forced sleep), bladder accident (spawns puddle, hygiene crash) | M | S-101 | scenario tests for each terminal/failure path |

### Epic S2: Objects & interactions engine
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| S-201 ⚠ | Content schemas (zod): ObjectDef, InteractionDef (statechart), tuning; content build → bundle + CI validation | M | F-101 | invalid content fails build with path-accurate error |
| S-202 ⚠ | Object instances: placement on grid, footprints, rotation, state variants (clean/dirty/broken), route-slot resolution with rotation | M | S-201, F-301 | slot tiles computed correctly for all 4 rotations (test matrix) |
| S-203 ⚠ | Statechart interpreter: core verb set v1 (anim, motiveDelta/perMin, untilMotive, duration, spawn, destroy, route, sound-event, faceTo, sit/stand) | L | S-201 | interpreter unit tests per verb; full fridge chart runs headless |
| S-204 ⚠ | Ad system: AdIndex build/dirty rules, per-person reachable-ad cache, scoring formula + top-3 weighted choice | L | S-202, S-101 | perf: score 4×200 in <0.5 ms; unit tests for weight curve |
| S-205 ⚠ | Autonomy system: idle detection, re-plan triggers (threshold buckets), queue push; player commands outrank autonomous | M | S-204 | scenario: starving person walks past TV to fridge |
| S-206 ⚠ | Action queue: ordering, cancellation, interruption rules (`interruptible` spec), current-action state | M | S-203 | bladder emergency interrupts TV, not shower (scenario tests) |
| S-207 | Object slot occupancy/reservation (two people, one chair) | S | S-202 | contested-chair scenario: second person re-plans |

### Epic S3: The first eight objects (content + art + anims)
Each object task = definition JSON + statecharts + sprite states + anims wired. AC for each: interaction runs end-to-end, headless scenario test passes, looks right in game.

| ID | Object | Interactions | Est | Deps |
|---|---|---|---|---|
| C-101 ⚠ | Fridge | HaveSnack, HaveMeal (spawns prep chain), Restock cost | M | S-203 |
| C-102 ⚠ | Counter | surface slot (prep, set-down), Clean | S | C-101 |
| C-103 ⚠ | Stove | Cook (continues meal chain; fire risk stub — real fire in M5) | M | C-101 |
| C-104 ⚠ | Toilet | Use, Flush, Clog state, Clean | S | S-203 |
| C-105 ⚠ | Shower | TakeShower (hygiene), breakage state stub | S | S-203 |
| C-106 ⚠ | Bed | Sleep (energy curve, wake-at-full or alarm), Make bed | M | S-203 |
| C-107 ⚠ | Sofa | Sit (comfort), Nap | S | S-203 |
| C-108 ⚠ | TV | WatchTV (fun by channel stub; sofa-aware seating) | M | C-107 |
| C-109 | Dirty-dish/meal chain: plates spawn, decay to flies state, Clean-up interaction | M | C-101..103 |
| C-110 | Trash pile + trash can + Empty Trash | S | C-109 |

### Epic U1: Live-mode UI v1
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| U-101 ⚠ | Preact + store scaffolding over canvas; UI never blocks canvas input outside panel bounds | S | F-303 | — |
| U-102 ⚠ | Control panel: speed buttons + pause, clock, funds display | S | U-101 | keyboard shortcuts 0–3, space=pause |
| U-103 ⚠ | Needs panel: 8 bars with color ramp + mood diamond; updates from snapshot | S | U-101 | bars visibly track sim values |
| U-104 ⚠ | Pie menu: object click → worker round-trip `QueryInteractions` → radial options → command | M | S-206 | options reflect availability (broken fridge shows no HaveMeal) |
| U-105 ⚠ | Action queue chips with cancel (and cancel-in-progress wiggle state) | S | S-206 | clicking chip cancels correct queue index |
| U-106 | Speech/thought bubbles + need-warning icons from SimEvents | S | S-104 | bladder warning appears below -70 |
| U-107 | Person selection: portrait row, selected marker over head (our plumbob-analog) | S | U-101 | selection switch < 1 frame |

### Epic Q1: M1 quality
| ID | Task | Est | Deps | Acceptance criteria |
|---|---|---|---|---|
| Q-101 ⚠ | Scenario-test runner (YAML → headless sim → assertions with sim-time bounds) + 10 core survival scenarios | M | S-101..206 | runs in CI < 60 s |
| Q-102 | Balance harness v1: N seeds × autonomy-only × 7 sim-days → CSV + survival chart | M | S-205 | nightly job produces artifact |
| Q-103 ⚠ | Fun-gate playtest protocol + tuning pass on decay/ad constants | M | all M1 | 3/3 testers watch 15 min without prompting; written findings |

---

## Milestone 2 — Money, Buy Mode & Careers (Weeks 7–9)

**Goal:** the full treadmill: work → earn → buy → improve → promote.
**Exit demo:** start with 20k, furnish, hold a job 5 sim-days, get one promotion, pay one bill cycle.

### Epic S4: Economy
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-401 ⚠ | Household funds, transactions ledger, purchase/refund/sell with depreciation curves | M | S-202 | ledger sums always equal funds (invariant test) |
| S-402 | Bills: every 3 days, % of asset value, mailbox object + Pay interaction; late → repo NPC takes highest-value objects | M | S-401 | scenario: ignore bills 6 days ⇒ TV repossessed |
| S-403 | Object breakage: MTBF per def, broken states, Repair interaction (Mechanical-gated success/electrocution stub), repair-service hook | M | S-202 | shower breaks after tuned uses; low-skill repair can fail |

### Epic S5: Careers & skills
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-501 ⚠ | Career data schema + job component (track, level, performance, days-missed) | S | S-201 | 3 tracks × 10 levels load & validate |
| S-502 ⚠ | Carpool lifecycle: spawn 1h before shift, honk events, board/depart, off-lot time skip for worker, return with pay | L | S-501 | miss 2 days ⇒ fired event; pay matches data |
| S-503 ⚠ | Promotion evaluation: skills + friends + mood-at-departure; demotion on low performance | M | S-502 | table-driven tests across boundary cases |
| S-504 | Chance cards: data schema, ~10% trigger, modal choice, outcome application | M | S-502, U-201 | outcomes affect funds/skill/job per data |
| S-505 ⚠ | Skill system: 6 skills, gain-while-interacting hook, personality speed modifiers, skill-gated interaction requirements | M | S-203 | Cooking gain from practice; gain pauses when motives critical |
| C-201 | Skill objects: bookshelf (Cooking/Mechanical study), mirror (Charisma), easel (Creativity, sellable paintings), chess (Logic), exercise machine (Body) | L | S-505 | each trains correct skill; easel produces sellable output |
| C-202 | Careers content: 3 tracks (Culinary, Science, Business) fully written (titles, salaries, hours, requirements, 10 chance cards each) | M | S-501 | validated; salary curve reviewed vs balance sheet |

### Epic U2: Buy mode
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| U-201 ⚠ | Mode switching framework (Live/Buy/Build) with input-controller swap + music hook | S | U-102 | sim auto-pauses on Build, optional on Buy (setting) |
| U-202 ⚠ | Buy catalog UI: category tabs, item cards (price, motive ratings), search | M | S-401 | data-driven from content bundle |
| U-203 ⚠ | Placement interaction: ghost sprite, validity tint, rotate (R / scroll), shared placement-rules module client+sim | L | U-202, S-202 | invalid placements impossible; authoritative check matches preview 100% in fuzz test |
| U-204 | Move/sell existing objects (click-pickup, sell-to-catalog with depreciated price display) | M | U-203 | refund equals depreciation table value |
| U-205 | Undo/redo stack for buy actions (inverse commands from CommandResult) | S | U-203 | 20-step undo fuzz test |
| U-206 | Job & Skills panels (career info, performance bar, skill bars) | S | S-503, S-505 | — |

---

## Milestone 3 — Build Mode (Weeks 10–12)

**Goal:** build a livable house from an empty lot.
**Exit demo:** empty lot → 2-bedroom house with doors, windows, wallpaper, floors; Room motive responds.

### Epic S6: Construction sim-side
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-601 ⚠ | Wall model on tile edges + wall commands (drag-batch build/demolish, cost/refund), object/wall conflict rules | M | F-301 | can't demolish wall holding a window; costs correct |
| S-602 ⚠ | Incremental room floodfill on wall/door edits; room registry | M | S-601 | edit 1 wall recomputes only affected rooms (perf test) |
| S-603 ⚠ | Doors & windows as edge portals: nav integration, daylight flag | M | S-601, F-302 | pathing uses doors; sealed room unreachable (ads suppressed) |
| S-604 ⚠ | Room motive: environment scoring (art/plants/light/mess/corpse inputs), applied to occupants | M | S-602 | scenario: dark messy room vs decorated room mood delta |
| S-605 | Floor/wallpaper placement (per-tile / per-wall-face, drag fill, costs) | S | S-601 | — |
| S-606 | Nav-graph invalidation & lazy path re-validation on world edits | M | S-603 | person walking through demolished doorway re-plans within 2 tiles |

### Epic R2: Construction rendering
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| R-201 ⚠ | Wall rendering: N/W edge sprites, corner resolution, door/window insets | L | S-601 | golden-image tests for 12 canonical wall layouts |
| R-202 ⚠ | Cutaway modes (up/cutaway/down) + auto-cutaway around selected person | M | R-201 | golden-image tests per mode |
| R-203 | Floor/wallpaper rendering + build-mode grid overlay | S | R-201 | — |
| R-204 | Depth-sort hardening: multi-tile object slicing pipeline in `tools/atlas` + regression scenes | M | R-201 | person walks behind/in front of all M1 objects correctly (goldens) |

### Epic U3: Build tools UI
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| U-301 ⚠ | Wall tool: click-drag lines, shift-drag rooms (rectangle), demolish modifier | M | S-601, R-201 | drag preview matches result exactly |
| U-302 | Floor/wallpaper tools with drag-fill + catalog of ~15 patterns each | M | S-605 | — |
| U-303 | Door/window placement (edge snapping, validity) | S | S-603 | — |
| U-304 | Build undo/redo (batch commands as single undo step) | S | U-301 | wall-rectangle = one undo |
| U-305 | House stats readout (asset value, room count) in build mode | S | S-604 | — |

---

## Milestone 4 — People & Social (Weeks 13–16)

**Goal:** multi-person households, relationships, NPC visitors, services, remaining careers/skills.
**Exit demo:** 2-person household; befriend a neighbor; promotion requiring 2 friends achieved; pizza ordered and eaten.

### Epic S7: Multi-person & socials
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-701 ⚠ | Household of 2–4: per-person selection, autonomy independence, shared funds | M | S-205 | 4 people run within tick budget |
| S-702 ⚠ | Relationship matrix (daily/lifetime, decay toward 0, friend/enemy thresholds, flags: friend/love) | M | S-701 | decay + threshold tests |
| S-703 ⚠ | Paired-statechart extension: initiator/target sync points, busy-target queuing, rejection paths | L | S-203 | Talk between two autonomous people runs headless |
| S-704 ⚠ | Social interaction resolution: success tables from (personality, mood, daily, lifetime), outcomes to both parties | L | S-702, S-703 | table-driven tests: Flirt at low daily mostly rejected |
| C-301 ⚠ | Social content: Talk, Joke, Compliment, Insult, Flirt, Kiss, Hug, Fight, Give Gift, Dance, Apologize, Say Goodbye (12 charts + anims) | XL→split per interaction | S-704 | each has accept/reject branches + relationship deltas |
| S-705 | Conversation topics: interest vectors per person, topic bubbles, interest-match modifier on Talk | M | S-704 | mismatched interests reduce gain (test) |
| S-706 | Group activities: shared TV watching, joint meals at table (social gain while co-located) | M | S-703 | two people eating together gain social |

### Epic S8: NPCs & services
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-801 ⚠ | NPC framework: off-lot directory, spawn/despawn at lot edge, NPC autonomy profile (role-scripted goals over ads) | L | S-701 | NPC enters, acts, leaves cleanly; never stuck (soak test) |
| S-802 ⚠ | Walk-by visitors + greet flow (must be greeted to enter; leaves at night or when needs low) | M | S-801 | ungreeted visitor waits then leaves |
| S-803 ⚠ | Phone object: Invite person, Call services menu, Order pizza | M | S-801, C-104 chain | invited NPC arrives ~30 sim-min later |
| S-804 | Maid service (daily, cleans mess objects by priority, charges per visit), Repair service (fixes broken objects, per-job fee) | M | S-801 | maid clears all mess if affordable; skips if broke |
| S-805 | Pizza delivery: arrival, hand-off, box object (group meal source), payment | S | S-803 | — |
| S-806 | Mail carrier + newspaper delivery (job-seeking source + bills channel) | S | S-402 | — |
| C-302 | NPC cast content: 15 named neighbors with personalities/interests/portraits | M | S-801 | — |
| C-303 | Careers content: remaining 7 tracks + chance cards | L | C-202 | all 10 tracks validated |
| C-304 | Dining content: table + chairs + group-meal seating logic, coffee maker, espresso | M | S-706 | — |
| U-401 | Relationships panel (portraits, daily/lifetime bars, flags) | S | S-702 | — |
| U-402 | Person-to-person pie menu (social options w/ availability logic) | S | S-704 | — |
| U-403 | Character creation screen: name, 2 bodies × 8 heads × 6 outfits, 25-point personality allocator, interests | L | S-103 | creates household of 1–4; validation complete |

---

## Milestone 5 — Drama & Polish (Weeks 17–19)

**Goal:** feature-complete beta: hazards, death, romance, full catalog, audio, onboarding.

### Epic S9: Hazards & lifecycle
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-901 ⚠ | Fire system: ignition sources (stove low-skill, fireplace), tile spread w/ flammability, object destruction, panic override, extinguish interaction, fire service NPC | L | S-801 | scenario: cooking fire w/o intervention consumes kitchen; with alarm object, brigade auto-called |
| S-902 ⚠ | Death & Reaper-analog: causes (starve/fire/drown/electrocute), death event, urn/tombstone object, mourning debuffs, ghost night-walks | L | S-901 | each cause reachable in scenario tests |
| S-903 | Flood/puddles from broken plumbing, Mop interaction, roach spawn from filth, Disease debuff (motive decay multiplier) + recovery in bed | M | S-403 | filth 3 days ⇒ roaches ⇒ disease chance |
| S-904 | Electrocution risk on low-Mechanical repair of electronics (damage or death outcome) | S | S-403, S-902 | — |
| S-905 | Romance arc: Flirt→Kiss→Propose "move in" (adds NPC to household), jealousy events | M | S-704 | move-in transfers NPC with their funds |
| C-401 | Catalog completion to 60 objects (lamps, art, plants, stereo, computer, bookcase, pool-stub, fire alarm, burglar-alarm-stub, decor tiers) | XL→one task per object batch (5 batches) | S-202 | every object has ads/interactions/states/tests |
| C-402 | Economy/balance data pass: full price/depreciation/salary/bill spreadsheet reconciled with balance harness output | M | Q-102 | median household solvent but pressured (defined bands) |

### Epic A1: Audio & feel
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| A-101 | Audio manager: channels, crossfade, event→SFX map, volume settings | M | F-205 | — |
| A-102 | Commission/integrate music: 2 tracks × 3 modes | M (external) | A-101 | mode switch crossfades |
| A-103 | SFX pass: ~80 sounds wired to events | M | A-101 | — |
| A-104 | Folk-speak: gibberish bank, per-person pitch, conversation triggers | M | A-101, S-703 | — |
| A-105 | Game feel pass: bubbles polish, camera nudges (reduced-motion aware), UI sounds | S | A-103 | — |

### Epic U5: Onboarding & shell
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| U-501 ⚠ | Save/load UI: 3 slots + 3 autosaves, thumbnails, export/import `.homestead` | M | S-1001 | round-trip fuzz: load(save(x)) hash-equal |
| U-502 | Main menu, new-game flow (character creation → lot), settings (audio, UI scale, reduced motion, autonomy level) | M | U-403 | — |
| U-503 | Tutorial: contextual tip system (first hunger warning, first bill, first fire) + optional guided first day | L | most | new player reaches day 3 unaided in playtest |
| U-504 | Toast/notification feed + event history panel | S | — | — |

### Epic S10: Persistence hardening
| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| S-1001 ⚠ | Full serialize/deserialize with typed-array encoding + content-hash guard + migration framework with fixture saves | L | all state | CI migration test per schema bump |
| S-1002 | Autosave scheduling (each sim-day, off-thread, non-blocking) | S | S-1001 | no frame hitch > 16 ms during autosave |
| S-1003 | Crash recovery: worker error → dialog → reload last autosave; downloadable bug bundle (save+cmd log+hash) | M | S-1001 | forced crash test recovers |

---

## Milestone 6 — Beta Hardening & Release (Weeks 20–21)

| ID | Task | Est | Deps | AC |
|---|---|---|---|---|
| Q-601 ⚠ | Performance audit vs all budgets (§7.3 architecture); optimize hot paths (ad cache, floodfill, snapshot deltas) | L | all | every budget green in CI perf suite |
| Q-602 ⚠ | Full-game balance runs: 200 seeded households × 30 days nightly; tune to target bands; document final tuning | M | C-402 | survival ≥ 95% for competent-play bots; broke-by-day-10 < 10% |
| Q-603 ⚠ | Bug bash + triage to zero P0/P1 | L | all | tracker clean |
| Q-604 | Accessibility pass: keyboard-complete run-through, colorblind sim check, screen-reader labels on panels, UI scale | M | U-* | documented a11y checklist green |
| Q-605 | Golden-image suite expansion (30 scenes) + determinism gate across browsers (Chrome/Firefox/Safari via Playwright) | M | R-* | CI matrix green |
| O-601 | PWA: manifest, offline cache of app+assets, install prompt | S | F-104 | Lighthouse PWA pass |
| O-602 | Release: versioning, changelog, itch.io/pages landing page, feedback channel | S | all | v1.0.0 tagged & public |
| O-603 | Post-release telemetry decision (opt-in only, or none) + crash-report import tooling for triage | S | S-1003 | — |

---

## Cross-milestone tracks (continuous)

| Track | Cadence | Owner notes |
|---|---|---|
| **Art pipeline** | weekly drops | Placeholder → final swaps must never block code: all sprites referenced via manifest ids; `tools/atlas` validates dimensions/slices on import. Art order: M1 objects → characters/anims → build materials → M4 socials anims → catalog batches → UI art. |
| **Playtests** | end of every milestone | Scripted protocol + recorded sessions; findings become tracker items before next milestone starts. |
| **Balance telemetry** | nightly from M1 | Chart survival/mood/funds; regressions on tuning changes flagged automatically. |
| **Docs** | per epic | Each epic closes with a short design note in `docs/notes/` (what was built, tuning knobs, known gaps). |
| **Tech debt budget** | 10% of each milestone | Explicit debt list; nothing merges with TODO-without-ticket. |

## Dependency spine (critical path)

```
F-101 → F-201..204 → F-205 → S-101 → S-201 → S-202 → S-203 → S-204 → S-205
      ↘ F-301 → F-302 ↗                                        ↓
        F-303 → F-304 → F-305                            Q-101/Q-103 (fun gate)
                                                               ↓
                              S-401 → S-501 → S-502 → S-503 (treadmill)
                                                               ↓
                              S-601 → S-602 → S-603 → S-604 (build)
                                                               ↓
                              S-701 → S-703 → S-704 → S-801 → S-803 (social/NPC)
                                                               ↓
                              S-901 → S-902 → S-1001 → U-501 (drama/persist)
                                                               ↓
                                       Q-601 → Q-603 → O-602 (ship)
```

## Risk-triggered contingency plans

| Trigger | Plan |
|---|---|
| Fun gate (Q-103) fails | 2-week tuning sprint on autonomy/feedback (bubbles, idle animations, ad constants) before M2; if second gate fails, redesign autonomy visibility (more legible intent signaling) |
| Tick budget blown at M2 | Cut lot to 48×48, cap objects at 150, move ad scoring to coarse buckets |
| Art throughput < plan | Ship v1 with palette-swap variants + reduced catalog (45); mark "more objects" as first patch |
| Statechart format too limiting by M4 | Expand verb set (budgeted M: 3 days) rather than adopting a script VM; revisit VM only post-1.0 |
| Schedule slips > 2 weeks by end of M3 | Cut from M5 in order: burglar/alarm stubs, ghosts, romance jealousy, pool; never cut fire/death (identity features) |
```
