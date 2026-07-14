import { Assets, Graphics, Texture, type Renderer } from "pixi.js";
import { HALF_H, HALF_W } from "./iso.js";

/**
 * Placeholder texture factory.
 * Every texture here corresponds to a row in docs/ASSET_MANIFEST.md: we first
 * try to load the real asset from its manifest path, and fall back to the
 * procedural placeholder when it doesn't exist yet. Dropping a final PNG at
 * the manifest path upgrades the game with zero code changes.
 */

async function loadOrFallback(path: string, fallback: () => Texture): Promise<Texture> {
  try {
    const tex = await Assets.load<Texture>(path);
    tex.source.scaleMode = "nearest";
    return tex;
  } catch {
    return fallback();
  }
}

function diamond(renderer: Renderer, fill: number, stroke?: { color: number; alpha: number }): Texture {
  const g = new Graphics();
  g.poly([HALF_W, 0, TILE_DIAMOND_W, HALF_H, HALF_W, TILE_DIAMOND_H, 0, HALF_H]).fill(fill);
  if (stroke) {
    g.poly([HALF_W, 0, TILE_DIAMOND_W, HALF_H, HALF_W, TILE_DIAMOND_H, 0, HALF_H]).stroke({
      width: 2,
      color: stroke.color,
      alpha: stroke.alpha,
    });
  }
  return renderer.generateTexture({ target: g, resolution: 1 });
}

const TILE_DIAMOND_W = HALF_W * 2;
const TILE_DIAMOND_H = HALF_H * 2;

export interface GameTextures {
  grassA: Texture;
  grassB: Texture;
  tileHover: Texture;
  tileBlocked: Texture;
}

export async function createTextures(renderer: Renderer): Promise<GameTextures> {
  const [grassA, grassB, tileHover, tileBlocked] = await Promise.all([
    loadOrFallback("assets/terrain/grass_a.png", () => diamond(renderer, 0x5d9e4f)),
    loadOrFallback("assets/terrain/grass_b.png", () => diamond(renderer, 0x569548)),
    loadOrFallback("assets/terrain/tile_hover.png", () => {
      const g = new Graphics();
      g.poly([HALF_W, 0, TILE_DIAMOND_W, HALF_H, HALF_W, TILE_DIAMOND_H, 0, HALF_H])
        .fill({ color: 0xffffff, alpha: 0.25 })
        .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      return renderer.generateTexture({ target: g, resolution: 1 });
    }),
    loadOrFallback("assets/terrain/tile_blocked.png", () => {
      const g = new Graphics();
      g.poly([HALF_W, 0, TILE_DIAMOND_W, HALF_H, HALF_W, TILE_DIAMOND_H, 0, HALF_H])
        .fill({ color: 0xd94f4f, alpha: 0.3 })
        .stroke({ width: 2, color: 0xe86a6a, alpha: 0.9 });
      return renderer.generateTexture({ target: g, resolution: 1 });
    }),
  ]);
  return { grassA, grassB, tileHover, tileBlocked };
}
