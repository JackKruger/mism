import type { PersonId } from "./core/ids.js";
import type { Clock } from "./core/clock.js";
import type { Lot } from "./world/lot.js";
import type { Person } from "./people/person.js";
import type { RngState } from "./core/rng.js";
import type { SimEvent } from "./core/events.js";
import { Rng } from "./core/rng.js";
import { createClock } from "./core/clock.js";
import { createLot } from "./world/lot.js";
import { EventLog } from "./core/events.js";
import { Store } from "./core/store.js";

export const SAVE_VERSION = 1;

export interface SimState {
  version: number;
  rng: Rng;
  clock: Clock;
  lot: Lot;
  people: Store<PersonId, Person>;
  eventLog: EventLog;
  nextEntityId: number;
}

export interface SerializedState {
  version: number;
  rng: RngState;
  clock: Clock;
  lot: { size: number; terrain: number[]; blocked: number[]; navVersion: number };
  people: Person[];
  events: SimEvent[];
  nextEntityId: number;
}

export function createState(seed: number): SimState {
  return {
    version: SAVE_VERSION,
    rng: Rng.fromSeed(seed),
    clock: createClock(),
    lot: createLot(),
    people: new Store<PersonId, Person>(),
    eventLog: new EventLog(),
    nextEntityId: 1,
  };
}

const clonePerson = (p: Person): Person => ({
  ...p,
  path: p.path.map((t) => ({ ...t })),
  needs: { ...p.needs },
  personality: { ...p.personality },
});

export function serializeState(state: SimState): SerializedState {
  return {
    version: state.version,
    rng: state.rng.state(),
    clock: { ...state.clock },
    lot: {
      size: state.lot.size,
      terrain: Array.from(state.lot.terrain),
      blocked: Array.from(state.lot.blocked),
      navVersion: state.lot.navVersion,
    },
    people: [...state.people.values()].map(clonePerson),
    events: state.eventLog.toArray(),
    nextEntityId: state.nextEntityId,
  };
}

export function deserializeState(data: SerializedState): SimState {
  if (data.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${data.version} (expected ${SAVE_VERSION})`);
  }
  const state = createState(0);
  state.rng = new Rng(data.rng);
  state.clock = { ...data.clock };
  state.lot.terrain.set(data.lot.terrain);
  state.lot.blocked.set(data.lot.blocked);
  state.lot.navVersion = data.lot.navVersion;
  for (const p of data.people) {
    state.people.add(p.id, clonePerson(p));
  }
  state.eventLog = EventLog.from(data.events);
  state.nextEntityId = data.nextEntityId;
  return state;
}
