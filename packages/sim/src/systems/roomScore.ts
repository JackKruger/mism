import type { SimState } from "../state.js";
import { MOTIVE_MIN } from "../people/needs.js";
import { TUNING } from "../tuning.js";

/**
 * C-110 RoomScore v1 (ARCHITECTURE.md §3.3 #11, §3.8): the room motive is
 * environmental — recomputed from the world every tick, never decayed.
 *
 *   room = clamp(Σ messRating × -messPenaltyPerPoint, -100, 0)
 *
 * summed over every object instance whose def carries a messRating (dirty
 * plates, trash piles, later puddles/ash). v1 is uniform lot-wide: per-room
 * scoping needs walls + the room floodfill (M3), and positive contributions
 * (art/plants/window daylight) land with those systems too — hence the score
 * tops out at 0. Runs right after the clock so needsDecay's mood pass sees
 * the fresh value in the same tick.
 */
export function roomScoreSystem(state: SimState): void {
  let mess = 0;
  for (const obj of state.objects.values()) {
    const rating = state.contentIndex.get(obj.defId)?.messRating;
    if (rating !== undefined) mess += rating;
  }
  // Guard the no-mess case so we assign 0, not -0 (keeps state hashes stable).
  const room = mess > 0 ? Math.max(MOTIVE_MIN, -mess * TUNING.room.messPenaltyPerPoint) : 0;
  for (const person of state.people.values()) {
    if (person.status === "dead") continue; // needs freeze at death
    person.needs.room = room;
  }
}
