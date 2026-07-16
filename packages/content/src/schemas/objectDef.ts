import { z } from "zod";
import { motiveRecord } from "./motives.js";

/**
 * Object catalog definition (ARCHITECTURE.md §6). Purely declarative — the
 * sim consumes this as plain validated data.
 */

export const objectCategorySchema = z.enum([
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "decor",
  "misc",
]);

export type ObjectCategory = z.infer<typeof objectCategorySchema>;

/**
 * A standing/sitting position a person occupies to use the object.
 * `offset` is [dx, dy] relative to the object's origin tile at rotation 0;
 * the engine rotates it with the object (see sim/src/objects/placement.ts
 * for the rotation convention).
 */
export const slotDefSchema = z
  .object({
    type: z.enum(["stand", "sit"]),
    offset: z.tuple([z.number().int(), z.number().int()]),
    facing: z.enum(["object", "away"]),
  })
  .strict();

export type SlotDef = z.infer<typeof slotDefSchema>;

/** Sprite variants per object state; 'default' is mandatory. */
const objectStatesSchema = z
  .object({
    default: z.string().min(1),
    dirty: z.string().min(1).optional(),
    broken: z.string().min(1).optional(),
    on: z.string().min(1).optional(),
  })
  .strict();

export const objectDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    category: objectCategorySchema,
    /** [w, h] in tiles at rotation 0. */
    footprint: z.tuple([
      z.number().int().min(1).max(4),
      z.number().int().min(1).max(4),
    ]),
    wallMounted: z.boolean().optional(),
    /**
     * False = walkable clutter (dirty plates, puddles) that never blocks the
     * nav grid. Optional; absent means true (blocking).
     */
    blocksTile: z.boolean().optional(),
    /** Mess contribution to RoomScore, 0..10. Optional; absent means 0. */
    messRating: z.number().int().min(0).max(10).optional(),
    flammability: z.number().int().min(0).max(10),
    /** Catalog motive ratings (comfort 7 etc.), 1..10. */
    motiveRatings: motiveRecord(z.number().int().min(1).max(10)),
    states: objectStatesSchema,
    /** Interaction ids offered by this object. */
    interactions: z.array(z.string().min(1)),
    slots: z.array(slotDefSchema),
  })
  .strict();

export type ObjectDef = z.infer<typeof objectDefSchema>;
