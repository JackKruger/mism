/**
 * Fixed-timestep sim clock.
 * 1 tick = 3 sim-seconds → 20 ticks per sim-minute.
 * At game speed 1 the worker runs 20 ticks/real-second (1 sim-min per real-sec).
 */

export const TICKS_PER_SIM_MINUTE = 20;
export const SIM_MINUTES_PER_DAY = 24 * 60;
export const TICKS_PER_DAY = TICKS_PER_SIM_MINUTE * SIM_MINUTES_PER_DAY;

/** Sim-day starts at 07:00 on day 1 (classic morning start). */
export const START_MINUTE_OF_DAY = 7 * 60;

export type GameSpeed = 0 | 1 | 3 | 10;

export interface Clock {
  tick: number;
  speed: GameSpeed;
}

export const createClock = (): Clock => ({ tick: 0, speed: 1 });

export function minuteOfDay(clock: Clock): number {
  const totalMinutes = Math.floor(clock.tick / TICKS_PER_SIM_MINUTE) + START_MINUTE_OF_DAY;
  return totalMinutes % SIM_MINUTES_PER_DAY;
}

export function dayNumber(clock: Clock): number {
  const totalMinutes = Math.floor(clock.tick / TICKS_PER_SIM_MINUTE) + START_MINUTE_OF_DAY;
  return Math.floor(totalMinutes / SIM_MINUTES_PER_DAY) + 1;
}

export function timeString(clock: Clock): string {
  const m = minuteOfDay(clock);
  const hh = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Advances one tick; returns true when this tick crossed midnight (new day). */
export function advanceTick(clock: Clock): boolean {
  const dayBefore = dayNumber(clock);
  clock.tick += 1;
  return dayNumber(clock) !== dayBefore;
}
