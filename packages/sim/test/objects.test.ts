import { describe, expect, it } from "vitest";
import type { SimContent, SimObjectDef } from "../src/objects/content.js";
import type { Tile } from "../src/world/lot.js";
import { canPlace, footprintTiles, placeObject, removeObject } from "../src/objects/placement.js";
import { createSim, loadSim } from "../src/index.js";
import { createState } from "../src/state.js";
import { findPath } from "../src/path/astar.js";
import { isWalkable } from "../src/world/lot.js";
import { resolveSlots } from "../src/objects/slots.js";

const counter1x1: SimObjectDef = { id: "counter_1x1", footprint: [1, 1], slots: [] };

const sofa2x1: SimObjectDef = {
  id: "sofa_2x1",
  footprint: [2, 1],
  slots: [{ type: "sit", offset: [0, 0], facing: "object" }],
};

const table2x2: SimObjectDef = {
  id: "table_2x2",
  footprint: [2, 2],
  slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
};

const fridge1x1: SimObjectDef = {
  id: "fridge_econocool",
  footprint: [1, 1],
  slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
};

const CONTENT: SimContent = { objects: [counter1x1, sofa2x1, table2x2, fridge1x1] };

const tileSet = (tiles: Tile[]): Set<string> => new Set(tiles.map((t) => `${t.x},${t.y}`));

describe("footprintTiles", () => {
  // Rotation convention (see placement.ts): quarter-turns clockwise in tile
  // space (+x east, +y south); offset (dx,dy) → r1:(-dy,dx) r2:(-dx,-dy) r3:(dy,-dx).
  it("rotates a 2x1 footprint through all 4 rotations", () => {
    const origin = { x: 5, y: 5 };
    expect(tileSet(footprintTiles(sofa2x1, origin, 0))).toEqual(tileSet([{ x: 5, y: 5 }, { x: 6, y: 5 }]));
    expect(tileSet(footprintTiles(sofa2x1, origin, 1))).toEqual(tileSet([{ x: 5, y: 5 }, { x: 5, y: 6 }]));
    expect(tileSet(footprintTiles(sofa2x1, origin, 2))).toEqual(tileSet([{ x: 5, y: 5 }, { x: 4, y: 5 }]));
    expect(tileSet(footprintTiles(sofa2x1, origin, 3))).toEqual(tileSet([{ x: 5, y: 5 }, { x: 5, y: 4 }]));
  });

  it("keeps the origin tile in the footprint for a 2x2 at every rotation", () => {
    const origin = { x: 10, y: 10 };
    for (const r of [0, 1, 2, 3] as const) {
      const tiles = footprintTiles(table2x2, origin, r);
      expect(tiles).toHaveLength(4);
      expect(tileSet(tiles).has("10,10")).toBe(true);
    }
  });
});

describe("canPlace", () => {
  it("rejects out-of-bounds placements (including rotated overhang)", () => {
    const state = createState(1, CONTENT);
    expect(canPlace(state, table2x2, { x: 63, y: 63 }, 0)).toBe(false);
    expect(canPlace(state, table2x2, { x: -1, y: 5 }, 0)).toBe(false);
    // r2 extends to negative x from the origin.
    expect(canPlace(state, sofa2x1, { x: 0, y: 0 }, 2)).toBe(false);
    expect(canPlace(state, table2x2, { x: 0, y: 0 }, 0)).toBe(true);
  });

  it("rejects overlap with an existing object", () => {
    const state = createState(1, CONTENT);
    placeObject(state, table2x2, { x: 10, y: 10 }, 0); // covers 10..11 x 10..11
    expect(canPlace(state, table2x2, { x: 11, y: 11 }, 0)).toBe(false);
    expect(canPlace(state, counter1x1, { x: 11, y: 10 }, 0)).toBe(false);
    expect(canPlace(state, table2x2, { x: 12, y: 10 }, 0)).toBe(true);
  });
});

describe("placement and pathfinding", () => {
  it("blocks pathfinding; A* routes around a placed 2x2 object", () => {
    const state = createState(1, CONTENT);
    const obj = placeObject(state, table2x2, { x: 6, y: 4 }, 0); // covers 6..7 x 4..5
    expect(state.lot.navVersion).toBe(1);

    const blocked = tileSet(footprintTiles(table2x2, obj.tile, obj.rotation));
    const path = findPath(state.lot, { x: 4, y: 5 }, { x: 9, y: 5 });
    expect(path).not.toBeNull();
    // Detour: never through the footprint, so it must leave the straight
    // y=5 row that the footprint cuts.
    for (const t of path!) expect(blocked.has(`${t.x},${t.y}`)).toBe(false);
    expect(path!.some((t) => t.y !== 5)).toBe(true);
  });

  it("remove unblocks tiles and bumps navVersion", () => {
    const state = createState(1, CONTENT);
    const obj = placeObject(state, table2x2, { x: 6, y: 4 }, 0);
    expect(isWalkable(state.lot, 6, 4)).toBe(false);

    removeObject(state, obj, table2x2);
    expect(state.lot.navVersion).toBe(2);
    expect(state.objects.size).toBe(0);
    for (const t of footprintTiles(table2x2, { x: 6, y: 4 }, 0)) {
      expect(isWalkable(state.lot, t.x, t.y)).toBe(true);
    }
    const path = findPath(state.lot, { x: 4, y: 5 }, { x: 9, y: 5 });
    expect(path!.length).toBe(5); // straight line again
  });
});

describe("resolveSlots", () => {
  // Same rotation convention as footprints; facing 'object' looks from the
  // slot tile back toward the origin tile. With iso facings: -y = ne, +y = sw,
  // +x = se, -x = nw.
  it("rotates a [0,1] 'object'-facing slot through all 4 rotations", () => {
    const origin = { x: 10, y: 10 };
    // r0: slot south of origin at (10,11), looks north (-y) → 'ne'.
    expect(resolveSlots(fridge1x1, origin, 0)[0]).toEqual({ type: "stand", tile: { x: 10, y: 11 }, facing: "ne" });
    // r1: offset (0,1) → (-1,0): slot west at (9,10), looks east (+x) → 'se'.
    expect(resolveSlots(fridge1x1, origin, 1)[0]).toEqual({ type: "stand", tile: { x: 9, y: 10 }, facing: "se" });
    // r2: offset → (0,-1): slot north at (10,9), looks south (+y) → 'sw'.
    expect(resolveSlots(fridge1x1, origin, 2)[0]).toEqual({ type: "stand", tile: { x: 10, y: 9 }, facing: "sw" });
    // r3: offset → (1,0): slot east at (11,10), looks west (-x) → 'nw'.
    expect(resolveSlots(fridge1x1, origin, 3)[0]).toEqual({ type: "stand", tile: { x: 11, y: 10 }, facing: "nw" });
  });

  it("a slot on the origin tile faces the object's rotated front", () => {
    const origin = { x: 20, y: 20 };
    // Front is +y (sw) at r0 and rotates with the object.
    expect(resolveSlots(sofa2x1, origin, 0)[0]!.facing).toBe("sw");
    expect(resolveSlots(sofa2x1, origin, 1)[0]!.facing).toBe("nw");
    expect(resolveSlots(sofa2x1, origin, 2)[0]!.facing).toBe("ne");
    expect(resolveSlots(sofa2x1, origin, 3)[0]!.facing).toBe("se");
  });
});

describe("object commands and serialization", () => {
  it("PlaceObject validates and returns the new object id", () => {
    const sim = createSim({ seed: 1, content: CONTENT });

    expect(sim.apply({ t: "PlaceObject", defId: "no_such_def", tile: { x: 5, y: 5 }, rotation: 0 })).toEqual({
      ok: false,
      error: "unknown-def",
    });

    const placed = sim.apply({ t: "PlaceObject", defId: "table_2x2", tile: { x: 5, y: 5 }, rotation: 0 });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.objectId).toBeDefined();

    // Overlapping and out-of-bounds placements are rejected.
    expect(sim.apply({ t: "PlaceObject", defId: "counter_1x1", tile: { x: 6, y: 6 }, rotation: 0 })).toEqual({
      ok: false,
      error: "invalid-placement",
    });
    expect(sim.apply({ t: "PlaceObject", defId: "table_2x2", tile: { x: 63, y: 0 }, rotation: 0 })).toEqual({
      ok: false,
      error: "invalid-placement",
    });

    const snap = sim.snapshot();
    expect(snap.objects).toEqual([
      { id: placed.objectId, defId: "table_2x2", x: 5, y: 5, rotation: 0, objState: "default" },
    ]);
  });

  it("RemoveObject frees the tiles again", () => {
    const sim = createSim({ seed: 1, content: CONTENT });
    const placed = sim.apply({ t: "PlaceObject", defId: "counter_1x1", tile: { x: 8, y: 8 }, rotation: 0 });
    if (!placed.ok || placed.objectId === undefined) throw new Error("place failed");

    expect(sim.apply({ t: "RemoveObject", object: placed.objectId })).toEqual({ ok: true });
    expect(sim.apply({ t: "RemoveObject", object: placed.objectId })).toEqual({
      ok: false,
      error: "unknown-object",
    });
    expect(sim.snapshot().objects).toEqual([]);
    // Tile is placeable again.
    expect(sim.apply({ t: "PlaceObject", defId: "counter_1x1", tile: { x: 8, y: 8 }, rotation: 0 }).ok).toBe(true);
  });

  it("serialize → load round-trips objects and preserves the state hash", () => {
    const sim = createSim({ seed: 42, content: CONTENT });
    sim.apply({ t: "AddPerson", name: "Test Folk", x: 1, y: 1 });
    sim.apply({ t: "PlaceObject", defId: "table_2x2", tile: { x: 20, y: 20 }, rotation: 1 });
    sim.apply({ t: "PlaceObject", defId: "sofa_2x1", tile: { x: 30, y: 12 }, rotation: 3 });
    sim.tick(500);

    const saved = sim.serialize();
    const loaded = loadSim(saved, CONTENT);
    expect(loaded.hashState()).toBe(sim.hashState());
    expect(loaded.snapshot().objects).toEqual(sim.snapshot().objects);

    // Resumed sim stays behaviorally identical (placement rules included).
    expect(loaded.apply({ t: "PlaceObject", defId: "counter_1x1", tile: { x: 20, y: 20 }, rotation: 0 })).toEqual({
      ok: false,
      error: "invalid-placement",
    });
    sim.tick(100);
    loaded.tick(100);
    expect(loaded.hashState()).toBe(sim.hashState());
  });
});
