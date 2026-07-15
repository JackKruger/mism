import type { Command, CommandResult } from "./commands.js";
import type { SerializedState, SimState } from "./state.js";
import type { SimContent } from "./objects/content.js";
import type { SimSnapshot } from "./snapshot.js";
import { advanceTick } from "./core/clock.js";
import { applyCommand } from "./commands.js";
import { buildSnapshot } from "./snapshot.js";
import { createState, deserializeState, serializeState } from "./state.js";
import { hashValue } from "./save/hash.js";
import { movementSystem } from "./systems/movement.js";
import { needsDecaySystem } from "./systems/needsDecay.js";

export type { Command, CommandError, CommandResult } from "./commands.js";
export type { SimSnapshot, PersonView, ObjectView } from "./snapshot.js";
export type { GameSpeed } from "./core/clock.js";
export type { SerializedState } from "./state.js";
export type { PersonId, ObjectId } from "./core/ids.js";
export type { MotiveName, Needs } from "./people/needs.js";
export type { Personality, TraitName } from "./people/personality.js";
export type { PersonStatus } from "./people/person.js";
export type { SimEvent, SimEventType } from "./core/events.js";
export type { SimContent, SimObjectDef, SimSlotDef } from "./objects/content.js";
export type { ObjInstance, Rotation } from "./objects/objInstance.js";
export type { ResolvedSlot } from "./objects/slots.js";
export { canPlace, footprintTiles, rotateOffset } from "./objects/placement.js";
export { resolveSlots } from "./objects/slots.js";
export { TICKS_PER_SIM_MINUTE } from "./core/clock.js";
export { LOT_SIZE } from "./world/lot.js";
export { TUNING } from "./tuning.js";

export interface SimHandle {
  /** Advance the simulation by n fixed ticks (default 1). */
  tick(n?: number): void;
  apply(cmd: Command): CommandResult;
  /** Build a render snapshot; pass sinceTick to only include newer events. */
  snapshot(sinceTick?: number): SimSnapshot;
  serialize(): SerializedState;
  hashState(): string;
}

/**
 * System pipeline — fixed order, one pass per tick. New systems slot in here
 * (see ARCHITECTURE.md §3.3 for the target pipeline):
 * clock → needs decay (incl. mood + failure states) → movement.
 */
function runTick(state: SimState): void {
  advanceTick(state.clock);
  needsDecaySystem(state);
  movementSystem(state);
}

function makeHandle(state: SimState): SimHandle {
  return {
    tick(n = 1): void {
      for (let i = 0; i < n; i++) runTick(state);
    },
    apply(cmd: Command): CommandResult {
      return applyCommand(state, cmd);
    },
    snapshot(sinceTick?: number): SimSnapshot {
      return buildSnapshot(state, sinceTick);
    },
    serialize(): SerializedState {
      return serializeState(state);
    },
    hashState(): string {
      return hashValue(serializeState(state));
    },
  };
}

/** Content is optional plain data (see objects/content.ts); defaults to none. */
export function createSim(config: { seed: number; content?: SimContent }): SimHandle {
  return makeHandle(createState(config.seed, config.content));
}

export function loadSim(data: SerializedState, content?: SimContent): SimHandle {
  return makeHandle(deserializeState(data, content));
}
