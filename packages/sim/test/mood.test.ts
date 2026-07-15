import { describe, expect, it } from "vitest";
import { computeMood, motiveCurve, motiveWeight } from "../src/people/mood.js";
import { createNeeds } from "../src/people/needs.js";
import type { Needs } from "../src/people/needs.js";

const needsWith = (overrides: Partial<Needs>): Needs => ({ ...createNeeds(), ...overrides });

describe("mood (S-102, §3.5)", () => {
  it("weight(m) = ((100 - m)/200)^2 — table-driven", () => {
    const cases: Array<[number, number]> = [
      [100, 0],
      [50, 0.0625],
      [0, 0.25],
      [-50, 0.5625],
      [-100, 1],
    ];
    for (const [m, expected] of cases) {
      expect(motiveWeight(m), `weight(${m})`).toBeCloseTo(expected, 10);
    }
  });

  it("curve(m) is identity above 0 and 1.5× steeper below", () => {
    const cases: Array<[number, number]> = [
      [100, 100],
      [50, 50],
      [0, 0],
      [-50, -75],
      [-100, -150],
    ];
    for (const [m, expected] of cases) {
      expect(motiveCurve(m), `curve(${m})`).toBeCloseTo(expected, 10);
    }
  });

  it("edge values: all motives full → 100; all empty → clamped to -100", () => {
    const full: Needs = {
      hunger: 100, energy: 100, comfort: 100, fun: 100,
      social: 100, hygiene: 100, bladder: 100, room: 100,
    };
    expect(computeMood(full)).toBe(100);

    const empty: Needs = {
      hunger: -100, energy: -100, comfort: -100, fun: -100,
      social: -100, hygiene: -100, bladder: -100, room: -100,
    };
    expect(computeMood(empty)).toBe(-100);
  });

  it("matches the hand-computed weighted average for a mixed panel", () => {
    // hunger -80 (w 0.81, curve -120), six motives at +90 (w 0.0025, curve 90),
    // room 0 (w 0.25, curve 0).
    const needs = needsWith({ hunger: -80, energy: 90, comfort: 90, fun: 90, social: 90, hygiene: 90, bladder: 90 });
    const weighted = 0.81 * -120 + 6 * (0.0025 * 90) + 0.25 * 0;
    const weightSum = 0.81 + 6 * 0.0025 + 0.25;
    expect(computeMood(needs)).toBeCloseTo(weighted / weightSum, 10);
  });

  it("a starving person's mood is dominated by hunger", () => {
    // Everything else nearly full, but hunger empty: weight(hunger) = 1 crushes
    // the tiny weights of the healthy motives — mood pegs at the floor.
    const starving = needsWith({ hunger: -100, energy: 90, comfort: 90, fun: 90, social: 90, hygiene: 90, bladder: 90 });
    expect(computeMood(starving)).toBe(-100);

    // Same panel with hunger merely low stays clearly negative but off the floor.
    const hungry = needsWith({ hunger: -80, energy: 90, comfort: 90, fun: 90, social: 90, hygiene: 90, bladder: 90 });
    expect(computeMood(hungry)).toBeLessThan(-80);
    expect(computeMood(hungry)).toBeGreaterThan(-100);
  });
});
