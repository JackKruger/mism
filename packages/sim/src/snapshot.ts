import type { SimState } from "./state.js";
import type { Facing, AnimName } from "./people/person.js";
import type { GameSpeed } from "./core/clock.js";
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
}

export function buildSnapshot(state: SimState): SimSnapshot {
  return {
    tick: state.clock.tick,
    speed: state.clock.speed,
    day: dayNumber(state.clock),
    minuteOfDay: minuteOfDay(state.clock),
    timeString: timeString(state.clock),
    lotSize: state.lot.size,
    people: [...state.people.values()].map((p) => ({
      id: p.id,
      name: p.name,
      x: p.px,
      y: p.py,
      facing: p.facing,
      anim: p.anim,
      queueLength: p.path.length > 0 ? 1 : 0,
    })),
    objects: [...state.objects.values()].map((o) => ({
      id: o.id,
      defId: o.defId,
      x: o.tile.x,
      y: o.tile.y,
      rotation: o.rotation,
      objState: o.objState,
    })),
  };
}
