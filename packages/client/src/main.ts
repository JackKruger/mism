import { Application, Container, Sprite } from "pixi.js";
import {
  footprintTiles,
  LOT_SIZE,
  type ObjectId,
  type PersonId,
  type Rotation,
  type SimEvent,
  type SimSnapshot,
} from "@homestead/sim";
import { loadContent, type ObjectDef } from "@homestead/content";
import { toSimContent } from "./content/simContent.js";
import { SimClient } from "./worker/simClient.js";
import { createTextures } from "./render/textures.js";
import { buildTerrain } from "./render/terrain.js";
import { PersonSprite } from "./render/personView.js";
import { ObjectSprite } from "./render/objectView.js";
import { CameraController } from "./input/camera.js";
import { HALF_H, HALF_W, screenToTile, worldToScreen } from "./render/iso.js";
import { Hud } from "./ui/hud.js";
import { NeedsPanel } from "./ui/needsPanel.js";
import { showToast } from "./ui/toast.js";

/** Starter kit layout: fridge at (28,28), further defs 4 tiles apart along the row. */
const STARTER_TILE = { x: 28, y: 28 };
const STARTER_SPACING = 4;

/** Toast text for player-facing SimEvents; null = not surfaced. */
function eventToast(e: SimEvent): string | null {
  switch (e.type) {
    case "BladderAccident":
      return "Bladder accident!";
    case "PassedOut":
      return "Passed out from exhaustion";
    case "WokeUp":
      return "Woke up";
    case "Death":
      return e.data?.["cause"] !== undefined ? `Died (${e.data["cause"]})` : "Died";
    case "InteractionFailed":
      return e.data?.["reason"] !== undefined
        ? `Interaction failed: ${e.data["reason"]}`
        : "Interaction failed";
    default:
      return null;
  }
}

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

  // --- Content + sim connection ---------------------------------------------
  const bundle = loadContent();
  const defs = new Map<string, ObjectDef>(bundle.objects.map((d) => [d.id, d]));

  const sim = new SimClient();
  await sim.init(20260714, toSimContent(bundle));

  const res = await sim.send({ t: "AddPerson", name: "Alex Folk", x: 32, y: 32 });
  const personId: PersonId | undefined = res.ok ? res.personId : undefined;
  if (personId === undefined) throw new Error("Failed to create starting person");

  // Starter kit: one of each def in a row, fridge first at the anchor tile.
  // Placement failures are skipped silently (content may outgrow the row).
  const starterDefs = [
    ...bundle.objects.filter((d) => d.id.startsWith("fridge")),
    ...bundle.objects.filter((d) => !d.id.startsWith("fridge")),
  ];
  starterDefs.forEach((def, i) => {
    void sim.send({
      t: "PlaceObject",
      defId: def.id,
      tile: { x: STARTER_TILE.x + i * STARTER_SPACING, y: STARTER_TILE.y },
      rotation: 0,
    });
  });

  const people = new Map<number, PersonSprite>();
  const objects = new Map<number, ObjectSprite>();
  let latest: SimSnapshot | null = null;
  let lastEventTick = -1;

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

    // Objects are static: create/remove sprites keyed by instance id.
    for (const ov of snap.objects) {
      if (objects.has(ov.id)) continue;
      const def = defs.get(ov.defId);
      if (!def) continue;
      const sprite = new ObjectSprite(ov, def);
      objects.set(ov.id, sprite);
      entities.addChild(sprite.view);
    }
    for (const [id, sprite] of objects) {
      if (snap.objects.some((o) => o.id === id)) continue;
      entities.removeChild(sprite.view);
      sprite.view.destroy();
      objects.delete(id);
    }

    for (const e of snap.events) {
      if (e.tick <= lastEventTick) continue;
      const text = eventToast(e);
      if (text !== null) showToast(text);
    }
    lastEventTick = snap.tick;

    hud.syncFromSim(snap);
    needsPanel.syncFromSim(snap, personId);
  });

  // --- Input ----------------------------------------------------------------
  /** Object (and its first interaction) under a tile, from the latest snapshot. */
  const objectAt = (tx: number, ty: number): { id: number; interaction: string } | null => {
    if (!latest) return null;
    for (const ov of latest.objects) {
      const def = defs.get(ov.defId);
      if (!def) continue;
      const tiles = footprintTiles(def, { x: ov.x, y: ov.y }, ov.rotation as Rotation);
      if (!tiles.some((t) => t.x === tx && t.y === ty)) continue;
      const interaction = def.interactions[0];
      if (interaction !== undefined) return { id: ov.id, interaction };
    }
    return null;
  };

  const onTileClick = async (tx: number, ty: number): Promise<void> => {
    const target = objectAt(tx, ty);
    const result = target
      ? await sim.send({
          t: "QueueInteraction",
          person: personId,
          object: target.id as ObjectId,
          interaction: target.interaction,
        })
      : await sim.send({ t: "WalkTo", person: personId, x: tx, y: ty });
    if (!result.ok) {
      showToast(target ? `Can't do that (${result.error})` : `Can't walk there (${result.error})`);
    }
  };

  const camera = new CameraController(world, app.canvas, (screenX, screenY) => {
    const local = cameraToWorld(screenX, screenY);
    const tile = screenToTile(local.x, local.y);
    if (tile.x < 0 || tile.y < 0 || tile.x >= LOT_SIZE || tile.y >= LOT_SIZE) return;
    void onTileClick(tile.x, tile.y);
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
  const needsPanel = new NeedsPanel();

  // Debug/e2e hook (used by the headless verify flow, .claude/skills/verify).
  Object.assign(window, { __homestead: { sim, personId } });

  // --- Render loop ----------------------------------------------------------
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    camera.update(dt);
    for (const sprite of people.values()) sprite.update(dt);
    hud.tickFps();
  });
}

void boot();
