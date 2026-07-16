import { describe, expect, it } from "vitest";
import type { SimContent, SimObjectDef } from "../src/objects/content.js";
import type { PersonId, ObjectId } from "../src/core/ids.js";
import { TICKS_PER_SIM_MINUTE, createSim, loadSim } from "../src/index.js";
import { canPlace, placeObject } from "../src/objects/placement.js";
import { createState } from "../src/state.js";
import { findPath } from "../src/path/astar.js";
import { isWalkable } from "../src/world/lot.js";

/**
 * C-109/C-110 mess chain: eating spawns non-blocking dirty plates
 * (spawnAt verb), plates drag the room motive down (roomScoreSystem), and
 * clean_up destroys them (destroyObject verb) — closing the loop through
 * autonomy, which picks clean_up off the plate's own room ad.
 */

const fridgeDef: SimObjectDef = {
  id: "fridge",
  footprint: [1, 1],
  slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
  interactions: ["fridge.have_meal"],
};

const plateDef: SimObjectDef = {
  id: "dirty_plate",
  footprint: [1, 1],
  slots: [{ type: "stand", offset: [0, 0], facing: "object" }],
  interactions: ["dirty_plate.clean_up"],
  blocksTile: false,
  messRating: 3,
};

const CONTENT: SimContent = {
  objects: [fridgeDef, plateDef],
  interactions: [
    {
      id: "fridge.have_meal",
      ad: { hunger: 55 },
      slot: 0,
      states: {
        start: {
          do: "anim:eat",
          perMin: { hunger: 8 },
          untilMotive: { motive: "hunger", gte: 90 },
          next: "finish",
        },
        finish: { do: "spawnAt:dirty_plate", next: "$exit" },
      },
    },
    {
      id: "dirty_plate.clean_up",
      ad: { room: 45 },
      slot: 0,
      states: {
        start: { do: "anim:clean", durationMin: 2, next: "dispose" },
        dispose: { do: "destroyObject", next: "$exit" },
      },
    },
    // Spawn attempts the verb must ignore: a blocking def and an unknown def.
    {
      id: "debug.bad_spawns",
      ad: {},
      slot: 0,
      states: {
        start: { do: "spawnAt:fridge", next: "second" },
        second: { do: "spawnAt:no_such_def", next: "$exit" },
      },
    },
  ],
};

function setup(personTileX = 20, personTileY = 22) {
  const sim = createSim({ seed: 7, content: CONTENT });
  const pRes = sim.apply({ t: "AddPerson", name: "Messy Mo", x: personTileX, y: personTileY });
  if (!pRes.ok || pRes.personId === undefined) throw new Error("AddPerson failed");
  const oRes = sim.apply({ t: "PlaceObject", defId: "fridge", tile: { x: 20, y: 20 }, rotation: 0 });
  if (!oRes.ok || oRes.objectId === undefined) throw new Error("PlaceObject failed");
  return { sim, person: pRes.personId as PersonId, fridge: oRes.objectId as ObjectId };
}

describe("non-blocking objects (C-109)", () => {
  it("plates never block walking, stack, and may sit under blocking objects", () => {
    const state = createState(1, CONTENT);
    placeObject(state, plateDef, { x: 6, y: 5 }, 0);
    expect(isWalkable(state.lot, 6, 5)).toBe(true);
    expect(state.lot.navVersion).toBe(0); // walkability unchanged: no path invalidation

    // A* walks straight through the plate's tile.
    const path = findPath(state.lot, { x: 4, y: 5 }, { x: 9, y: 5 });
    expect(path!.length).toBe(5);

    // Two non-blocking on one tile, and a blocking object over the plate.
    expect(canPlace(state, plateDef, { x: 6, y: 5 }, 0)).toBe(true);
    expect(canPlace(state, fridgeDef, { x: 6, y: 5 }, 0)).toBe(true);
    // But a plate is still bounds-checked, and blocking-over-blocking still collides.
    expect(canPlace(state, plateDef, { x: -1, y: 5 }, 0)).toBe(false);
    placeObject(state, fridgeDef, { x: 6, y: 5 }, 0);
    expect(canPlace(state, fridgeDef, { x: 6, y: 5 }, 0)).toBe(false);
  });
});

describe("spawnAt / destroyObject verbs (C-109)", () => {
  it("eating spawns a dirty plate at the eater's tile", () => {
    const { sim, person, fridge } = setup();
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: 0 });
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_meal" });

    // Tick until the meal's finish state spawns the plate (autonomy would
    // clean it back up if we overshot by several minutes — the chain closes).
    let plates = sim.snapshot().objects.filter((o) => o.defId === "dirty_plate");
    for (let i = 0; i < 20 * TICKS_PER_SIM_MINUTE && plates.length === 0; i++) {
      sim.tick(1);
      plates = sim.snapshot().objects.filter((o) => o.defId === "dirty_plate");
    }

    expect(sim.snapshot().events.map((e) => e.type)).toContain("InteractionCompleted");
    // Spawned at the eater's tile — the fridge's [0,1] slot at (20,21).
    expect(plates).toEqual([
      { id: plates[0]!.id, defId: "dirty_plate", x: 20, y: 21, rotation: 0, objState: "default" },
    ]);
    // Only the fridge placement bumped navVersion; the spawn did not.
    expect(sim.serialize().lot.navVersion).toBe(1);
  });

  it("spawnAt ignores blocking and unknown defs without crashing", () => {
    const { sim, person, fridge } = setup();
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "debug.bad_spawns" });
    sim.tick(10 * TICKS_PER_SIM_MINUTE);
    const snap = sim.snapshot();
    expect(snap.events.map((e) => e.type)).toContain("InteractionCompleted");
    expect(snap.objects).toHaveLength(1); // still just the fridge
  });

  it("room drops with two plates and recovers to 0 after clean_up destroys them", () => {
    const { sim, person } = setup(10, 10);
    const plates: ObjectId[] = [];
    for (const tile of [{ x: 12, y: 10 }, { x: 13, y: 10 }]) {
      const res = sim.apply({ t: "PlaceObject", defId: "dirty_plate", tile, rotation: 0 });
      if (!res.ok || res.objectId === undefined) throw new Error("place plate failed");
      plates.push(res.objectId as ObjectId);
    }
    sim.tick(1);
    const needsOf = () => sim.snapshot().people.find((p) => p.id === person)!.needs;
    expect(needsOf().room).toBe(-24); // (3 + 3 mess) × penalty 4

    for (const plate of plates) {
      sim.apply({ t: "QueueInteraction", person, object: plate, interaction: "dirty_plate.clean_up" });
    }
    sim.tick(15 * TICKS_PER_SIM_MINUTE);
    expect(sim.snapshot().objects.filter((o) => o.defId === "dirty_plate")).toHaveLength(0);
    expect(needsOf().room).toBe(0);
  });
});

describe("mess autonomy (C-110)", () => {
  it("a contented person with messy surroundings eventually cleans up", () => {
    // Plate-only content: room is the only motive any ad can serve, so the
    // clean_up ads must win purely on the room deficit the mess creates.
    const content: SimContent = {
      objects: [plateDef],
      interactions: CONTENT.interactions!.filter((i) => i.id === "dirty_plate.clean_up"),
    };
    const sim = createSim({ seed: 11, content });
    sim.apply({ t: "AddPerson", name: "Neat Nia", x: 10, y: 10 });
    for (const tile of [{ x: 12, y: 10 }, { x: 12, y: 12 }, { x: 9, y: 13 }]) {
      if (!sim.apply({ t: "PlaceObject", defId: "dirty_plate", tile, rotation: 0 }).ok) {
        throw new Error("place plate failed");
      }
    }
    sim.tick(2 * 60 * TICKS_PER_SIM_MINUTE); // two sim-hours is ample for 3 cleanups
    const snap = sim.snapshot();
    expect(snap.objects).toHaveLength(0);
    expect(snap.people[0]!.needs.room).toBe(0);
    expect(snap.events.filter((e) => e.type === "InteractionCompleted")).toHaveLength(3);
  });
});

describe("determinism and persistence with the mess chain", () => {
  it("stays deterministic across 20k ticks of eating, spawning, and cleaning", () => {
    const run = () => {
      const { sim, person } = setup();
      sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -70 });
      sim.apply({ t: "PlaceObject", defId: "dirty_plate", tile: { x: 25, y: 25 }, rotation: 0 });
      sim.tick(20_000); // autonomy eats (spawning plates) and cleans repeatedly
      return sim.hashState();
    };
    expect(run()).toBe(run());
  });

  it("serialize → load round-trips mid-clean with spawned plates on the lot", () => {
    const { sim, person, fridge } = setup();
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: 0 });
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_meal" });

    // Tick until the meal completes and its plate exists, then start cleaning
    // it before autonomy does.
    let plate = sim.snapshot().objects.find((o) => o.defId === "dirty_plate");
    for (let i = 0; i < 20 * TICKS_PER_SIM_MINUTE && plate === undefined; i++) {
      sim.tick(1);
      plate = sim.snapshot().objects.find((o) => o.defId === "dirty_plate");
    }
    sim.apply({
      t: "QueueInteraction",
      person,
      object: plate!.id as ObjectId,
      interaction: "dirty_plate.clean_up",
    });
    sim.tick(TICKS_PER_SIM_MINUTE); // one minute into the 2-minute clean
    expect(sim.snapshot().people[0]!.activity).toBe("clean");

    const saved = sim.serialize();
    const loaded = loadSim(saved, CONTENT);
    expect(loaded.hashState()).toBe(sim.hashState());
    expect(loaded.snapshot().objects).toEqual(sim.snapshot().objects);

    // Both finish the clean identically: the plate is destroyed exactly once.
    sim.tick(5 * TICKS_PER_SIM_MINUTE);
    loaded.tick(5 * TICKS_PER_SIM_MINUTE);
    expect(loaded.hashState()).toBe(sim.hashState());
    expect(loaded.snapshot().objects.filter((o) => o.defId === "dirty_plate")).toHaveLength(0);
  });
});
