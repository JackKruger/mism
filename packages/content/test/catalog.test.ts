import { describe, expect, it } from "vitest";
import { loadContent, toSimContent, type Motive } from "../src/index.js";

/**
 * M1 catalog-wide tests (C-101…C-110): every shipped file validates, the
 * toSimContent bridge emits exactly the sim's structural shape, and the ad
 * economy covers every decaying motive an object can restore.
 */

const M1_OBJECT_IDS = [
  "fridge_econocool",
  "stove_sizzleworks",
  "counter_plainview",
  "toilet_comfyflush",
  "shower_drenchmaster",
  "bed_dreamtime",
  "sofa_sagfree",
  "tv_tubevision",
  // C-109/C-110 mess chain
  "dirty_plate",
  "trash_pile",
] as const;

describe("M1 object catalog", () => {
  const bundle = loadContent();

  it("ships all ten M1 objects", () => {
    expect(bundle.objects.map((o) => o.id).sort()).toEqual([...M1_OBJECT_IDS].sort());
  });

  it("uses the agreed footprints", () => {
    const byId = new Map(bundle.objects.map((o) => [o.id, o]));
    for (const id of M1_OBJECT_IDS) {
      const expected = id === "bed_dreamtime" || id === "sofa_sagfree" ? [2, 1] : [1, 1];
      expect(byId.get(id)!.footprint, id).toEqual(expected);
    }
  });

  it("mess objects are non-blocking with the agreed mess ratings", () => {
    const byId = new Map(bundle.objects.map((o) => [o.id, o]));
    expect(byId.get("dirty_plate")!.blocksTile).toBe(false);
    expect(byId.get("dirty_plate")!.messRating).toBe(3);
    expect(byId.get("trash_pile")!.blocksTile).toBe(false);
    expect(byId.get("trash_pile")!.messRating).toBe(5);
    // Everything else stays blocking (field omitted = default true).
    for (const obj of bundle.objects) {
      if (obj.id === "dirty_plate" || obj.id === "trash_pile") continue;
      expect(obj.blocksTile, obj.id).toBeUndefined();
      expect(obj.messRating, obj.id).toBeUndefined();
    }
  });

  it("gives the sofa two sit slots on its own tiles", () => {
    const sofa = bundle.objects.find((o) => o.id === "sofa_sagfree")!;
    expect(sofa.slots).toEqual([
      { type: "sit", offset: [0, 0], facing: "away" },
      { type: "sit", offset: [1, 0], facing: "away" },
    ]);
  });

  it("keeps every interaction slot index within its object's slots", () => {
    const interactionsById = new Map(bundle.interactions.map((i) => [i.id, i]));
    for (const obj of bundle.objects) {
      for (const ref of obj.interactions) {
        const def = interactionsById.get(ref)!;
        if (typeof def.slot === "number") {
          expect(def.slot, `${obj.id} → ${ref}`).toBeLessThan(obj.slots.length);
        }
      }
    }
  });

  it("keeps ad magnitudes in the 30–70 band", () => {
    for (const def of bundle.interactions) {
      for (const [motive, value] of Object.entries(def.ad)) {
        if (value === undefined) continue;
        expect(Math.abs(value), `${def.id} ad.${motive}`).toBeGreaterThanOrEqual(30);
        expect(Math.abs(value), `${def.id} ad.${motive}`).toBeLessThanOrEqual(70);
      }
    }
  });
});

describe("toSimContent", () => {
  const bundle = loadContent();
  const sim = toSimContent(bundle);

  it("emits one sim object per catalog object with only the sim's fields", () => {
    expect(sim.objects).toHaveLength(bundle.objects.length);
    const allowed = ["blocksTile", "footprint", "id", "interactions", "messRating", "slots"];
    for (const obj of sim.objects) {
      for (const key of Object.keys(obj)) {
        expect(allowed, `${obj.id}.${key}`).toContain(key);
      }
    }
    const fridge = sim.objects.find((o) => o.id === "fridge_econocool")!;
    expect(Object.keys(fridge).sort()).toEqual(["footprint", "id", "interactions", "slots"]);
    expect(fridge.footprint).toEqual([1, 1]);
    expect(fridge.interactions).toEqual(["fridge.have_snack", "fridge.have_meal"]);
    expect(fridge.slots).toEqual([{ type: "stand", offset: [0, 1], facing: "object" }]);
  });

  it("forwards blocksTile and messRating for mess objects", () => {
    const plate = sim.objects.find((o) => o.id === "dirty_plate")!;
    expect(plate.blocksTile).toBe(false);
    expect(plate.messRating).toBe(3);
    const trash = sim.objects.find((o) => o.id === "trash_pile")!;
    expect(trash.blocksTile).toBe(false);
    expect(trash.messRating).toBe(5);
  });

  it("strips authoring-only interaction fields (name/cost/requires/onFail)", () => {
    expect(sim.interactions).toHaveLength(bundle.interactions.length);
    const allowedTop = ["ad", "id", "interruptible", "slot", "states"];
    const allowedState = ["do", "durationMin", "next", "perMin", "untilMotive"];
    for (const def of sim.interactions) {
      for (const key of Object.keys(def)) {
        expect(allowedTop, `${def.id}.${key}`).toContain(key);
      }
      for (const [name, state] of Object.entries(def.states)) {
        for (const key of Object.keys(state)) {
          expect(allowedState, `${def.id}.states.${name}.${key}`).toContain(key);
        }
      }
      if (def.interruptible !== undefined) {
        expect(Object.keys(def.interruptible)).toEqual(["below"]);
      }
    }
    // stove.cook_meal authors an onFail; the sim never sees it.
    const cook = sim.interactions.find((i) => i.id === "stove.cook_meal")!;
    expect(cook.states["start"]).toEqual({
      do: "anim:cook",
      durationMin: 15,
      next: "eat",
    });
  });

  it("forwards numeric slot indices and interruption thresholds", () => {
    const sleep = sim.interactions.find((i) => i.id === "bed.sleep")!;
    expect(sleep.slot).toBe(0);
    expect(sleep.interruptible).toEqual({ below: { bladder: -90, hunger: -85 } });
    expect(sleep.states["sleep"]!.untilMotive).toEqual({ motive: "energy", gte: 95 });
  });
});

describe("ad coverage", () => {
  it("advertises every object-servable motive (all but social)", () => {
    const bundle = loadContent();
    const interactionsById = new Map(bundle.interactions.map((i) => [i.id, i]));
    const advertised = new Set<Motive>();
    for (const obj of bundle.objects) {
      for (const ref of obj.interactions) {
        const def = interactionsById.get(ref)!;
        for (const [motive, value] of Object.entries(def.ad)) {
          if (value !== undefined && value > 0) advertised.add(motive as Motive);
        }
      }
    }
    // room joined with C-109/C-110: mess objects advertise their own cleanup.
    const required: Motive[] = ["hunger", "comfort", "hygiene", "bladder", "energy", "fun", "room"];
    for (const motive of required) {
      expect(advertised.has(motive), `no object advertises ${motive}`).toBe(true);
    }
  });
});
