import type { ContentBundle, InteractionDef, Motive, ObjectDef } from "@homestead/content";
import type { SimContent, SimInteractionDef, SimObjectDef } from "@homestead/sim";

/**
 * Maps the validated content bundle onto the sim's structural mirror types
 * (sim/src/objects/content.ts). Deliberately tolerant: only fields the sim
 * types declare are copied, so content may carry authoring-only fields
 * (price, requires, cost, onFail, …) without the sim ever seeing them.
 */

type SimStateDef = SimInteractionDef["states"][string];

/** Copy a partial motive record, dropping explicit-undefined entries. */
function mapMotives(src: Partial<Record<Motive, number | undefined>>): Partial<Record<Motive, number>> {
  const out: Partial<Record<Motive, number>> = {};
  for (const [motive, value] of Object.entries(src) as [Motive, number | undefined][]) {
    if (value !== undefined) out[motive] = value;
  }
  return out;
}

function toSimObject(def: ObjectDef): SimObjectDef {
  const out: SimObjectDef = {
    id: def.id,
    footprint: [def.footprint[0], def.footprint[1]],
    slots: def.slots.map((slot) => ({
      type: slot.type,
      offset: [slot.offset[0], slot.offset[1]] as [number, number],
      facing: slot.facing,
    })),
    interactions: [...def.interactions],
  };
  // Optional physics/scoring fields: forwarded only when authored, so
  // untouched defs keep the sim's defaults (blocking, mess 0).
  if (def.blocksTile !== undefined) out.blocksTile = def.blocksTile;
  if (def.messRating !== undefined) out.messRating = def.messRating;
  return out;
}

function toSimInteraction(def: InteractionDef): SimInteractionDef {
  const states: Record<string, SimStateDef> = {};
  for (const [name, s] of Object.entries(def.states)) {
    const state: SimStateDef = {};
    if (s.do !== undefined) state.do = s.do;
    if (s.durationMin !== undefined) state.durationMin = s.durationMin;
    if (s.perMin !== undefined) state.perMin = mapMotives(s.perMin);
    if (s.untilMotive !== undefined) {
      state.untilMotive = { motive: s.untilMotive.motive, gte: s.untilMotive.gte };
    }
    if (s.next !== undefined) state.next = s.next;
    states[name] = state;
  }
  const out: SimInteractionDef = { id: def.id, ad: mapMotives(def.ad), states };
  if (typeof def.slot === "number") out.slot = def.slot;
  if (def.interruptible?.below !== undefined) {
    out.interruptible = { below: mapMotives(def.interruptible.below) };
  }
  return out;
}

/** Convert the loaded content bundle into the plain data shape createSim accepts. */
export function toSimContent(bundle: ContentBundle): SimContent {
  return {
    objects: bundle.objects.map(toSimObject),
    interactions: bundle.interactions.map(toSimInteraction),
  };
}
