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

/** The subset of the content bundle the sim consumes. */
export interface SimContent {
  objects: readonly SimObjectDef[];
}
