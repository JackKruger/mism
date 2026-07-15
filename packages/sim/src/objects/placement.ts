import type { SimObjectDef } from "./content.js";
import type { ObjInstance, Rotation } from "./objInstance.js";
import type { SimState } from "../state.js";
import type { Tile } from "../world/lot.js";
import { asObjectId } from "../core/ids.js";
import { inBounds, tileIndex } from "../world/lot.js";

/**
 * ROTATION CONVENTION
 * `rotation` counts 90° clockwise quarter-turns in tile space, where +x is
 * east and +y is south on the tile grid (on screen, +x projects to iso SE and
 * +y to iso SW). An offset (dx, dy) from the origin tile maps to:
 *   r0: ( dx,  dy)    r1: (-dy,  dx)    r2: (-dx, -dy)    r3: ( dy, -dx)
 * The origin tile itself never moves; rotated footprints and slots may extend
 * to negative offsets from it. Slot offsets use the same mapping (slots.ts).
 */
export function rotateOffset(dx: number, dy: number, rotation: Rotation): [number, number] {
  switch (rotation) {
    case 0:
      return [dx, dy];
    case 1:
      return [-dy, dx];
    case 2:
      return [-dx, -dy];
    case 3:
      return [dy, -dx];
  }
}

/** All tiles covered by `def`'s [w, h] footprint at `tile` with `rotation`. */
export function footprintTiles(def: SimObjectDef, tile: Tile, rotation: Rotation): Tile[] {
  const [w, h] = def.footprint;
  const tiles: Tile[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const [dx, dy] = rotateOffset(i, j, rotation);
      tiles.push({ x: tile.x + dx, y: tile.y + dy });
    }
  }
  return tiles;
}

/** True when every footprint tile is in bounds and unblocked (no overlap). */
export function canPlace(state: SimState, def: SimObjectDef, tile: Tile, rotation: Rotation): boolean {
  for (const t of footprintTiles(def, tile, rotation)) {
    if (!inBounds(state.lot, t.x, t.y)) return false;
    if (state.lot.blocked[tileIndex(state.lot, t.x, t.y)] !== 0) return false;
  }
  return true;
}

/**
 * Create and register an object instance. Caller must have checked canPlace.
 * Marks the footprint blocked and bumps navVersion (invalidates paths).
 */
export function placeObject(state: SimState, def: SimObjectDef, tile: Tile, rotation: Rotation): ObjInstance {
  const id = asObjectId(state.nextEntityId++);
  const obj: ObjInstance = {
    id,
    defId: def.id,
    tile: { x: tile.x, y: tile.y },
    rotation,
    objState: "default",
  };
  state.objects.add(id, obj);
  for (const t of footprintTiles(def, tile, rotation)) {
    state.lot.blocked[tileIndex(state.lot, t.x, t.y)] = 1;
  }
  state.lot.navVersion++;
  return obj;
}

/** Remove an instance: unblock its footprint and bump navVersion. */
export function removeObject(state: SimState, obj: ObjInstance, def: SimObjectDef): void {
  for (const t of footprintTiles(def, obj.tile, obj.rotation)) {
    state.lot.blocked[tileIndex(state.lot, t.x, t.y)] = 0;
  }
  state.objects.remove(obj.id);
  state.lot.navVersion++;
}
