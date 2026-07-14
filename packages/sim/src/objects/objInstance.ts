import type { ObjectId } from "../core/ids.js";
import type { Tile } from "../world/lot.js";

/** Quarter-turn rotation; see placement.ts for the exact convention. */
export type Rotation = 0 | 1 | 2 | 3;

/** A placed object on the lot. Static per-def data lives in the content index. */
export interface ObjInstance {
  id: ObjectId;
  defId: string;
  /** Origin tile; the rotated footprint extends from here (footprintTiles). */
  tile: Tile;
  rotation: Rotation;
  /** Current state variant name: 'default' | 'dirty' | 'broken' | 'on'. */
  objState: string;
}
