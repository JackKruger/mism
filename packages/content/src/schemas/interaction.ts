import { z } from "zod";
import { motiveRecord, motiveSchema } from "./motives.js";
import { slotDefSchema } from "./objectDef.js";

/**
 * Interaction statechart definition (ARCHITECTURE.md §4). The sim's
 * interpreter (S-203) executes these; this schema is the authoring contract.
 *
 * Structural rules enforced below (superRefine):
 * - exactly one 'start' state exists,
 * - every `next` / `onFail` references an existing state or the special
 *   '$exit' terminator,
 * - no state may be named '$exit'.
 */

/** Special transition target: leave the interaction. */
export const EXIT_STATE = "$exit";

const untilMotiveSchema = z
  .object({
    motive: motiveSchema,
    /** Stay in this state until the motive is >= this value (-100..100). */
    gte: z.number().min(-100).max(100),
  })
  .strict();

const interactionStateSchema = z
  .object({
    /** Verb for the interpreter, e.g. "anim:eat" (closed verb set, §4). */
    do: z.string().min(1).optional(),
    durationMin: z.number().positive().optional(),
    /** Motive deltas applied per sim-minute while in this state. */
    perMin: motiveRecord(z.number()).optional(),
    untilMotive: untilMotiveSchema.optional(),
    next: z.string().min(1).optional(),
    onFail: z.string().min(1).optional(),
  })
  .strict();

export type InteractionState = z.infer<typeof interactionStateSchema>;

export const interactionDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** Advertised motive gains used by autonomy scoring. */
    ad: motiveRecord(z.number()),
    /** Simoleons charged on start. */
    cost: z.number().nonnegative().optional(),
    /** Precondition ids, e.g. "object.notBroken". */
    requires: z.array(z.string().min(1)),
    /** Index into the object's slots array, or an inline slot spec. */
    slot: z.union([z.number().int().nonnegative(), slotDefSchema]),
    states: z.record(z.string().min(1), interactionStateSchema),
    interruptible: z
      .object({
        /** Interrupt when any listed motive drops below its threshold. */
        below: motiveRecord(z.number()).optional(),
        /** State names that must never be interrupted. */
        notDuring: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((def, ctx) => {
    const stateNames = Object.keys(def.states);
    if (!stateNames.includes("start")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["states"],
        message: `must contain exactly one 'start' state (found states: ${stateNames.join(", ") || "none"})`,
      });
    }
    for (const name of stateNames) {
      if (name === EXIT_STATE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states", name],
          message: `'${EXIT_STATE}' is a reserved transition target and cannot be a state name`,
        });
      }
      const state = def.states[name]!;
      for (const key of ["next", "onFail"] as const) {
        const target = state[key];
        if (target !== undefined && target !== EXIT_STATE && def.states[target] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["states", name, key],
            message: `references unknown state '${target}' (known: ${stateNames.join(", ")}, or '${EXIT_STATE}')`,
          });
        }
      }
    }
    for (const [i, guarded] of (def.interruptible?.notDuring ?? []).entries()) {
      if (def.states[guarded] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interruptible", "notDuring", i],
          message: `references unknown state '${guarded}'`,
        });
      }
    }
  });

export type InteractionDef = z.infer<typeof interactionDefSchema>;
