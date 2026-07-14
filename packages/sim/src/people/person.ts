import type { PersonId } from "../core/ids.js";
import type { Tile } from "../world/lot.js";

export type Facing = "se" | "sw" | "ne" | "nw";
export type AnimName = "idle" | "walk";

/** Walk speed: 5 tiles per sim-minute (0.25 tiles per tick). */
export const WALK_TILES_PER_TICK = 0.25;

export interface Person {
  id: PersonId;
  name: string;
  /** Continuous position in tile coordinates (px, py); tile = rounded. */
  px: number;
  py: number;
  facing: Facing;
  anim: AnimName;
  /** Remaining waypoints; empty = idle. */
  path: Tile[];
  /** navVersion the path was computed against (for future invalidation). */
  pathNavVersion: number;
}

export const personTile = (p: Person): Tile => ({ x: Math.round(p.px), y: Math.round(p.py) });

export function facingFromDelta(dx: number, dy: number): Facing {
  // Iso mapping: +x is screen lower-right (SE), +y is screen lower-left (SW).
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "se" : "nw";
  return dy >= 0 ? "sw" : "ne";
}
