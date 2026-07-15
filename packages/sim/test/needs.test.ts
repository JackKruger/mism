import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, TUNING, createSim } from "../src/index.js";
import { MOTIVES } from "../src/people/needs.js";
import type { PersonId } from "../src/core/ids.js";

const TICKS_PER_HOUR = 60 * TICKS_PER_SIM_MINUTE;

function addPerson(sim: ReturnType<typeof createSim>, x = 5, y = 5): PersonId {
  const res = sim.apply({ t: "AddPerson", name: "Test Folk", x, y });
  if (!res.ok || res.personId === undefined) throw new Error("AddPerson failed");
  return res.personId;
}

const personNeeds = (sim: ReturnType<typeof createSim>) => sim.snapshot().people[0]!.needs;

describe("needs decay (S-101)", () => {
  it("base decay rates empty each motive in the tuned sim-hours", () => {
    const expectedHours = {
      hunger: 16,
      energy: 18,
      comfort: 12,
      fun: 14,
      social: 24,
      hygiene: 20,
      bladder: 8,
    } as const;
    for (const [motive, hours] of Object.entries(expectedHours)) {
      const rate = TUNING.needs.baseDecayPerMinute[motive as keyof typeof expectedHours];
      expect(rate, motive).toBeCloseTo(200 / (hours * 60), 10);
    }
    expect(TUNING.needs.baseDecayPerMinute.room).toBe(0);
  });

  it("bladder hits -100 (accident) in ~8 sim-hours ±5%", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    const expected = 8 * TICKS_PER_HOUR;

    sim.tick(Math.floor(expected * 0.95));
    expect(sim.snapshot().events.filter((e) => e.type === "BladderAccident")).toHaveLength(0);

    sim.tick(Math.ceil(expected * 0.1));
    const events = sim.snapshot().events.filter((e) => e.type === "BladderAccident");
    expect(events).toHaveLength(1);
    expect(events[0]!.tick).toBeGreaterThanOrEqual(expected * 0.95);
    expect(events[0]!.tick).toBeLessThanOrEqual(expected * 1.05);
  });

  it("hunger empties in ~16 sim-hours ±5%", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    const expected = 16 * TICKS_PER_HOUR;

    sim.tick(Math.floor(expected * 0.95));
    expect(personNeeds(sim).hunger).toBeGreaterThan(-100);

    sim.tick(Math.ceil(expected * 0.1));
    expect(personNeeds(sim).hunger).toBe(-100);
  });

  it("energy empties (collapse) in ~18 sim-hours ±5%", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    const expected = 18 * TICKS_PER_HOUR;

    sim.tick(Math.ceil(expected * 1.05));
    const events = sim.snapshot().events.filter((e) => e.type === "PassedOut");
    expect(events).toHaveLength(1);
    expect(events[0]!.tick).toBeGreaterThanOrEqual(expected * 0.95);
    expect(events[0]!.tick).toBeLessThanOrEqual(expected * 1.05);
  });

  it("clamps every motive to [-100, 100] over a long run", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    sim.tick(30 * TICKS_PER_HOUR);
    const needs = personNeeds(sim);
    for (const motive of MOTIVES) {
      expect(needs[motive], motive).toBeGreaterThanOrEqual(-100);
      expect(needs[motive], motive).toBeLessThanOrEqual(100);
    }
    expect(needs.hunger).toBe(-100); // pinned at the floor, not below
  });

  it("room does not decay (environmental motive)", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    sim.tick(12 * TICKS_PER_HOUR);
    expect(personNeeds(sim).room).toBe(0);
  });
});
