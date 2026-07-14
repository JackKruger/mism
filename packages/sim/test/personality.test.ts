import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, TUNING, createSim } from "../src/index.js";
import type { Personality } from "../src/index.js";
import { decayModifierFor, defaultPersonality } from "../src/people/personality.js";

const traits = (overrides: Partial<Personality>): Personality => ({
  ...defaultPersonality(),
  ...overrides,
});

describe("personality (S-103)", () => {
  it("maps traits to decay modifiers per the tuning table", () => {
    for (const { trait, motive, maxEffect } of TUNING.personality.decayMods) {
      expect(decayModifierFor(traits({ [trait]: 10 }), motive)).toBeCloseTo(1 - maxEffect, 10);
      expect(decayModifierFor(traits({ [trait]: 0 }), motive)).toBeCloseTo(1 + maxEffect, 10);
      expect(decayModifierFor(traits({ [trait]: 5 }), motive)).toBeCloseTo(1, 10);
    }
    // Motives without a table entry are unaffected by any trait.
    expect(decayModifierFor(traits({ neat: 10, active: 0, playful: 10 }), "hunger")).toBe(1);
  });

  it("neat 10 vs neat 0: hygiene decay differs by the tuning table amounts", () => {
    const sim = createSim({ seed: 1 });
    const add = (name: string, x: number, personality: Personality) => {
      const res = sim.apply({ t: "AddPerson", name, x, y: 5, personality });
      if (!res.ok) throw new Error("AddPerson failed");
    };
    add("Neat Nel", 5, traits({ neat: 10 }));
    add("Sloppy Sam", 10, traits({ neat: 0 }));

    sim.tick(300 * TICKS_PER_SIM_MINUTE); // 5 sim-hours, before any accidents
    const [nel, sam] = sim.snapshot().people;
    const dropNel = 100 - nel!.needs.hygiene;
    const dropSam = 100 - sam!.needs.hygiene;
    // Table says ×0.7 vs ×1.3 — the drops must sit in that exact ratio.
    expect(dropSam / dropNel).toBeCloseTo(1.3 / 0.7, 1);
  });

  it("AddPerson defaults to all-5s personality", () => {
    const sim = createSim({ seed: 1 });
    expect(sim.apply({ t: "AddPerson", name: "Plain Pat", x: 5, y: 5 }).ok).toBe(true);
    expect(sim.serialize().people[0]!.personality).toEqual(defaultPersonality());
  });

  it("AddPerson rejects out-of-range or non-integer traits", () => {
    const sim = createSim({ seed: 1 });
    const attempt = (personality: Personality) =>
      sim.apply({ t: "AddPerson", name: "Bad Egg", x: 5, y: 5, personality });
    expect(attempt(traits({ neat: 11 }))).toEqual({ ok: false, error: "invalid-personality" });
    expect(attempt(traits({ nice: -1 }))).toEqual({ ok: false, error: "invalid-personality" });
    expect(attempt(traits({ playful: 3.5 }))).toEqual({ ok: false, error: "invalid-personality" });
    expect(sim.snapshot().people).toHaveLength(0);
  });
});
