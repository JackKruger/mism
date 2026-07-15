import type { ObjectId, PersonId } from "./core/ids.js";
import type { GameSpeed } from "./core/clock.js";
import type { Personality } from "./people/personality.js";
import type { Rotation } from "./objects/objInstance.js";
import type { SimState } from "./state.js";
import type { Tile } from "./world/lot.js";
import { asPersonId } from "./core/ids.js";
import { canPlace, placeObject, removeObject } from "./objects/placement.js";
import { findPath } from "./path/astar.js";
import { isWalkable } from "./world/lot.js";
import { createPerson, personTile } from "./people/person.js";
import { defaultPersonality, isValidPersonality } from "./people/personality.js";

export type Command =
  | { t: "WalkTo"; person: PersonId; x: number; y: number }
  | { t: "SetSpeed"; speed: GameSpeed }
  | { t: "AddPerson"; name: string; x: number; y: number; personality?: Personality }
  | { t: "PlaceObject"; defId: string; tile: Tile; rotation: Rotation }
  | { t: "RemoveObject"; object: ObjectId };

export type CommandError =
  | "unknown-person"
  | "unreachable"
  | "out-of-bounds"
  | "tile-blocked"
  | "invalid-personality"
  | "person-incapacitated"
  | "unknown-def"
  | "unknown-object"
  | "invalid-placement";

export type CommandResult =
  | { ok: true; personId?: PersonId; objectId?: ObjectId }
  | { ok: false; error: CommandError };

export function applyCommand(state: SimState, cmd: Command): CommandResult {
  switch (cmd.t) {
    case "SetSpeed": {
      state.clock.speed = cmd.speed;
      return { ok: true };
    }

    case "AddPerson": {
      if (!isWalkable(state.lot, cmd.x, cmd.y)) return { ok: false, error: "tile-blocked" };
      const personality = cmd.personality ?? defaultPersonality();
      if (!isValidPersonality(personality)) return { ok: false, error: "invalid-personality" };
      const id = asPersonId(state.nextEntityId++);
      state.people.add(
        id,
        createPerson(id, cmd.name, cmd.x, cmd.y, { ...personality }, state.lot.navVersion),
      );
      return { ok: true, personId: id };
    }

    case "WalkTo": {
      const person = state.people.get(cmd.person);
      if (!person) return { ok: false, error: "unknown-person" };
      if (person.status !== "normal") return { ok: false, error: "person-incapacitated" };
      if (!isWalkable(state.lot, cmd.x, cmd.y)) return { ok: false, error: "tile-blocked" };
      const path = findPath(state.lot, personTile(person), { x: cmd.x, y: cmd.y });
      if (path === null) return { ok: false, error: "unreachable" };
      person.path = path;
      person.pathNavVersion = state.lot.navVersion;
      return { ok: true };
    }

    case "PlaceObject": {
      const def = state.contentIndex.get(cmd.defId);
      if (!def) return { ok: false, error: "unknown-def" };
      if (!canPlace(state, def, cmd.tile, cmd.rotation)) {
        return { ok: false, error: "invalid-placement" };
      }
      const obj = placeObject(state, def, cmd.tile, cmd.rotation);
      return { ok: true, objectId: obj.id };
    }

    case "RemoveObject": {
      const obj = state.objects.get(cmd.object);
      if (!obj) return { ok: false, error: "unknown-object" };
      const def = state.contentIndex.get(obj.defId);
      if (!def) return { ok: false, error: "unknown-def" };
      removeObject(state, obj, def);
      return { ok: true };
    }
  }
}
