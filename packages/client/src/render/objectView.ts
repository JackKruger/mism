import { Graphics } from "pixi.js";
import type { ObjectView, Rotation, SimObjectDef } from "@homestead/sim";
import { footprintTiles } from "@homestead/sim";
import { worldToScreen } from "./iso.js";

/**
 * Procedural placeholder object: an iso prism covering the def's rotated
 * footprint, with a stable per-defId pastel color — darker SW face, lighter
 * SE face. Replaced by per-object sprites when final art lands
 * (docs/ASSET_MANIFEST.md §5). Objects are static: drawn once at construction.
 */

const PRISM_HEIGHT = 28;
/** Fridges are the one tall M1 object; everything else gets the standard prism. */
const FRIDGE_HEIGHT = 48;

/**
 * zIndex = origin tile x+y plus this bias: keeps a person standing on the
 * tile south of the object (x+y one higher) in front, while still drawing
 * the object over a person on the tile behind it.
 */
const Z_BIAS = 0.5;

/** FNV-1a over the defId — stable across sessions, no per-build randomness. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hslToRgb(h: number, s: number, l: number): number {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to255 = (v: number): number => Math.round(v * 255);
  return (to255(channel(h + 1 / 3)) << 16) | (to255(channel(h)) << 8) | to255(channel(h - 1 / 3));
}

/** Stable pastel per defId (hash → hue). */
const pastelFor = (defId: string): number => hslToRgb((hashId(defId) % 360) / 360, 0.52, 0.72);

/** Multiply each RGB channel by k (0..1 darkens). */
function shade(color: number, k: number): number {
  const r = Math.round(((color >> 16) & 0xff) * k);
  const g = Math.round(((color >> 8) & 0xff) * k);
  const b = Math.round((color & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}

export class ObjectSprite {
  readonly view = new Graphics();

  constructor(obj: ObjectView, def: SimObjectDef) {
    // Rotated footprint tiles relative to the origin (rotation swaps [w, h]
    // extents at rotations 1/3 and may extend to negative offsets).
    const tiles = footprintTiles(def, { x: 0, y: 0 }, obj.rotation as Rotation);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of tiles) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x);
      maxY = Math.max(maxY, t.y);
    }

    const height = def.id.startsWith("fridge") ? FRIDGE_HEIGHT : PRISM_HEIGHT;
    const top = pastelFor(def.id);

    // Base diamond corners of the footprint rect (tile centers extend ±0.5).
    const n = worldToScreen(minX - 0.5, minY - 0.5);
    const e = worldToScreen(maxX + 0.5, minY - 0.5);
    const s = worldToScreen(maxX + 0.5, maxY + 0.5);
    const w = worldToScreen(minX - 0.5, maxY + 0.5);

    const g = this.view;
    // Left (SW-facing) face — darkest.
    g.poly([w.sx, w.sy - height, s.sx, s.sy - height, s.sx, s.sy, w.sx, w.sy]).fill(shade(top, 0.66));
    // Right (SE-facing) face — lighter than the left.
    g.poly([s.sx, s.sy - height, e.sx, e.sy - height, e.sx, e.sy, s.sx, s.sy]).fill(shade(top, 0.84));
    // Top face.
    g.poly([n.sx, n.sy - height, e.sx, e.sy - height, s.sx, s.sy - height, w.sx, w.sy - height])
      .fill(top)
      .stroke({ width: 1, color: shade(top, 0.55), alpha: 0.5 });

    const origin = worldToScreen(obj.x, obj.y);
    this.view.position.set(origin.sx, origin.sy);
    this.view.zIndex = obj.x + obj.y + Z_BIAS;
  }
}
