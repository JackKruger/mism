import { z } from "zod";

/** The eight core motives (ARCHITECTURE.md §3.5). */
export const MOTIVES = [
  "hunger",
  "comfort",
  "hygiene",
  "bladder",
  "energy",
  "fun",
  "social",
  "room",
] as const;

export type Motive = (typeof MOTIVES)[number];

export const motiveSchema = z.enum(MOTIVES);

/**
 * Partial record of motive → value. Built as a strict partial object (rather
 * than z.record) so the inferred type is `{ hunger?: number; … }` and unknown
 * motive names are rejected with a path-accurate error.
 */
export const motiveRecord = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      hunger: value,
      comfort: value,
      hygiene: value,
      bladder: value,
      energy: value,
      fun: value,
      social: value,
      room: value,
    })
    .partial()
    .strict();
