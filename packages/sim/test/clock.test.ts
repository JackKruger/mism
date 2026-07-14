import { describe, expect, it } from "vitest";
import {
  TICKS_PER_SIM_MINUTE,
  advanceTick,
  createClock,
  dayNumber,
  minuteOfDay,
  timeString,
} from "../src/core/clock.js";

describe("Clock", () => {
  it("starts day 1 at 07:00", () => {
    const c = createClock();
    expect(dayNumber(c)).toBe(1);
    expect(timeString(c)).toBe("07:00");
  });

  it("advances one sim-minute per TICKS_PER_SIM_MINUTE ticks", () => {
    const c = createClock();
    for (let i = 0; i < TICKS_PER_SIM_MINUTE; i++) advanceTick(c);
    expect(timeString(c)).toBe("07:01");
  });

  it("rolls over to a new day at midnight and reports it exactly once", () => {
    const c = createClock();
    const minutesToMidnight = 17 * 60; // 07:00 → 24:00
    let rollovers = 0;
    for (let i = 0; i < minutesToMidnight * TICKS_PER_SIM_MINUTE + 5; i++) {
      if (advanceTick(c)) rollovers++;
    }
    expect(rollovers).toBe(1);
    expect(dayNumber(c)).toBe(2);
    expect(minuteOfDay(c)).toBe(0);
  });
});
