import type { PersonId } from "./ids.js";

/**
 * SimEvents (S-104): typed, clone-friendly records of notable happenings,
 * kept in a bounded ring buffer on the state for UI toasts and debugging.
 */

export type SimEventType = "BladderAccident" | "PassedOut" | "WokeUp" | "Death";

export interface SimEvent {
  tick: number;
  type: SimEventType;
  personId?: PersonId;
  /** Flat extra payload (e.g. { cause: "starvation" }); keep it clone-friendly. */
  data?: Record<string, string | number>;
}

export const EVENT_LOG_CAPACITY = 256;

/** Clone without materializing absent optional keys (keeps hashes stable). */
export function cloneEvent(e: SimEvent): SimEvent {
  const out: SimEvent = { tick: e.tick, type: e.type };
  if (e.personId !== undefined) out.personId = e.personId;
  if (e.data !== undefined) out.data = { ...e.data };
  return out;
}

/**
 * Bounded insertion-ordered event log: once full, pushing drops the oldest
 * event. Iteration order is insertion order (determinism rule).
 */
export class EventLog {
  private events: SimEvent[] = [];

  push(event: SimEvent): void {
    this.events.push(event);
    if (this.events.length > EVENT_LOG_CAPACITY) this.events.shift();
  }

  /** Events newer than the given tick (exclusive), oldest first. */
  since(tick: number): SimEvent[] {
    return this.events.filter((e) => e.tick > tick).map(cloneEvent);
  }

  toArray(): SimEvent[] {
    return this.events.map(cloneEvent);
  }

  static from(events: readonly SimEvent[]): EventLog {
    const log = new EventLog();
    for (const e of events) log.push(cloneEvent(e));
    return log;
  }
}
