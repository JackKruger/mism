import type { ObjectId, PersonId } from "../core/ids.js";
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

/** Max queued actions per person (matches classic queue length). */
export const MAX_QUEUE = 8;

/** An action waiting in the person's queue (S-203/S-206). */
export interface QueuedAction {
  object: ObjectId;
  interaction: string;
}

/**
 * An ad temporarily ignored by autonomy after the action failed (§3.7) —
 * a serializable array, pruned when the person next re-plans (S-205).
 */
export interface SuppressedAd {
  object: ObjectId;
  interaction: string;
  untilTick: number;
}

/**
 * The interaction currently being executed. 'routing' = walking to the slot;
 * 'running' = statechart executing.
 */
export interface ActiveInteraction {
  object: ObjectId;
  interaction: string;
  phase: "routing" | "running";
  stateName: string;
  stateTicks: number;
  slotIndex: number;
}

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
  queue: QueuedAction[];
  active: ActiveInteraction | null;
  /** Current activity animation name from the statechart (e.g. "eat"), or null. */
  activity: string | null;
  /** Tick of the last autonomy planning pass (S-205 re-plan throttle). */
  lastPlanTick: number;
  /** Ads to skip until their tick passes (failed actions, §3.7). */
  suppressed: SuppressedAd[];
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
    queue: [],
    active: null,
    activity: null,
    lastPlanTick: 0,
    suppressed: [],
  };
}

export const personTile = (p: Person): Tile => ({ x: Math.round(p.px), y: Math.round(p.py) });

export function facingFromDelta(dx: number, dy: number): Facing {
  // Iso mapping: +x is screen lower-right (SE), +y is screen lower-left (SW).
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "se" : "nw";
  return dy >= 0 ? "sw" : "ne";
}
