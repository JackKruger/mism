import { describe, expect, it } from "vitest";
import { createLot, tileIndex } from "../src/world/lot.js";
import { findPath } from "../src/path/astar.js";

describe("A* pathfinding", () => {
  it("finds a straight cardinal path of the right length", () => {
    const lot = createLot();
    const path = findPath(lot, { x: 5, y: 5 }, { x: 10, y: 5 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(path![path!.length - 1]).toEqual({ x: 10, y: 5 });
  });

  it("uses diagonals for a straight diagonal line", () => {
    const lot = createLot();
    const path = findPath(lot, { x: 5, y: 5 }, { x: 10, y: 10 });
    expect(path!.length).toBe(5);
  });

  it("start === goal returns an empty path", () => {
    const lot = createLot();
    expect(findPath(lot, { x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([]);
  });

  it("routes around a wall of blockers", () => {
    const lot = createLot();
    // Vertical wall at x=8, y=0..62 with a single gap at y=63.
    for (let y = 0; y < 63; y++) lot.blocked[tileIndex(lot, 8, y)] = 1;
    const path = findPath(lot, { x: 5, y: 5 }, { x: 12, y: 5 });
    expect(path).not.toBeNull();
    // Must pass through the gap at (8, 63).
    expect(path!.some((t) => t.x === 8 && t.y === 63)).toBe(true);
  });

  it("returns null for unreachable targets", () => {
    const lot = createLot();
    for (let y = 0; y < lot.size; y++) lot.blocked[tileIndex(lot, 8, y)] = 1;
    expect(findPath(lot, { x: 5, y: 5 }, { x: 12, y: 5 })).toBeNull();
  });

  it("never cuts corners diagonally", () => {
    const lot = createLot();
    lot.blocked[tileIndex(lot, 6, 5)] = 1;
    lot.blocked[tileIndex(lot, 5, 6)] = 1;
    const path = findPath(lot, { x: 5, y: 5 }, { x: 6, y: 6 })!;
    // The direct diagonal squeezes between two blockers — must be avoided.
    expect(path.length).toBeGreaterThan(1);
  });

  it("is deterministic", () => {
    const lot = createLot();
    for (let i = 0; i < 200; i++) {
      lot.blocked[(i * 37) % lot.blocked.length] = 1;
    }
    lot.blocked[tileIndex(lot, 2, 2)] = 0;
    lot.blocked[tileIndex(lot, 60, 60)] = 0;
    const a = findPath(lot, { x: 2, y: 2 }, { x: 60, y: 60 });
    const b = findPath(lot, { x: 2, y: 2 }, { x: 60, y: 60 });
    expect(a).toEqual(b);
  });
});
