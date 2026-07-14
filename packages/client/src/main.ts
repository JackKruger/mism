import { Application, Container, Sprite } from "pixi.js";
import { LOT_SIZE, type PersonId, type SimSnapshot } from "@homestead/sim";
import { SimClient } from "./worker/simClient.js";
import { createTextures } from "./render/textures.js";
import { buildTerrain } from "./render/terrain.js";
import { PersonSprite } from "./render/personView.js";
import { CameraController } from "./input/camera.js";
import { HALF_H, HALF_W, screenToTile, worldToScreen } from "./render/iso.js";
import { Hud } from "./ui/hud.js";

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x1a2430, antialias: true });
  document.getElementById("game")!.appendChild(app.canvas);

  const textures = await createTextures(app.renderer);

  // World container = camera target. Layers bottom→top.
  const world = new Container();
  app.stage.addChild(world);

  const terrain = buildTerrain(LOT_SIZE, textures);
  world.addChild(terrain);

  const hover = new Sprite(textures.tileHover);
  hover.visible = false;
  world.addChild(hover);

  const entities = new Container();
  entities.sortableChildren = true;
  world.addChild(entities);

  // Center camera on the middle of the lot.
  const mid = worldToScreen(LOT_SIZE / 2, LOT_SIZE / 2);
  world.position.set(window.innerWidth / 2 - mid.sx, window.innerHeight / 2 - mid.sy);

  // --- Sim connection -------------------------------------------------------
  const sim = new SimClient();
  await sim.init(20260714);

  const res = await sim.send({ t: "AddPerson", name: "Alex Folk", x: 32, y: 32 });
  const personId: PersonId | undefined = res.ok ? res.personId : undefined;
  if (personId === undefined) throw new Error("Failed to create starting person");

  const people = new Map<number, PersonSprite>();
  let latest: SimSnapshot | null = null;

  sim.onSnapshot((snap) => {
    latest = snap;
    for (const pv of snap.people) {
      let sprite = people.get(pv.id);
      if (!sprite) {
        sprite = new PersonSprite();
        sprite.dispX = pv.x;
        sprite.dispY = pv.y;
        people.set(pv.id, sprite);
        entities.addChild(sprite.view);
      }
      sprite.syncFromSim(pv);
    }
    hud.syncFromSim(snap);
  });

  // --- Input ----------------------------------------------------------------
  const camera = new CameraController(world, app.canvas, (screenX, screenY) => {
    const local = cameraToWorld(screenX, screenY);
    const tile = screenToTile(local.x, local.y);
    if (tile.x < 0 || tile.y < 0 || tile.x >= LOT_SIZE || tile.y >= LOT_SIZE) return;
    void sim.send({ t: "WalkTo", person: personId, x: tile.x, y: tile.y });
  });

  const cameraToWorld = (sx: number, sy: number) => camera.toWorldPx(sx, sy);

  app.canvas.addEventListener("pointermove", (e) => {
    const local = cameraToWorld(e.clientX, e.clientY);
    const tile = screenToTile(local.x, local.y);
    const inBounds = tile.x >= 0 && tile.y >= 0 && tile.x < LOT_SIZE && tile.y < LOT_SIZE;
    hover.visible = inBounds;
    if (inBounds) {
      const { sx, sy } = worldToScreen(tile.x, tile.y);
      hover.position.set(sx - HALF_W, sy - HALF_H);
    }
  });

  const hud = new Hud((speed) => void sim.send({ t: "SetSpeed", speed }));

  // --- Render loop ----------------------------------------------------------
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    camera.update(dt);
    for (const sprite of people.values()) sprite.update(dt);
    hud.tickFps();
    void latest;
  });
}

void boot();
