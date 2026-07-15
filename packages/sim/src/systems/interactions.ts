import type { Person } from "../people/person.js";
import type { SimState } from "../state.js";
import { MOTIVES, clampMotive, type MotiveName } from "../people/needs.js";
import { TICKS_PER_SIM_MINUTE } from "../core/clock.js";
import { findPath } from "../path/astar.js";
import { personTile } from "../people/person.js";
import { resolveSlots } from "../objects/slots.js";

/**
 * S-203: queue executor + statechart interpreter, split into two systems that
 * run around movement in the tick pipeline (ARCHITECTURE.md §3.3):
 *   queueExecutorSystem — pops the queue head, routes the person to the slot;
 *   interactionRunnerSystem — detects arrival, then runs the statechart.
 *
 * v1 verb set: only `anim:<name>` (sets person.activity for the renderer).
 * Unknown verbs are ignored so content can be authored ahead of engine verbs.
 */

function endInteraction(person: Person): void {
  person.active = null;
  person.activity = null;
}

function fail(state: SimState, person: Person, interaction: string, reason: string): void {
  state.eventLog.push({
    tick: state.clock.tick,
    type: "InteractionFailed",
    personId: person.id,
    data: { interaction, reason },
  });
}

export function queueExecutorSystem(state: SimState): void {
  for (const person of state.people.values()) {
    if (person.status !== "normal") continue;
    if (person.active !== null || person.queue.length === 0) continue;

    const action = person.queue.shift()!;
    const obj = state.objects.get(action.object);
    if (!obj) {
      fail(state, person, action.interaction, "object-gone");
      continue;
    }
    const def = state.contentIndex.get(obj.defId);
    const idef = state.interactionIndex.get(action.interaction);
    if (!def || !idef) {
      fail(state, person, action.interaction, "unknown-def");
      continue;
    }
    const slots = resolveSlots(def, obj.tile, obj.rotation);
    const slotIndex = idef.slot ?? 0;
    const slot = slots[slotIndex];
    if (!slot) {
      fail(state, person, action.interaction, "no-slot");
      continue;
    }
    const path = findPath(state.lot, personTile(person), slot.tile);
    if (path === null) {
      fail(state, person, action.interaction, "unreachable");
      continue;
    }
    person.path = path;
    person.pathNavVersion = state.lot.navVersion;
    person.active = {
      object: action.object,
      interaction: action.interaction,
      phase: "routing",
      stateName: "start",
      stateTicks: 0,
      slotIndex,
    };
  }
}

export function interactionRunnerSystem(state: SimState): void {
  for (const person of state.people.values()) {
    if (person.status !== "normal" || person.active === null) continue;
    const act = person.active;

    if (act.phase === "routing") {
      if (person.path.length > 0) continue; // still walking
      const obj = state.objects.get(act.object);
      const def = obj ? state.contentIndex.get(obj.defId) : undefined;
      if (!obj || !def) {
        fail(state, person, act.interaction, "object-gone");
        endInteraction(person);
        continue;
      }
      const slot = resolveSlots(def, obj.tile, obj.rotation)[act.slotIndex];
      if (!slot) {
        fail(state, person, act.interaction, "no-slot");
        endInteraction(person);
        continue;
      }
      person.px = slot.tile.x;
      person.py = slot.tile.y;
      person.facing = slot.facing;
      act.phase = "running";
      act.stateName = "start";
      act.stateTicks = 0;
      state.eventLog.push({
        tick: state.clock.tick,
        type: "InteractionStarted",
        personId: person.id,
        data: { interaction: act.interaction },
      });
    }

    const idef = state.interactionIndex.get(act.interaction);
    if (!idef) {
      endInteraction(person);
      continue;
    }

    // Interruption: a critical motive aborts the interaction (S-206 rules
    // get richer later; v1 = simple thresholds).
    const below = idef.interruptible?.below;
    if (below) {
      let interrupted = false;
      for (const motive of MOTIVES) {
        const threshold = below[motive];
        if (threshold !== undefined && person.needs[motive] < threshold) {
          interrupted = true;
          break;
        }
      }
      if (interrupted) {
        state.eventLog.push({
          tick: state.clock.tick,
          type: "InteractionInterrupted",
          personId: person.id,
          data: { interaction: act.interaction },
        });
        endInteraction(person);
        continue;
      }
    }

    const stateDef = idef.states[act.stateName];
    if (!stateDef) {
      endInteraction(person);
      continue;
    }

    if (stateDef.do !== undefined && stateDef.do.startsWith("anim:")) {
      person.activity = stateDef.do.slice("anim:".length);
    }

    if (stateDef.perMin) {
      for (const motive of MOTIVES) {
        const perMin = stateDef.perMin[motive as MotiveName];
        if (perMin !== undefined) {
          person.needs[motive] = clampMotive(person.needs[motive] + perMin / TICKS_PER_SIM_MINUTE);
        }
      }
    }

    act.stateTicks += 1;

    let advance: boolean;
    if (stateDef.untilMotive) {
      advance = person.needs[stateDef.untilMotive.motive] >= stateDef.untilMotive.gte;
    } else if (stateDef.durationMin !== undefined) {
      advance = act.stateTicks >= stateDef.durationMin * TICKS_PER_SIM_MINUTE;
    } else {
      advance = true; // instantaneous state
    }

    if (advance) {
      const next = stateDef.next ?? "$exit";
      if (next === "$exit") {
        state.eventLog.push({
          tick: state.clock.tick,
          type: "InteractionCompleted",
          personId: person.id,
          data: { interaction: act.interaction },
        });
        endInteraction(person);
      } else {
        act.stateName = next;
        act.stateTicks = 0;
      }
    }
  }
}
