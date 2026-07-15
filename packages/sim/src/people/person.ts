import type { PersonId } from "../core/ids.js";
import type { Tile } from "../world/lot.js";
import type { Needs } from "./needs.js";
import type { Personality } from "./personality.js";
import { createNeeds } from "./needs.js";
import { computeMood } from "./mood.js";

export type Facing = "se" | "sw" | "ne" | "nw";
export type AnimName = "idle" | "walk";

/**
 * S-104 failure states. passedOut folk regenerate energy and skip movement;
 * dead folk are skipped by every system but stay in the store/snapshot.
 */
export type PersonStatus = "normal" | "passedOut" | "dead";

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
  needs: Needs;
  /** Computed each tick from needs (§3.5); cached for snapshots. */
  mood: number;
  personality: Personality;
  status: PersonStatus;
  /** Tick when hunger pinned at -100; null while fed. Death after the tuned window. */
  starvationStartTick: number | null;
}

export function createPerson(
  id: PersonId,
  name: string,
  x: number,
  y: number,
  personality: Personality,
  navVersion: number,
): Person {
  const needs = createNeeds();
  return {
    id,
    name,
    px: x,
    py: y,
    facing: "se",
    anim: "idle",
    path: [],
    pathNavVersion: navVersion,
    needs,
    mood: computeMood(needs),
    personality,
    status: "normal",
    starvationStartTick: null,
  };
}

export const personTile = (p: Person): Tile => ({ x: Math.round(p.px), y: Math.round(p.py) });

export function facingFromDelta(dx: number, dy: number): Facing {
  // Iso mapping: +x is screen lower-right (SE), +y is screen lower-left (SW).
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "se" : "nw";
  return dy >= 0 ? "sw" : "ne";
}
