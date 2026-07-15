/**
 * Minimal structural mirror of the validated content types from
 * `@homestead/content`. The sim is zero-dependency and must NOT import that
 * package (content ← sim firewall + no-deps rule, ARCHITECTURE.md §1/§2), so
 * we duplicate just the fields the sim needs; callers pass already-validated
 * plain data that is structurally compatible. Keep in sync with
 * packages/content/src/schemas/objectDef.ts.
 */

export type SlotType = "stand" | "sit";
export type SlotFacing = "object" | "away";

export interface SimSlotDef {
  type: SlotType;
  /** [dx, dy] relative to the object's origin tile at rotation 0. */
  offset: readonly [number, number];
  /** Look toward the object ('object') or directly away from it ('away'). */
  facing: SlotFacing;
}

export interface SimObjectDef {
  id: string;
  /** [w, h] in tiles at rotation 0. */
  footprint: readonly [number, number];
  slots: readonly SimSlotDef[];
}

import type { MotiveName } from "../people/needs.js";

/** One state of an interaction statechart (mirror of schemas/interaction.ts). */
export interface SimInteractionStateDef {
  /** Verb, e.g. "anim:eat". v1 supports only anim:*; unknown verbs are ignored. */
  do?: string;
  durationMin?: number;
  /** Motive deltas applied per sim-minute while in this state. */
  perMin?: Partial<Record<MotiveName, number>>;
  /** Advance when the motive reaches the threshold. */
  untilMotive?: { motive: MotiveName; gte: number };
  /** Next state name or "$exit". Absent = "$exit". */
  next?: string;
}

export interface SimInteractionDef {
  id: string;
  /** Advertised motive gains (used by the S-204 ad system). */
  ad: Partial<Record<MotiveName, number>>;
  /** Index into the object's slots to route to. Default 0. */
  slot?: number;
  states: Record<string, SimInteractionStateDef>;
  /** Abort when any listed motive falls below its threshold. */
  interruptible?: { below?: Partial<Record<MotiveName, number>> };
}

/** The subset of the content bundle the sim consumes. */
export interface SimContent {
  objects: readonly SimObjectDef[];
  interactions?: readonly SimInteractionDef[];
}
