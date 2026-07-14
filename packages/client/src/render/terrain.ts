import { Container, Sprite } from "pixi.js";
import type { GameTextures } from "./textures.js";
import { HALF_H, HALF_W, worldToScreen } from "./iso.js";

/** Builds the static terrain layer: one sprite per tile, checker of two grass variants. */
export function buildTerrain(size: number, textures: GameTextures): Container {
  const layer = new Container();
  layer.interactiveChildren = false;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sprite = new Sprite((x + y) % 2 === 0 ? textures.grassA : textures.grassB);
      const { sx, sy } = worldToScreen(x, y);
      // Sprite top-left so the diamond's center lands on the tile center.
      sprite.position.set(sx - HALF_W, sy - HALF_H);
      layer.addChild(sprite);
    }
  }
  layer.cacheAsTexture(true);
  return layer;
}
