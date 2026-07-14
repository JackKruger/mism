/**
 * Needs component (S-101): the 8 classic motives, each in [-100, +100].
 * +100 = fully satisfied, -100 = empty/critical.
 */

export const MOTIVES = [
  "hunger",
  "energy",
  "comfort",
  "fun",
  "social",
  "hygiene",
  "bladder",
  "room",
] as const;

export type MotiveName = (typeof MOTIVES)[number];

export type Needs = Record<MotiveName, number>;

export const MOTIVE_MIN = -100;
export const MOTIVE_MAX = 100;

export const clampMotive = (v: number): number =>
  Math.min(MOTIVE_MAX, Math.max(MOTIVE_MIN, v));

/**
 * Fresh needs: all motives full except room, which is environmental
 * (driven by RoomScore later) and rests at 0 for now.
 */
export const createNeeds = (): Needs => ({
  hunger: MOTIVE_MAX,
  energy: MOTIVE_MAX,
  comfort: MOTIVE_MAX,
  fun: MOTIVE_MAX,
  social: MOTIVE_MAX,
  hygiene: MOTIVE_MAX,
  bladder: MOTIVE_MAX,
  room: 0,
});
