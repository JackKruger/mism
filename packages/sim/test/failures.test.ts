import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, TUNING, createSim } from "../src/index.js";
import { STARVATION_TICKS } from "../src/systems/needsDecay.js";
import type { PersonId } from "../src/core/ids.js";

const TICKS_PER_HOUR = 60 * TICKS_PER_SIM_MINUTE;

function addPerson(sim: ReturnType<typeof createSim>, x = 5, y = 5): PersonId {
  const res = sim.apply({ t: "AddPerson", name: "Test Folk", x, y });
  if (!res.ok || res.personId === undefined) throw new Error("AddPerson failed");
  return res.personId;
}

const person = (sim: ReturnType<typeof createSim>) => sim.snapshot().people[0]!;

describe("failure states (S-104)", () => {
  it("bladder accident: resets bladder to +100 and crashes hygiene by 50", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    sim.tick(Math.ceil(8 * TICKS_PER_HOUR * 1.02));

    const events = sim.snapshot().events.filter((e) => e.type === "BladderAccident");
    expect(events).toHaveLength(1);

    // Bladder snapped back to +100 at the accident and has barely decayed since.
    expect(person(sim).needs.bladder).toBeGreaterThan(90);
    // Hygiene at ~8h would be ~+20 from decay alone; the extra -50 puts it ~-30.
    expect(person(sim).needs.hygiene).toBeGreaterThanOrEqual(-35);
    expect(person(sim).needs.hygiene).toBeLessThanOrEqual(-25);
  });

  it("energy collapse: passes out mid-walk, path cleared, wakes at -20", () => {
    const sim = createSim({ seed: 1 });
    const id = addPerson(sim, 1, 1);

    // Start a long walk just before the ~18h collapse point.
    sim.tick(18 * TICKS_PER_HOUR - 100);
    expect(sim.apply({ t: "WalkTo", person: id, x: 62, y: 62 }).ok).toBe(true);
    sim.tick(400);

    const collapsed = person(sim);
    expect(collapsed.status).toBe("passedOut");
    expect(collapsed.anim).toBe("idle");
    expect(collapsed.queueLength).toBe(0); // path cleared on collapse
    const passedOut = sim.snapshot().events.filter((e) => e.type === "PassedOut");
    expect(passedOut).toHaveLength(1);

    // Commands can't move an unconscious person.
    expect(sim.apply({ t: "WalkTo", person: id, x: 10, y: 10 })).toEqual({
      ok: false,
      error: "person-incapacitated",
    });

    // Regen 2.5/min from -100 → wake at -20 after 32 sim-min (640 ticks);
    // we're ~300 ticks in, so ~350 more gets just past the wake-up.
    const frozen = { x: collapsed.x, y: collapsed.y };
    sim.tick(350);
    const awake = person(sim);
    expect(awake.status).toBe("normal");
    expect(awake.x).toBe(frozen.x); // no movement while out
    expect(awake.y).toBe(frozen.y);
    expect(awake.needs.energy).toBeGreaterThanOrEqual(TUNING.failures.passedOutWakeEnergy - 2);
    const wokeUp = sim.snapshot().events.filter((e) => e.type === "WokeUp");
    expect(wokeUp).toHaveLength(1);
    expect(wokeUp[0]!.tick).toBeGreaterThan(passedOut[0]!.tick);
  });

  it("starvation: death exactly one tuned window after hunger pins at -100", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);

    // Find the tick where hunger first hits the floor (~16 sim-hours).
    // Snapshot needs are rounded, so read the raw value via serialize().
    sim.tick(Math.floor(16 * TICKS_PER_HOUR * 0.95));
    while (sim.serialize().people[0]!.needs.hunger > -100) sim.tick(1);
    const starvedAt = sim.snapshot().tick;

    sim.tick(STARVATION_TICKS - 1);
    expect(person(sim).status).not.toBe("dead");

    sim.tick(1);
    expect(person(sim).status).toBe("dead");
    const deaths = sim.snapshot().events.filter((e) => e.type === "Death");
    expect(deaths).toHaveLength(1);
    expect(deaths[0]!.tick).toBe(starvedAt + STARVATION_TICKS);
    expect(deaths[0]!.data).toEqual({ cause: "starvation" });
  });

  it("dead person: needs, mood and events freeze; commands are rejected", () => {
    const sim = createSim({ seed: 1 });
    const id = addPerson(sim);
    sim.tick(16 * TICKS_PER_HOUR + STARVATION_TICKS + TICKS_PER_HOUR); // safely past death
    expect(person(sim).status).toBe("dead");

    const before = person(sim);
    const eventCountBefore = sim.snapshot().events.length;
    sim.tick(5000);
    const after = person(sim);
    expect(after.needs).toEqual(before.needs);
    expect(after.mood).toBe(before.mood);
    expect(after.status).toBe("dead");
    expect(sim.snapshot().events.length).toBe(eventCountBefore);

    expect(sim.apply({ t: "WalkTo", person: id, x: 10, y: 10 })).toEqual({
      ok: false,
      error: "person-incapacitated",
    });
  });

  it("snapshot(sinceTick) only returns newer events", () => {
    const sim = createSim({ seed: 1 });
    addPerson(sim);
    sim.tick(9 * TICKS_PER_HOUR); // one bladder accident by now
    const firstBatch = sim.snapshot().events;
    expect(firstBatch.length).toBeGreaterThan(0);
    const lastSeen = firstBatch[firstBatch.length - 1]!.tick;
    expect(sim.snapshot(lastSeen).events).toHaveLength(0);
    sim.tick(8 * TICKS_PER_HOUR + TICKS_PER_HOUR); // next accident
    expect(sim.snapshot(lastSeen).events.length).toBeGreaterThan(0);
  });
});
