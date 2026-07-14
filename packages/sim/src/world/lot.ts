export const LOT_SIZE = 64;

export interface Tile {
  x: number;
  y: number;
}

export interface Lot {
  size: number;
  /** Terrain paint id per tile (0 = grass). Row-major [y * size + x]. */
  terrain: Uint8Array;
  /** Static blockers per tile (objects, later). 0 = walkable. */
  blocked: Uint8Array;
  /** Bumped on any edit that changes walkability; invalidates cached paths. */
  navVersion: number;
}

export const createLot = (): Lot => ({
  size: LOT_SIZE,
  terrain: new Uint8Array(LOT_SIZE * LOT_SIZE),
  blocked: new Uint8Array(LOT_SIZE * LOT_SIZE),
  navVersion: 0,
});

export const inBounds = (lot: Lot, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < lot.size && y < lot.size;

export const isWalkable = (lot: Lot, x: number, y: number): boolean =>
  inBounds(lot, x, y) && lot.blocked[y * lot.size + x] === 0;

export const tileIndex = (lot: Lot, x: number, y: number): number => y * lot.size + x;
