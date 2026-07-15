import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, createSim, loadSim } from "../src/index.js";
import type { PersonId } from "../src/core/ids.js";

function addPerson(sim: ReturnType<typeof createSim>, x: number, y: number): PersonId {
  const res = sim.apply({ t: "AddPerson", name: "Test Folk", x, y });
  if (!res.ok || res.personId === undefined) throw new Error("AddPerson failed");
  return res.personId;
}

describe("SimHandle", () => {
  it("walks a person to a clicked tile within the expected time", () => {
    const sim = createSim({ seed: 1 });
    const id = addPerson(sim, 5, 5);
    expect(sim.apply({ t: "WalkTo", person: id, x: 15, y: 5 }).ok).toBe(true);

    // 10 tiles at 5 tiles/sim-min = 2 sim-minutes; allow +1 for rounding.
    sim.tick(3 * TICKS_PER_SIM_MINUTE);
    const person = sim.snapshot().people.find((p) => p.id === id)!;
    expect(person.x).toBeCloseTo(15, 5);
    expect(person.y).toBeCloseTo(5, 5);
    expect(person.anim).toBe("idle");
  });

  it("rejects walking to a blocked or out-of-bounds tile", () => {
    const sim = createSim({ seed: 1 });
    const id = addPerson(sim, 5, 5);
    expect(sim.apply({ t: "WalkTo", person: id, x: -1, y: 5 })).toEqual({
      ok: false,
      error: "tile-blocked",
    });
  });

  it("is deterministic: same seed + same commands → same hash", () => {
    const run = () => {
      const sim = createSim({ seed: 12345 });
      const id = addPerson(sim, 3, 3);
      sim.tick(500);
      sim.apply({ t: "WalkTo", person: id, x: 40, y: 22 });
      sim.tick(5000);
      sim.apply({ t: "WalkTo", person: id, x: 1, y: 60 });
      sim.tick(5000);
      return sim.hashState();
    };
    expect(run()).toBe(run());
  });

  it("serialize → load → resume matches an uninterrupted run", () => {
    const mkSim = () => {
      const sim = createSim({ seed: 99 });
      const id = addPerson(sim, 10, 10);
      sim.apply({ t: "WalkTo", person: id, x: 50, y: 50 });
      return sim;
    };

    const uninterrupted = mkSim();
    uninterrupted.tick(2000);

    const first = mkSim();
    first.tick(1000);
    const resumed = loadSim(first.serialize());
    resumed.tick(1000);

    expect(resumed.hashState()).toBe(uninterrupted.hashState());
  });

  it("is deterministic with needs/personality: 2 people, 50k ticks twice → same hash", () => {
    const run = () => {
      const sim = createSim({ seed: 424242 });
      sim.apply({
        t: "AddPerson", name: "Neat Nel", x: 3, y: 3,
        personality: { neat: 10, outgoing: 2, active: 8, playful: 1, nice: 9 },
      });
      sim.apply({
        t: "AddPerson", name: "Sloppy Sam", x: 50, y: 40,
        personality: { neat: 0, outgoing: 9, active: 2, playful: 10, nice: 3 },
      });
      sim.tick(50_000);
      return sim.hashState();
    };
    expect(run()).toBe(run());
  });

  it("serialize → load → resume matches with needs, personality, status and events", () => {
    const mkSim = () => {
      const sim = createSim({ seed: 777 });
      const res = sim.apply({
        t: "AddPerson", name: "Neat Nel", x: 10, y: 10,
        personality: { neat: 10, outgoing: 2, active: 8, playful: 1, nice: 9 },
      });
      sim.apply({
        t: "AddPerson", name: "Sloppy Sam", x: 40, y: 40,
        personality: { neat: 0, outgoing: 9, active: 2, playful: 10, nice: 3 },
      });
      if (!res.ok || res.personId === undefined) throw new Error("AddPerson failed");
      sim.apply({ t: "WalkTo", person: res.personId, x: 55, y: 20 });
      return sim;
    };

    // 40k ticks covers bladder accidents, an energy collapse and a wake-up.
    const uninterrupted = mkSim();
    uninterrupted.tick(40_000);

    const first = mkSim();
    first.tick(20_000);
    // Round-trip through JSON to prove the save is plain-data clean.
    const resumed = loadSim(JSON.parse(JSON.stringify(first.serialize())));
    resumed.tick(20_000);

    expect(resumed.hashState()).toBe(uninterrupted.hashState());
    expect(resumed.snapshot().events).toEqual(uninterrupted.snapshot().events);
  });

  it("holds the tick budget: 10k ticks with 4 walkers well under 2ms mean", () => {
    const sim = createSim({ seed: 7 });
    const ids = [addPerson(sim, 1, 1), addPerson(sim, 60, 1), addPerson(sim, 1, 60), addPerson(sim, 60, 60)];
    for (const [i, id] of ids.entries()) {
      sim.apply({ t: "WalkTo", person: id, x: 32 + i, y: 32 });
    }
    const start = Date.now();
    sim.tick(10_000);
    const msPerTick = (Date.now() - start) / 10_000;
    expect(msPerTick).toBeLessThan(2);
  });
});
