import type { SimState } from "./state.js";
import type { Facing, AnimName, PersonStatus } from "./people/person.js";
import type { MotiveName } from "./people/needs.js";
import type { GameSpeed } from "./core/clock.js";
import type { SimEvent } from "./core/events.js";
import { MOTIVES } from "./people/needs.js";
import { dayNumber, minuteOfDay, timeString } from "./core/clock.js";

/** Flat, structured-clone-friendly read model for the renderer. */
export interface PersonView {
  id: number;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  anim: AnimName;
  queueLength: number;
  /** Each motive rounded to an integer in [-100, 100]. */
  needs: Record<MotiveName, number>;
  mood: number;
  status: PersonStatus;
}

export interface ObjectView {
  id: number;
  defId: string;
  x: number;
  y: number;
  rotation: number;
  objState: string;
}

export interface SimSnapshot {
  tick: number;
  speed: GameSpeed;
  day: number;
  minuteOfDay: number;
  timeString: string;
  lotSize: number;
  people: PersonView[];
  objects: ObjectView[];
  /** SimEvents newer than the `sinceTick` passed to snapshot() (default: all retained). */
  events: SimEvent[];
}

export function buildSnapshot(state: SimState, sinceTick = -1): SimSnapshot {
  return {
    tick: state.clock.tick,
    speed: state.clock.speed,
    day: dayNumber(state.clock),
    minuteOfDay: minuteOfDay(state.clock),
    timeString: timeString(state.clock),
    lotSize: state.lot.size,
    people: [...state.people.values()].map((p) => {
      const needs = {} as Record<MotiveName, number>;
      for (const motive of MOTIVES) needs[motive] = Math.round(p.needs[motive]);
      return {
        id: p.id,
        name: p.name,
        x: p.px,
        y: p.py,
        facing: p.facing,
        anim: p.anim,
        queueLength: p.path.length > 0 ? 1 : 0,
        needs,
        mood: Math.round(p.mood),
        status: p.status,
      };
    }),
    objects: [...state.objects.values()].map((o) => ({
      id: o.id,
      defId: o.defId,
      x: o.tile.x,
      y: o.tile.y,
      rotation: o.rotation,
      objState: o.objState,
    })),
    events: state.eventLog.since(sinceTick),
  };
}
