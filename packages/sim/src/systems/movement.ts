import type { SimState } from "../state.js";
import { WALK_TILES_PER_TICK, facingFromDelta } from "../people/person.js";

/** Advances every person along their path by one tick. */
export function movementSystem(state: SimState): void {
  for (const person of state.people.values()) {
    let budget = WALK_TILES_PER_TICK;

    while (budget > 0 && person.path.length > 0) {
      const target = person.path[0]!;
      const dx = target.x - person.px;
      const dy = target.y - person.py;
      const dist = Math.hypot(dx, dy);

      if (dist <= budget) {
        person.px = target.x;
        person.py = target.y;
        person.path.shift();
        budget -= dist;
      } else {
        person.px += (dx / dist) * budget;
        person.py += (dy / dist) * budget;
        person.facing = facingFromDelta(dx, dy);
        budget = 0;
      }
    }

    const movedThisTick = budget < WALK_TILES_PER_TICK;
    person.anim = person.path.length > 0 || movedThisTick ? "walk" : "idle";
  }
}
