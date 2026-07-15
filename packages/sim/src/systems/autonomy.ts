import type { ObjectId } from "../core/ids.js";
import type { Person } from "../people/person.js";
import type { SimState } from "../state.js";
import type { Tile } from "../world/lot.js";
import { MOTIVES } from "../people/needs.js";
import { personTile } from "../people/person.js";
import { TICKS_PER_SIM_MINUTE } from "../core/clock.js";
import { TUNING } from "../tuning.js";

/**
 * S-204/S-205: advertisement scoring + autonomy (ARCHITECTURE.md §3.5/§3.6).
 *
 * Idle folk (empty queue, no active interaction, not mid-walk) re-plan every
 * `replanTicks`: every object interaction on the lot broadcasts its `ad`
 * motive gains, scored by how much the person needs each motive, attenuated
 * by distance, jittered ±5%, then a weighted-random choice among the top 3
 * lands in the queue. Player commands outrank autonomy simply because a
 * non-empty queue (or a WalkTo path) skips the person entirely.
 */

interface ScoredAd {
  object: ObjectId;
  interaction: string;
  score: number;
}

/** weight(m) = ((100 − m) / 200)² — 0 when full, 1 when empty, convex (§3.5). */
const needWeight = (motive: number): number => {
  const w = (100 - motive) / 200;
  return w * w;
};

/** Octile distance in tiles (matches 8-way walking cost). */
function octileDistance(a: Tile, b: Tile): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Remember a failed action so autonomy skips its ad for `suppressMinutes`
 * (§3.7 failure behavior). Entries are pruned when the person next re-plans.
 */
export function suppressAd(
  state: SimState,
  person: Person,
  object: ObjectId,
  interaction: string,
): void {
  person.suppressed.push({
    object,
    interaction,
    untilTick: state.clock.tick + TUNING.autonomy.suppressMinutes * TICKS_PER_SIM_MINUTE,
  });
}

const isSuppressed = (person: Person, object: ObjectId, interaction: string): boolean =>
  person.suppressed.some((s) => s.object === object && s.interaction === interaction);

/** Score every non-suppressed ad on the lot for this person (§3.5). */
function collectAds(state: SimState, person: Person): ScoredAd[] {
  const from = personTile(person);
  const ads: ScoredAd[] = [];
  for (const obj of state.objects.values()) {
    const def = state.contentIndex.get(obj.defId);
    if (!def || def.interactions.length === 0) continue;
    const dist = octileDistance(from, obj.tile);
    const attenuation = 1 / (1 + dist / TUNING.autonomy.attenuationTiles);
    for (const interactionId of def.interactions) {
      if (isSuppressed(person, obj.id, interactionId)) continue;
      const idef = state.interactionIndex.get(interactionId);
      if (!idef) continue;
      let base = 0;
      for (const motive of MOTIVES) {
        const adValue = idef.ad[motive];
        if (adValue !== undefined) base += adValue * needWeight(person.needs[motive]);
      }
      const jitter = 1 + (state.rng.float() - 0.5) * TUNING.autonomy.jitterSpan;
      const score = base * attenuation * jitter;
      if (score < TUNING.autonomy.minScore) continue;
      ads.push({ object: obj.id, interaction: interactionId, score });
    }
  }
  return ads;
}

/** Weighted-random among the top 3 by score; ties break on ids (§3.5). */
function chooseAd(state: SimState, ads: ScoredAd[]): ScoredAd {
  ads.sort(
    (a, b) =>
      b.score - a.score ||
      a.object - b.object ||
      (a.interaction < b.interaction ? -1 : a.interaction > b.interaction ? 1 : 0),
  );
  const top = ads.slice(0, 3);
  let total = 0;
  for (const ad of top) total += ad.score;
  let r = state.rng.float() * total;
  for (const ad of top) {
    r -= ad.score;
    if (r < 0) return ad;
  }
  return top[top.length - 1]!; // float round-off fallback
}

export function autonomySystem(state: SimState): void {
  const tick = state.clock.tick;
  for (const person of state.people.values()) {
    if (person.status !== "normal") continue;
    if (person.queue.length > 0 || person.active !== null) continue;
    if (person.path.length > 0) continue; // player-ordered walk in progress
    if (tick - person.lastPlanTick < TUNING.autonomy.replanTicks) continue;

    if (person.suppressed.length > 0) {
      person.suppressed = person.suppressed.filter((s) => s.untilTick > tick);
    }

    const ads = collectAds(state, person);
    person.lastPlanTick = tick; // even when nothing qualifies: idle, don't rescan
    if (ads.length === 0) continue;

    const chosen = chooseAd(state, ads);
    person.queue.push({ object: chosen.object, interaction: chosen.interaction });
  }
}
