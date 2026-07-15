import type { MotiveName } from "./needs.js";
import { TUNING } from "../tuning.js";

/**
 * Personality component (S-103): the five classic traits, integers 0..10.
 * 5 is neutral; traits scale need decay (and later, ad scoring / skill speed).
 */

export const TRAITS = ["neat", "outgoing", "active", "playful", "nice"] as const;

export type TraitName = (typeof TRAITS)[number];

export type Personality = Record<TraitName, number>;

export const TRAIT_MIN = 0;
export const TRAIT_MAX = 10;
export const TRAIT_NEUTRAL = 5;

export const defaultPersonality = (): Personality => ({
  neat: TRAIT_NEUTRAL,
  outgoing: TRAIT_NEUTRAL,
  active: TRAIT_NEUTRAL,
  playful: TRAIT_NEUTRAL,
  nice: TRAIT_NEUTRAL,
});

/** True when every trait is an integer within [0, 10]. */
export function isValidPersonality(p: Personality): boolean {
  for (const trait of TRAITS) {
    const v = p[trait];
    if (!Number.isInteger(v) || v < TRAIT_MIN || v > TRAIT_MAX) return false;
  }
  return true;
}

/**
 * Combined decay multiplier for one motive from the tuning table.
 * Linear per entry: trait 5 → ×1.0, trait 10 → ×(1 - maxEffect) (slower),
 * trait 0 → ×(1 + maxEffect) (faster).
 */
export function decayModifierFor(personality: Personality, motive: MotiveName): number {
  let mod = 1;
  for (const entry of TUNING.personality.decayMods) {
    if (entry.motive !== motive) continue;
    mod *= 1 + (entry.maxEffect * (TRAIT_NEUTRAL - personality[entry.trait])) / TRAIT_NEUTRAL;
  }
  return mod;
}
