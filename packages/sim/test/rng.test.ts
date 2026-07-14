import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng.js";

describe("Rng (xoshiro128**)", () => {
  it("same seed produces the same sequence", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    for (let i = 0; i < 10_000; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });

  it("different seeds diverge", () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    const draws = Array.from({ length: 16 }, () => a.nextUint32() === b.nextUint32());
    expect(draws.every(Boolean)).toBe(false);
  });

  it("serialize/restore resumes the exact sequence", () => {
    const a = Rng.fromSeed(7);
    for (let i = 0; i < 100; i++) a.nextUint32();
    const b = new Rng(a.state());
    for (let i = 0; i < 1000; i++) {
      expect(b.nextUint32()).toBe(a.nextUint32());
    }
  });

  it("float() stays in [0,1) and int() respects bounds", () => {
    const r = Rng.fromSeed(3);
    for (let i = 0; i < 10_000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-3, 5);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});
