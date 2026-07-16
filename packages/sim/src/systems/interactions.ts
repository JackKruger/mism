import type { ObjectId } from "../core/ids.js";
import type { ActiveInteraction, Person } from "../people/person.js";
import type { SimState } from "../state.js";
import { MOTIVES, clampMotive, type MotiveName } from "../people/needs.js";
import { TICKS_PER_SIM_MINUTE } from "../core/clock.js";
import { blocksTiles, placeObject, removeObject } from "../objects/placement.js";
import { findPath } from "../path/astar.js";
import { personTile } from "../people/person.js";
import { resolveSlots } from "../objects/slots.js";
import { suppressAd } from "./autonomy.js";

/**
 * S-203: queue executor + statechart interpreter, split into two systems that
 * run around movement in the tick pipeline (ARCHITECTURE.md §3.3):
 *   queueExecutorSystem — pops the queue head, routes the person to the slot;
 *   interactionRunnerSystem — detects arrival, then runs the statechart.
 *
 * Verbs execute once on state ENTRY (stateTicks 0), not every tick; perMin
 * deltas continue to apply per tick. Current verb set (C-109, §4):
 *   anim:<name>     — set person.activity (persists until the interaction ends)
 *   spawnAt:<defId> — spawn a non-blocking object at the person's tile
 *   destroyObject   — remove the interaction's target object
 * Unknown verbs are ignored so content can be authored ahead of engine verbs.
 */

function endInteraction(person: Person): void {
  person.active = null;
  person.activity = null;
}

function fail(
  state: SimState,
  person: Person,
  object: ObjectId,
  interaction: string,
  reason: string,
): void {
  state.eventLog.push({
    tick: state.clock.tick,
    type: "InteractionFailed",
    personId: person.id,
    data: { interaction, reason },
  });
  // Failed actions suppress their ad so autonomy doesn't retry immediately (§3.7).
  suppressAd(state, person, object, interaction);
}

/** Execute a `do` verb on state entry (see verb set above). */
function runVerb(state: SimState, person: Person, act: ActiveInteraction, verb: string): void {
  if (verb.startsWith("anim:")) {
    person.activity = verb.slice("anim:".length);
    return;
  }
  if (verb.startsWith("spawnAt:")) {
    const def = state.contentIndex.get(verb.slice("spawnAt:".length));
    // canPlace is bypassed, so only known, non-blocking defs may spawn — a
    // blocking spawn could trap the spawner or overlap another footprint.
    if (def !== undefined && !blocksTiles(def)) {
      placeObject(state, def, personTile(person), 0);
    }
    return;
  }
  if (verb === "destroyObject") {
    const obj = state.objects.get(act.object);
    const def = obj !== undefined ? state.contentIndex.get(obj.defId) : undefined;
    if (obj !== undefined && def !== undefined) removeObject(state, obj, def);
    // The statechart keeps running (its next transition is typically $exit).
    return;
  }
  // Unknown verb: ignore.
}

export function queueExecutorSystem(state: SimState): void {
  for (const person of state.people.values()) {
    if (person.status !== "normal") continue;
    if (person.active !== null || person.queue.length === 0) continue;

    const action = person.queue.shift()!;
    const obj = state.objects.get(action.object);
    if (!obj) {
      fail(state, person, action.object, action.interaction, "object-gone");
      continue;
    }
    const def = state.contentIndex.get(obj.defId);
    const idef = state.interactionIndex.get(action.interaction);
    if (!def || !idef) {
      fail(state, person, action.object, action.interaction, "unknown-def");
      continue;
    }
    const slots = resolveSlots(def, obj.tile, obj.rotation);
    const slotIndex = idef.slot ?? 0;
    const slot = slots[slotIndex];
    if (!slot) {
      fail(state, person, action.object, action.interaction, "no-slot");
      continue;
    }
    const path = findPath(state.lot, personTile(person), slot.tile);
    if (path === null) {
      fail(state, person, action.object, action.interaction, "unreachable");
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
        fail(state, person, act.object, act.interaction, "object-gone");
        endInteraction(person);
        continue;
      }
      const slot = resolveSlots(def, obj.tile, obj.rotation)[act.slotIndex];
      if (!slot) {
        fail(state, person, act.object, act.interaction, "no-slot");
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

    // stateTicks is 0 exactly on state entry (reset on transition and on
    // arrival) — and stays >0 across save/load mid-state, so verbs never
    // re-run on resume.
    if (act.stateTicks === 0 && stateDef.do !== undefined) {
      runVerb(state, person, act, stateDef.do);
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
