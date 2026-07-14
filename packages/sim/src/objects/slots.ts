import type { Facing } from "../people/person.js";
import type { SimObjectDef, SlotType } from "./content.js";
import type { Rotation } from "./objInstance.js";
import type { Tile } from "../world/lot.js";
import { facingFromDelta } from "../people/person.js";
import { rotateOffset } from "./placement.js";

/** A slot resolved to an absolute tile + concrete iso facing. */
export interface ResolvedSlot {
  type: SlotType;
  tile: Tile;
  facing: Facing;
}

/**
 * Resolve an object's route slots for its placement. Slot offsets rotate with
 * the object using the convention documented in placement.ts. Facing:
 * - 'object': look from the slot tile back toward the origin tile,
 * - 'away':   look in the opposite direction;
 * - a slot on the origin tile itself (offset [0,0], e.g. sitting on a chair)
 *   faces the object's front, which is +y (iso SW) at rotation 0 and rotates
 *   with the object.
 */
export function resolveSlots(def: SimObjectDef, tile: Tile, rotation: Rotation): ResolvedSlot[] {
  return def.slots.map((slot) => {
    const [dx, dy] = rotateOffset(slot.offset[0], slot.offset[1], rotation);
    let [fx, fy] = slot.facing === "object" ? [-dx, -dy] : [dx, dy];
    if (fx === 0 && fy === 0) [fx, fy] = rotateOffset(0, 1, rotation);
    return {
      type: slot.type,
      tile: { x: tile.x + dx, y: tile.y + dy },
      facing: facingFromDelta(fx, fy),
    };
  });
}
