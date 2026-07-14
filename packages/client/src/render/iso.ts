/** Classic 2:1 dimetric projection. Tile diamond is 64×32 px. */
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

/** World tile coords (can be fractional) → screen px at the tile's center. */
export function worldToScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * HALF_W, sy: (x + y) * HALF_H };
}

/** Screen px → fractional world tile coords. */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return {
    x: sy / TILE_H + sx / TILE_W,
    y: sy / TILE_H - sx / TILE_W,
  };
}

/** Screen px → integer tile under that point. */
export function screenToTile(sx: number, sy: number): { x: number; y: number } {
  const { x, y } = screenToWorld(sx, sy);
  return { x: Math.round(x), y: Math.round(y) };
}
