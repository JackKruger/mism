import type { Needs } from "./needs.js";
import { MOTIVES } from "./needs.js";
import { TUNING } from "../tuning.js";

/**
 * Mood (S-102) — canonical formulas from ARCHITECTURE.md §3.5:
 *
 *   weight(m) = ((100 - m) / 200)^2      // 0 when full … 1 when empty, convex
 *   mood      = Σ weight(m)·curve(m) / Σ weight(m)
 *
 * curve maps a motive value to its mood contribution, steeper below 0 so
 * pain hurts more: curve(m) = m for m ≥ 0, negativeCurveSlope·m below 0.
 * Normalization choice: curve(-100) = -150, so the weighted average can leave
 * [-100, 100]; we clamp the final mood back into that range (an all-empty
 * panel reads exactly -100, and the extra slope still lets one empty motive
 * dominate several healthy ones before the clamp engages).
 */

export const motiveWeight = (m: number): number => ((100 - m) / 200) ** 2;

export const motiveCurve = (m: number): number =>
  m >= 0 ? m : m * TUNING.mood.negativeCurveSlope;

export function computeMood(needs: Needs): number {
  let weightSum = 0;
  let weighted = 0;
  for (const motive of MOTIVES) {
    const value = needs[motive];
    const w = motiveWeight(value);
    weightSum += w;
    weighted += w * motiveCurve(value);
  }
  // Every motive full ⇒ all weights 0 ⇒ nothing weighs on the mind: best mood.
  if (weightSum === 0) return 100;
  return Math.min(100, Math.max(-100, weighted / weightSum));
}
