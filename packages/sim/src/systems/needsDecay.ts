import type { SimState } from "../state.js";
import type { Person } from "../people/person.js";
import { MOTIVES, MOTIVE_MAX, MOTIVE_MIN, clampMotive } from "../people/needs.js";
import { computeMood } from "../people/mood.js";
import { decayModifierFor } from "../people/personality.js";
import { TICKS_PER_SIM_MINUTE } from "../core/clock.js";
import { TUNING } from "../tuning.js";

/** Sim-minutes elapsed per tick. */
const DT_MINUTES = 1 / TICKS_PER_SIM_MINUTE;

export const STARVATION_TICKS =
  TUNING.failures.starvationHours * 60 * TICKS_PER_SIM_MINUTE;

/**
 * NeedsDecay + MoodSystem + failure states (S-101, S-102, S-104).
 * Runs once per tick after the clock: decays motives (base rate ×
 * personality modifier, §3.5 — activityMod lands with interactions, S-203),
 * resolves failure states, then recomputes mood. Dead folk are skipped
 * entirely: their needs and mood freeze at time of death.
 */
export function needsDecaySystem(state: SimState): void {
  for (const person of state.people.values()) {
    if (person.status === "dead") continue;
    decayNeeds(person);
    applyFailureStates(state, person);
    person.mood = computeMood(person.needs);
  }
}

function decayNeeds(person: Person): void {
  for (const motive of MOTIVES) {
    if (motive === "energy" && person.status === "passedOut") {
      // Unconscious rest: energy slowly regenerates instead of decaying.
      person.needs.energy = clampMotive(
        person.needs.energy + TUNING.failures.passedOutEnergyRegenPerMinute * DT_MINUTES,
      );
      continue;
    }
    const base = TUNING.needs.baseDecayPerMinute[motive];
    if (base === 0) continue; // room: environmental, no decay
    const mod = decayModifierFor(person.personality, motive);
    person.needs[motive] = clampMotive(person.needs[motive] - base * mod * DT_MINUTES);
  }
}

function applyFailureStates(state: SimState, person: Person): void {
  const tick = state.clock.tick;

  // Bladder at -100 → accident: relief, at the price of hygiene and dignity.
  if (person.needs.bladder <= MOTIVE_MIN) {
    person.needs.bladder = MOTIVE_MAX;
    person.needs.hygiene = clampMotive(
      person.needs.hygiene - TUNING.failures.bladderAccidentHygienePenalty,
    );
    state.eventLog.push({ tick, type: "BladderAccident", personId: person.id });
  }

  // Energy at -100 → collapse where they stand; wake once partly recovered.
  if (person.status === "normal" && person.needs.energy <= MOTIVE_MIN) {
    person.status = "passedOut";
    person.path = [];
    person.anim = "idle";
    person.queue = [];
    person.active = null;
    person.activity = null;
    state.eventLog.push({ tick, type: "PassedOut", personId: person.id });
  } else if (person.status === "passedOut" && person.needs.energy >= TUNING.failures.passedOutWakeEnergy) {
    person.status = "normal";
    state.eventLog.push({ tick, type: "WokeUp", personId: person.id });
  }

  // Hunger pinned at -100 long enough → death by starvation.
  if (person.needs.hunger <= MOTIVE_MIN) {
    if (person.starvationStartTick === null) {
      person.starvationStartTick = tick;
    } else if (tick - person.starvationStartTick >= STARVATION_TICKS) {
      person.status = "dead";
      person.path = [];
      person.anim = "idle";
      person.queue = [];
      person.active = null;
      person.activity = null;
      state.eventLog.push({
        tick,
        type: "Death",
        personId: person.id,
        data: { cause: "starvation" },
      });
    }
  } else {
    person.starvationStartTick = null;
  }
}
