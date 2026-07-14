import type { Command, CommandResult } from "./commands.js";
import type { SerializedState, SimState } from "./state.js";
import type { SimSnapshot } from "./snapshot.js";
import { advanceTick } from "./core/clock.js";
import { applyCommand } from "./commands.js";
import { buildSnapshot } from "./snapshot.js";
import { createState, deserializeState, serializeState } from "./state.js";
import { hashValue } from "./save/hash.js";
import { movementSystem } from "./systems/movement.js";

export type { Command, CommandResult } from "./commands.js";
export type { SimSnapshot, PersonView } from "./snapshot.js";
export type { GameSpeed } from "./core/clock.js";
export type { SerializedState } from "./state.js";
export type { PersonId } from "./core/ids.js";
export { TICKS_PER_SIM_MINUTE } from "./core/clock.js";
export { LOT_SIZE } from "./world/lot.js";

export interface SimHandle {
  /** Advance the simulation by n fixed ticks (default 1). */
  tick(n?: number): void;
  apply(cmd: Command): CommandResult;
  snapshot(): SimSnapshot;
  serialize(): SerializedState;
  hashState(): string;
}

/**
 * System pipeline — fixed order, one pass per tick. New systems slot in here
 * (see ARCHITECTURE.md §3.3 for the target pipeline).
 */
function runTick(state: SimState): void {
  advanceTick(state.clock);
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
    snapshot(): SimSnapshot {
      return buildSnapshot(state);
    },
    serialize(): SerializedState {
      return serializeState(state);
    },
    hashState(): string {
      return hashValue(serializeState(state));
    },
  };
}

export function createSim(config: { seed: number }): SimHandle {
  return makeHandle(createState(config.seed));
}

export function loadSim(data: SerializedState): SimHandle {
  return makeHandle(deserializeState(data));
}
