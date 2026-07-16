import type { z } from "zod";
import type { InteractionDef } from "./schemas/interaction.js";
import type { Motive } from "./schemas/motives.js";
import type { ObjectDef } from "./schemas/objectDef.js";
import { interactionDefSchema } from "./schemas/interaction.js";
import { objectDefSchema } from "./schemas/objectDef.js";
import fridgeJson from "../data/objects/fridge.json";
import stoveJson from "../data/objects/stove.json";
import counterJson from "../data/objects/counter.json";
import toiletJson from "../data/objects/toilet.json";
import showerJson from "../data/objects/shower.json";
import bedJson from "../data/objects/bed.json";
import sofaJson from "../data/objects/sofa.json";
import tvJson from "../data/objects/tv.json";
import dirtyPlateJson from "../data/objects/dirty_plate.json";
import trashPileJson from "../data/objects/trash_pile.json";
import fridgeHaveSnackJson from "../data/interactions/fridge_have_snack.json";
import fridgeHaveMealJson from "../data/interactions/fridge_have_meal.json";
import stoveCookMealJson from "../data/interactions/stove_cook_meal.json";
import toiletUseJson from "../data/interactions/toilet_use.json";
import showerTakeShowerJson from "../data/interactions/shower_take_shower.json";
import bedSleepJson from "../data/interactions/bed_sleep.json";
import sofaSitJson from "../data/interactions/sofa_sit.json";
import sofaNapJson from "../data/interactions/sofa_nap.json";
import tvWatchJson from "../data/interactions/tv_watch.json";
import dirtyPlateCleanUpJson from "../data/interactions/dirty_plate_clean_up.json";
import trashPileCleanUpJson from "../data/interactions/trash_pile_clean_up.json";

export { MOTIVES, motiveRecord, motiveSchema } from "./schemas/motives.js";
export type { Motive } from "./schemas/motives.js";
export { objectCategorySchema, objectDefSchema, slotDefSchema } from "./schemas/objectDef.js";
export type { ObjectCategory, ObjectDef, SlotDef } from "./schemas/objectDef.js";
export { EXIT_STATE, interactionDefSchema } from "./schemas/interaction.js";
export type { InteractionDef, InteractionState } from "./schemas/interaction.js";

export interface ContentBundle {
  objects: ObjectDef[];
  interactions: InteractionDef[];
}

/** A raw (unvalidated) content file: its repo path plus parsed JSON. */
export interface RawContentSource {
  path: string;
  data: unknown;
}

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, source: RawContentSource): z.infer<S> {
  const result = schema.safeParse(source.data);
  if (result.success) return result.data as z.infer<S>;
  const lines = result.error.issues.map((issue) => {
    const at = issue.path.length > 0 ? `:${issue.path.join(".")}` : "";
    return `  ${source.path}${at} — ${issue.message}`;
  });
  throw new Error(`Content validation failed\n${lines.join("\n")}`);
}

/**
 * Validate raw content sources into a typed bundle. Throws with a
 * path-accurate message (file path + JSON path) on the first invalid file,
 * including cross-file checks (duplicate ids, object → interaction refs).
 */
export function validateContent(
  objects: RawContentSource[],
  interactions: RawContentSource[],
): ContentBundle {
  const objectDefs = objects.map((s) => parseOrThrow(objectDefSchema, s));
  const interactionDefs = interactions.map((s) => parseOrThrow(interactionDefSchema, s));

  const seen = new Map<string, string>();
  for (const [i, def] of objectDefs.entries()) {
    const path = objects[i]!.path;
    const prior = seen.get(def.id);
    if (prior !== undefined) throw new Error(`  ${path}:id — duplicate id '${def.id}' (also in ${prior})`);
    seen.set(def.id, path);
  }
  const interactionIds = new Map<string, string>();
  for (const [i, def] of interactionDefs.entries()) {
    const path = interactions[i]!.path;
    const prior = interactionIds.get(def.id);
    if (prior !== undefined) throw new Error(`  ${path}:id — duplicate id '${def.id}' (also in ${prior})`);
    interactionIds.set(def.id, path);
  }
  for (const [i, def] of objectDefs.entries()) {
    for (const [j, ref] of def.interactions.entries()) {
      if (!interactionIds.has(ref)) {
        throw new Error(
          `  ${objects[i]!.path}:interactions.${j} — references unknown interaction '${ref}'`,
        );
      }
    }
  }

  return { objects: objectDefs, interactions: interactionDefs };
}

/**
 * All bundled content files. New JSON files must be registered here.
 * Note: the counter (C-103) currently offers no interactions — the engine's
 * v1 verb set has no surface/prep verbs yet (TODO: add a "prepare food on
 * counter" step to stove.cook_meal once surface verbs exist).
 */
const OBJECT_SOURCES: RawContentSource[] = [
  { path: "data/objects/fridge.json", data: fridgeJson },
  { path: "data/objects/stove.json", data: stoveJson },
  { path: "data/objects/counter.json", data: counterJson },
  { path: "data/objects/toilet.json", data: toiletJson },
  { path: "data/objects/shower.json", data: showerJson },
  { path: "data/objects/bed.json", data: bedJson },
  { path: "data/objects/sofa.json", data: sofaJson },
  { path: "data/objects/tv.json", data: tvJson },
  { path: "data/objects/dirty_plate.json", data: dirtyPlateJson },
  { path: "data/objects/trash_pile.json", data: trashPileJson },
];

const INTERACTION_SOURCES: RawContentSource[] = [
  { path: "data/interactions/fridge_have_snack.json", data: fridgeHaveSnackJson },
  { path: "data/interactions/fridge_have_meal.json", data: fridgeHaveMealJson },
  { path: "data/interactions/stove_cook_meal.json", data: stoveCookMealJson },
  { path: "data/interactions/toilet_use.json", data: toiletUseJson },
  { path: "data/interactions/shower_take_shower.json", data: showerTakeShowerJson },
  { path: "data/interactions/bed_sleep.json", data: bedSleepJson },
  { path: "data/interactions/sofa_sit.json", data: sofaSitJson },
  { path: "data/interactions/sofa_nap.json", data: sofaNapJson },
  { path: "data/interactions/tv_watch.json", data: tvWatchJson },
  { path: "data/interactions/dirty_plate_clean_up.json", data: dirtyPlateCleanUpJson },
  { path: "data/interactions/trash_pile_clean_up.json", data: trashPileCleanUpJson },
];

/** Validate the shipped content files and return the typed bundle. */
export function loadContent(): ContentBundle {
  return validateContent(OBJECT_SOURCES, INTERACTION_SOURCES);
}

// ---------------------------------------------------------------------------
// toSimContent — bridge to the sim's structural input shape.
//
// These types are a *structural mirror* of packages/sim/src/objects/content.ts
// (SimObjectDef / SimInteractionDef / SimContent). We deliberately do NOT
// import from @homestead/sim: the sim package is zero-dependency and the
// content ← sim firewall (ARCHITECTURE.md §1/§2) means the two packages share
// shape, not types — callers pass plain structurally-compatible data. Keep in
// sync with that file by hand.
// ---------------------------------------------------------------------------

export interface SimSlot {
  type: "stand" | "sit";
  /** [dx, dy] relative to the object's origin tile at rotation 0. */
  offset: [number, number];
  facing: "object" | "away";
}

export interface SimObject {
  id: string;
  /** [w, h] in tiles at rotation 0. */
  footprint: [number, number];
  slots: SimSlot[];
  /**
   * Interaction ids offered by this object. The sim's SimObjectDef may not
   * declare this field yet on older engine commits; we emit it regardless —
   * the autonomy branch (S-204) consumes it, and extra structural properties
   * are harmless to older consumers.
   */
  interactions: string[];
  /** False = walkable clutter; omitted means true (blocking). */
  blocksTile?: boolean;
  /** Mess contribution to RoomScore, 0..10; omitted means 0. */
  messRating?: number;
}

export interface SimInteractionState {
  do?: string;
  durationMin?: number;
  perMin?: Partial<Record<Motive, number>>;
  untilMotive?: { motive: Motive; gte: number };
  next?: string;
}

export interface SimInteraction {
  id: string;
  ad: Partial<Record<Motive, number>>;
  /** Index into the object's slots. Omitted = sim defaults to 0. */
  slot?: number;
  states: Record<string, SimInteractionState>;
  interruptible?: { below?: Partial<Record<Motive, number>> };
}

export interface SimContentBundle {
  objects: SimObject[];
  interactions: SimInteraction[];
}

/**
 * Copy a zod partial motive map into the sim's exact-optional shape. Zod's
 * `.partial()` types entries as `number | undefined`, which is not assignable
 * to `Partial<Record<Motive, number>>` under exactOptionalPropertyTypes, so
 * we drop undefined entries while copying.
 */
function copyMotiveMap(
  src: Partial<Record<Motive, number | undefined>>,
): Partial<Record<Motive, number>> {
  const out: Partial<Record<Motive, number>> = {};
  for (const [motive, value] of Object.entries(src)) {
    if (value !== undefined) out[motive as Motive] = value;
  }
  return out;
}

/**
 * Map a validated content bundle onto the sim's structural input shape,
 * keeping only the fields the sim's interpreter knows about (authoring-only
 * fields like name/price/cost/requires/onFail are stripped).
 */
export function toSimContent(bundle: ContentBundle): SimContentBundle {
  const objects: SimObject[] = bundle.objects.map((o) => {
    const out: SimObject = {
      id: o.id,
      footprint: [o.footprint[0], o.footprint[1]],
      slots: o.slots.map((s) => ({
        type: s.type,
        offset: [s.offset[0], s.offset[1]],
        facing: s.facing,
      })),
      interactions: [...o.interactions],
    };
    // Optional physics/scoring fields: forwarded only when authored, so
    // untouched defs keep the sim's defaults (blocking, mess 0).
    if (o.blocksTile !== undefined) out.blocksTile = o.blocksTile;
    if (o.messRating !== undefined) out.messRating = o.messRating;
    return out;
  });

  const interactions: SimInteraction[] = bundle.interactions.map((def) => {
    const states: Record<string, SimInteractionState> = {};
    for (const [name, s] of Object.entries(def.states)) {
      const out: SimInteractionState = {};
      if (s.do !== undefined) out.do = s.do;
      if (s.durationMin !== undefined) out.durationMin = s.durationMin;
      if (s.perMin !== undefined) out.perMin = copyMotiveMap(s.perMin);
      if (s.untilMotive !== undefined) out.untilMotive = { ...s.untilMotive };
      if (s.next !== undefined) out.next = s.next;
      states[name] = out;
    }
    const out: SimInteraction = { id: def.id, ad: copyMotiveMap(def.ad), states };
    // Inline slot specs are an authoring convenience the sim doesn't take;
    // only numeric indices are forwarded (the sim defaults to slot 0).
    if (typeof def.slot === "number") out.slot = def.slot;
    if (def.interruptible?.below !== undefined) {
      out.interruptible = { below: copyMotiveMap(def.interruptible.below) };
    }
    return out;
  });

  return { objects, interactions };
}
