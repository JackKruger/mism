import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, createSim, loadSim } from "../src/index.js";
import type { SimContent } from "../src/index.js";
import type { PersonId, ObjectId } from "../src/core/ids.js";
import { TUNING } from "../src/tuning.js";

/**
 * S-204/S-205 autonomy tests: inline SimContent mirroring the content-package
 * shapes (same pattern as interactions.test.ts). The fridge advertises hunger,
 * the TV fun — a starving person must walk past the TV to the fridge.
 */
const CONTENT: SimContent = {
  objects: [
    {
      id: "fridge",
      footprint: [1, 1],
      slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
      interactions: ["fridge.have_snack"],
    },
    {
      id: "tv",
      footprint: [1, 1],
      slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
      interactions: ["tv.watch"],
    },
    {
      id: "sofa",
      footprint: [1, 1],
      slots: [{ type: "sit", offset: [0, 1], facing: "object" }],
      interactions: ["sofa.rest"],
    },
    // Inert blocker for walling areas off (no ads).
    { id: "crate", footprint: [1, 1], slots: [], interactions: [] },
  ],
  interactions: [
    {
      id: "fridge.have_snack",
      ad: { hunger: 40 },
      slot: 0,
      states: {
        start: { do: "anim:eat", perMin: { hunger: 8 }, untilMotive: { motive: "hunger", gte: 90 } },
      },
    },
    {
      id: "tv.watch",
      ad: { fun: 40 },
      slot: 0,
      states: {
        start: { do: "anim:watch", perMin: { fun: 10 }, untilMotive: { motive: "fun", gte: 90 } },
      },
    },
    {
      id: "sofa.rest",
      ad: { comfort: 30 },
      slot: 0,
      states: {
        start: { do: "anim:sit", perMin: { comfort: 10 }, untilMotive: { motive: "comfort", gte: 90 } },
      },
    },
  ],
};

type Sim = ReturnType<typeof createSim>;

function addPerson(sim: Sim, x: number, y: number): PersonId {
  const res = sim.apply({ t: "AddPerson", name: "Auto Ann", x, y });
  if (!res.ok || res.personId === undefined) throw new Error("AddPerson failed");
  return res.personId;
}

function place(sim: Sim, defId: string, x: number, y: number): ObjectId {
  const res = sim.apply({ t: "PlaceObject", defId, tile: { x, y }, rotation: 0 });
  if (!res.ok || res.objectId === undefined) throw new Error(`PlaceObject ${defId} failed`);
  return res.objectId;
}

const startedInteractions = (sim: Sim): string[] =>
  sim.snapshot().events
    .filter((e) => e.type === "InteractionStarted")
    .map((e) => String(e.data?.["interaction"]));

describe("autonomy (S-204/S-205)", () => {
  it("a starving person walks past the TV to the fridge and eats", () => {
    const sim = createSim({ seed: 11, content: CONTENT });
    const person = addPerson(sim, 10, 10);
    place(sim, "tv", 12, 10); // nearer than the fridge, but fun is full
    place(sim, "fridge", 20, 20);
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -90 });

    // Re-plan gate (2 sim-min) + walk (~3) + eat -90 → 90 (~24) < 40 sim-min.
    sim.tick(40 * TICKS_PER_SIM_MINUTE);

    const started = startedInteractions(sim);
    expect(started).toContain("fridge.have_snack");
    expect(started).not.toContain("tv.watch");
    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.needs.hunger).toBeGreaterThanOrEqual(85);
    // Ends idle on the fridge slot (south of the fridge at r0).
    expect(view.x).toBeCloseTo(20, 5);
    expect(view.y).toBeCloseTo(21, 5);
    expect(view.activity).toBeNull();
  });

  it("a fully satisfied person queues nothing over 2 sim-hours", () => {
    const sim = createSim({ seed: 12, content: CONTENT });
    const person = addPerson(sim, 5, 5);
    place(sim, "fridge", 40, 40);
    place(sim, "tv", 45, 40);

    sim.tick(120 * TICKS_PER_SIM_MINUTE);

    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.queueLength).toBe(0);
    expect(view.x).toBeCloseTo(5, 5);
    expect(view.y).toBeCloseTo(5, 5);
    expect(startedInteractions(sim)).toEqual([]);
  });

  it("suppresses an unreachable ad and retries only after the window expires", () => {
    const sim = createSim({ seed: 13, content: CONTENT });
    const person = addPerson(sim, 5, 5);
    place(sim, "fridge", 20, 20);
    // Wall the fridge slot (20,21) off with inert crates.
    for (const [x, y] of [[19, 20], [21, 20], [19, 21], [21, 21], [19, 22], [20, 22], [21, 22]] as const) {
      place(sim, "crate", x, y);
    }
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -90 });

    const failures = () =>
      sim.snapshot().events.filter(
        (e) => e.type === "InteractionFailed" && e.data?.["reason"] === "unreachable",
      ).length;

    // First attempt fails at the first re-plan; the ad then stays suppressed
    // for suppressMinutes even though the person keeps re-planning.
    const suppressTicks = TUNING.autonomy.suppressMinutes * TICKS_PER_SIM_MINUTE;
    sim.tick(suppressTicks);
    expect(failures()).toBe(1);

    // Once the window passes, exactly one retry happens (then re-suppressed).
    sim.tick(10 * TUNING.autonomy.replanTicks);
    expect(failures()).toBe(2);
  });

  it("prefers a near object over an identical far one (attenuation)", () => {
    let near = 0;
    let far = 0;
    for (let seed = 0; seed < 20; seed++) {
      const sim = createSim({ seed, content: CONTENT });
      const person = addPerson(sim, 10, 10);
      const nearId = place(sim, "fridge", 12, 10);
      const farId = place(sim, "fridge", 60, 60);
      sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -90 });

      sim.tick(TUNING.autonomy.replanTicks + 5); // just past the first re-plan
      const p = sim.serialize().people.find((x) => x.id === person)!;
      const target = p.active?.object ?? p.queue[0]?.object;
      if (target === nearId) near++;
      else if (target === farId) far++;
    }
    expect(near + far).toBe(20); // every run chose a fridge
    expect(near).toBeGreaterThan(far); // and mostly the near one
    expect(near).toBeGreaterThanOrEqual(12);
  });

  it("stays deterministic: 2 people + 3 objects, 30k ticks twice → same hash", () => {
    const run = () => {
      const sim = createSim({ seed: 777, content: CONTENT });
      sim.apply({
        t: "AddPerson", name: "Neat Nel", x: 3, y: 3,
        personality: { neat: 10, outgoing: 2, active: 8, playful: 1, nice: 9 },
      });
      sim.apply({
        t: "AddPerson", name: "Sloppy Sam", x: 50, y: 40,
        personality: { neat: 0, outgoing: 9, active: 2, playful: 10, nice: 3 },
      });
      place(sim, "fridge", 20, 20);
      place(sim, "tv", 40, 15);
      place(sim, "sofa", 10, 45);
      sim.tick(30_000);
      return sim.hashState();
    };
    expect(run()).toBe(run());
  });

  it("serialize → load → resume matches (lastPlanTick + suppressions round-trip)", () => {
    const mkSim = () => {
      const sim = createSim({ seed: 888, content: CONTENT });
      addPerson(sim, 3, 3);
      addPerson(sim, 50, 40);
      place(sim, "fridge", 20, 20);
      place(sim, "tv", 40, 15);
      place(sim, "sofa", 10, 45);
      // An unreachable fridge seeds suppression entries that must round-trip.
      place(sim, "fridge", 60, 60);
      for (const [x, y] of [[59, 60], [61, 60], [59, 61], [60, 61], [61, 61], [59, 62], [60, 62], [61, 62]] as const) {
        place(sim, "crate", x, y);
      }
      return sim;
    };

    const uninterrupted = mkSim();
    uninterrupted.tick(30_000);

    const first = mkSim();
    first.tick(15_000);
    // JSON round-trip proves the new fields are plain-data clean.
    const resumed = loadSim(JSON.parse(JSON.stringify(first.serialize())), CONTENT);
    resumed.tick(15_000);

    expect(resumed.hashState()).toBe(uninterrupted.hashState());
  });

  it("holds the tick budget: 4 people × 50 objects × 3 interactions under 2ms/tick", () => {
    const content: SimContent = {
      objects: [
        {
          id: "multi",
          footprint: [1, 1],
          slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
          interactions: ["multi.eat", "multi.play", "multi.rest"],
        },
      ],
      interactions: [
        {
          id: "multi.eat",
          ad: { hunger: 30 },
          states: { start: { do: "anim:eat", perMin: { hunger: 8 }, untilMotive: { motive: "hunger", gte: 90 } } },
        },
        {
          id: "multi.play",
          ad: { fun: 30 },
          states: { start: { do: "anim:play", perMin: { fun: 10 }, untilMotive: { motive: "fun", gte: 90 } } },
        },
        {
          id: "multi.rest",
          ad: { comfort: 30 },
          states: { start: { do: "anim:sit", perMin: { comfort: 10 }, untilMotive: { motive: "comfort", gte: 90 } } },
        },
      ],
    };
    const sim = createSim({ seed: 7, content });
    for (const [x, y] of [[1, 1], [60, 1], [1, 60], [60, 60]] as const) addPerson(sim, x, y);
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 5; row++) {
        place(sim, "multi", 3 + col * 6, 5 + row * 10);
      }
    }
    const start = Date.now();
    sim.tick(10_000);
    const msPerTick = (Date.now() - start) / 10_000;
    expect(msPerTick).toBeLessThan(2);
  });
});
