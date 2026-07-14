import type { Lot, Tile } from "../world/lot.js";
import { isWalkable } from "../world/lot.js";

/**
 * 8-directional A* on tile centers with octile heuristic.
 * Diagonal moves are forbidden when either adjacent cardinal tile is blocked
 * (no corner cutting). Fully deterministic: fixed neighbor order and a
 * monotonic insertion counter as the final heap tie-breaker.
 */

const CARD = 10; // cardinal step cost (scaled ints keep the heap integer-only)
const DIAG = 14;

// Order matters for determinism: E, W, S, N, then diagonals.
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, CARD], [-1, 0, CARD], [0, 1, CARD], [0, -1, CARD],
  [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG],
];

function octile(x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  return CARD * Math.max(dx, dy) + (DIAG - CARD) * Math.min(dx, dy);
}

interface HeapNode {
  idx: number; // tile index
  f: number;
  h: number;
  order: number; // insertion counter — final tie-breaker
}

class MinHeap {
  private a: HeapNode[] = [];

  get size(): number {
    return this.a.length;
  }

  private less(i: number, j: number): boolean {
    const x = this.a[i]!, y = this.a[j]!;
    if (x.f !== y.f) return x.f < y.f;
    if (x.h !== y.h) return x.h < y.h;
    return x.order < y.order;
  }

  push(n: HeapNode): void {
    this.a.push(n);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        [this.a[i], this.a[p]] = [this.a[p]!, this.a[i]!];
        i = p;
      } else break;
    }
  }

  pop(): HeapNode {
    const top = this.a[0]!;
    const last = this.a.pop()!;
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let m = i;
        if (l < this.a.length && this.less(l, m)) m = l;
        if (r < this.a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [this.a[i], this.a[m]] = [this.a[m]!, this.a[i]!];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Returns the tile path from start (exclusive) to goal (inclusive),
 * or null when unreachable. Start === goal returns [].
 */
export function findPath(lot: Lot, start: Tile, goal: Tile): Tile[] | null {
  if (!isWalkable(lot, goal.x, goal.y) || !isWalkable(lot, start.x, start.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const size = lot.size;
  const startIdx = start.y * size + start.x;
  const goalIdx = goal.y * size + goal.x;

  const gScore = new Int32Array(size * size).fill(-1);
  const cameFrom = new Int32Array(size * size).fill(-1);
  const closed = new Uint8Array(size * size);

  const open = new MinHeap();
  let counter = 0;
  gScore[startIdx] = 0;
  open.push({ idx: startIdx, f: octile(start.x, start.y, goal.x, goal.y), h: 0, order: counter++ });

  while (open.size > 0) {
    const cur = open.pop();
    if (cur.idx === goalIdx) {
      const path: Tile[] = [];
      let i = goalIdx;
      while (i !== startIdx) {
        path.push({ x: i % size, y: Math.floor(i / size) });
        i = cameFrom[i]!;
      }
      path.reverse();
      return path;
    }
    if (closed[cur.idx]) continue;
    closed[cur.idx] = 1;

    const cx = cur.idx % size;
    const cy = Math.floor(cur.idx / size);

    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isWalkable(lot, nx, ny)) continue;
      // No corner cutting on diagonals.
      if (dx !== 0 && dy !== 0 && (!isWalkable(lot, cx + dx, cy) || !isWalkable(lot, cx, cy + dy))) continue;

      const nIdx = ny * size + nx;
      if (closed[nIdx]) continue;
      const tentative = gScore[cur.idx]! + cost;
      if (gScore[nIdx] === -1 || tentative < gScore[nIdx]!) {
        gScore[nIdx] = tentative;
        cameFrom[nIdx] = cur.idx;
        const h = octile(nx, ny, goal.x, goal.y);
        open.push({ idx: nIdx, f: tentative + h, h, order: counter++ });
      }
    }
  }
  return null;
}
