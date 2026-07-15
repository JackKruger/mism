import { describe, expect, it } from "vitest";
import { TICKS_PER_SIM_MINUTE, createSim } from "../src/index.js";
import type { SimContent } from "../src/index.js";
import type { PersonId, ObjectId } from "../src/core/ids.js";

/**
 * S-203 statechart interpreter tests: mirrors the content-package fridge
 * fixture (fridge.have_snack) as plain SimContent — the same shape the
 * client passes after validating the real bundle.
 */
const CONTENT: SimContent = {
  objects: [
    {
      id: "fridge",
      footprint: [1, 1],
      slots: [{ type: "stand", offset: [0, 1], facing: "object" }],
      interactions: ["fridge.have_snack"],
    },
  ],
  interactions: [
    {
      id: "fridge.have_snack",
      ad: { hunger: 40 },
      slot: 0,
      states: {
        start: { do: "anim:eat", perMin: { hunger: 8 }, untilMotive: { motive: "hunger", gte: 90 } },
      },
      interruptible: { below: { bladder: -85 } },
    },
  ],
};

function setup(personTileX = 10, personTileY = 10) {
  const sim = createSim({ seed: 5, content: CONTENT });
  const pRes = sim.apply({ t: "AddPerson", name: "Hungry Hana", x: personTileX, y: personTileY });
  if (!pRes.ok || pRes.personId === undefined) throw new Error("AddPerson failed");
  const oRes = sim.apply({ t: "PlaceObject", defId: "fridge", tile: { x: 20, y: 20 }, rotation: 0 });
  if (!oRes.ok || oRes.objectId === undefined) throw new Error("PlaceObject failed");
  return { sim, person: pRes.personId as PersonId, fridge: oRes.objectId as ObjectId };
}

describe("interaction statechart interpreter", () => {
  it("routes to the fridge slot, eats until hunger ≥ 90, and completes", () => {
    const { sim, person, fridge } = setup();
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -50 });
    expect(sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" }).ok).toBe(true);

    // Route (~14 tiles ≈ 3 sim-min) + eat from -50 to 90 at +8/min net ≈ 18 min.
    sim.tick(30 * TICKS_PER_SIM_MINUTE);

    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.needs.hunger).toBeGreaterThanOrEqual(89);
    expect(view.activity).toBeNull(); // finished
    expect(view.queueLength).toBe(0);
    // Person ends standing on the slot tile (south of the fridge at r0).
    expect(view.x).toBeCloseTo(20, 5);
    expect(view.y).toBeCloseTo(21, 5);

    const types = sim.snapshot().events.map((e) => e.type);
    expect(types).toContain("InteractionStarted");
    expect(types).toContain("InteractionCompleted");
  });

  it("shows the eat activity while the interaction runs", () => {
    const { sim, person, fridge } = setup(20, 22); // one tile from the slot
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: 0 });
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" });
    sim.tick(3 * TICKS_PER_SIM_MINUTE);
    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.activity).toBe("eat");
    expect(view.queueLength).toBe(1);
  });

  it("a bladder emergency interrupts eating", () => {
    const { sim, person, fridge } = setup(20, 22);
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -80 });
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" });
    sim.tick(2 * TICKS_PER_SIM_MINUTE); // arrive + start eating
    sim.apply({ t: "DebugSetNeed", person, motive: "bladder", value: -90 });
    sim.tick(2);
    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.activity).toBeNull();
    expect(sim.snapshot().events.map((e) => e.type)).toContain("InteractionInterrupted");
  });

  it("fails with an event when the fridge is unreachable", () => {
    const { sim, person, fridge } = setup(2, 2);
    // Wall the fridge area off completely with a ring of counters... simpler:
    // remove reachability by surrounding the slot tile using objects.
    for (const [x, y] of [[19, 21], [21, 21], [20, 22], [19, 20], [21, 20], [19, 22], [21, 22]] as const) {
      const res = sim.apply({ t: "PlaceObject", defId: "fridge", tile: { x, y }, rotation: 0 });
      if (!res.ok) throw new Error("setup placement failed");
    }
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" });
    sim.tick(5);
    const events = sim.snapshot().events;
    expect(events.some((e) => e.type === "InteractionFailed" && e.data?.["reason"] === "unreachable")).toBe(true);
  });

  it("a player WalkTo cancels the queue and the running interaction", () => {
    const { sim, person, fridge } = setup(20, 22);
    sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -80 });
    sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" });
    sim.tick(2 * TICKS_PER_SIM_MINUTE);
    expect(sim.apply({ t: "WalkTo", person, x: 5, y: 5 }).ok).toBe(true);
    sim.tick(1);
    const view = sim.snapshot().people.find((p) => p.id === person)!;
    expect(view.activity).toBeNull();
    expect(view.queueLength).toBe(0); // walk isn't a queued interaction
  });

  it("stays deterministic with interactions in the mix", () => {
    const run = () => {
      const { sim, person, fridge } = setup();
      sim.apply({ t: "DebugSetNeed", person, motive: "hunger", value: -70 });
      sim.apply({ t: "QueueInteraction", person, object: fridge, interaction: "fridge.have_snack" });
      sim.tick(20_000);
      return sim.hashState();
    };
    expect(run()).toBe(run());
  });
});
