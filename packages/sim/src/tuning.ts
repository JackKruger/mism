import type { MotiveName } from "./people/needs.js";
import type { TraitName } from "./people/personality.js";

/**
 * Central tuning constants (S-101/S-103/S-104).
 *
 * NOTE: this object migrates to the content bundle (`content/tuning.json`,
 * task S-201) once packages/content exists — keep everything in this single
 * export so the move is mechanical and the balance harness can sweep it.
 */

/** A motive spans 200 points (+100 → -100); rate to empty a full bar in `hours`. */
const emptiesInHours = (hours: number): number => 200 / (hours * 60);

export interface PersonalityDecayMod {
  trait: TraitName;
  motive: MotiveName;
  /** trait 10 → decay ×(1 - maxEffect); trait 0 → ×(1 + maxEffect); linear. */
  maxEffect: number;
}

export const TUNING = {
  needs: {
    /**
     * Base decay in points per sim-minute. Chosen so a full (+100) motive
     * empties (-100) in the listed sim-hours for a neutral personality:
     * hunger 16h, energy 18h, comfort 12h, fun 14h, social 24h, hygiene 20h,
     * bladder 8h. room is environmental (RoomScore, later) and never decays.
     * Activity modifiers (×activityMod, §3.5) arrive with interactions (S-203).
     */
    baseDecayPerMinute: {
      hunger: emptiesInHours(16),
      energy: emptiesInHours(18),
      comfort: emptiesInHours(12),
      fun: emptiesInHours(14),
      social: emptiesInHours(24),
      hygiene: emptiesInHours(20),
      bladder: emptiesInHours(8),
      room: 0,
    } satisfies Record<MotiveName, number>,
  },

  personality: {
    /** Data-driven trait → motive decay modifiers (see decayModifierFor). */
    decayMods: [
      { trait: "neat", motive: "hygiene", maxEffect: 0.3 },
      { trait: "active", motive: "energy", maxEffect: 0.3 },
      { trait: "playful", motive: "fun", maxEffect: 0.3 },
    ] as readonly PersonalityDecayMod[],
  },

  mood: {
    /** curve() slope below 0 — "pain hurts more" (§3.5). */
    negativeCurveSlope: 1.5,
  },

  failures: {
    /** Hygiene hit when a bladder accident happens. */
    bladderAccidentHygienePenalty: 50,
    /** Energy regen (points per sim-minute) while passed out: -100 → -20 in 32 sim-min. */
    passedOutEnergyRegenPerMinute: 2.5,
    /** Passed-out folk wake once energy recovers to this level. */
    passedOutWakeEnergy: -20,
    /** Hunger pinned at -100 for this long → death by starvation. */
    starvationHours: 24,
  },
};
