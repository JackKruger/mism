import { describe, expect, it } from "vitest";
import { loadContent, toSimContent, type Motive } from "../src/index.js";

/**
 * M1 catalog-wide tests (C-101…C-108): every shipped file validates, the
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
] as const;

describe("M1 object catalog", () => {
  const bundle = loadContent();

  it("ships all eight M1 objects", () => {
    expect(bundle.objects.map((o) => o.id).sort()).toEqual([...M1_OBJECT_IDS].sort());
  });

  it("uses the agreed footprints", () => {
    const byId = new Map(bundle.objects.map((o) => [o.id, o]));
    for (const id of M1_OBJECT_IDS) {
      const expected = id === "bed_dreamtime" || id === "sofa_sagfree" ? [2, 1] : [1, 1];
      expect(byId.get(id)!.footprint, id).toEqual(expected);
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
    for (const obj of sim.objects) {
      expect(Object.keys(obj).sort()).toEqual(["footprint", "id", "interactions", "slots"]);
    }
    const fridge = sim.objects.find((o) => o.id === "fridge_econocool")!;
    expect(fridge.footprint).toEqual([1, 1]);
    expect(fridge.interactions).toEqual(["fridge.have_snack", "fridge.have_meal"]);
    expect(fridge.slots).toEqual([{ type: "stand", offset: [0, 1], facing: "object" }]);
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
  it("advertises every decaying, object-servable motive (all but social/room)", () => {
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
    const required: Motive[] = ["hunger", "comfort", "hygiene", "bladder", "energy", "fun"];
    for (const motive of required) {
      expect(advertised.has(motive), `no object advertises ${motive}`).toBe(true);
    }
  });
});
