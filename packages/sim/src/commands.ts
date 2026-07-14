import type { PersonId } from "./core/ids.js";
import type { GameSpeed } from "./core/clock.js";
import type { SimState } from "./state.js";
import { asPersonId } from "./core/ids.js";
import { findPath } from "./path/astar.js";
import { isWalkable } from "./world/lot.js";
import { personTile } from "./people/person.js";

export type Command =
  | { t: "WalkTo"; person: PersonId; x: number; y: number }
  | { t: "SetSpeed"; speed: GameSpeed }
  | { t: "AddPerson"; name: string; x: number; y: number };

export type CommandError =
  | "unknown-person"
  | "unreachable"
  | "out-of-bounds"
  | "tile-blocked";

export type CommandResult =
  | { ok: true; personId?: PersonId }
  | { ok: false; error: CommandError };

export function applyCommand(state: SimState, cmd: Command): CommandResult {
  switch (cmd.t) {
    case "SetSpeed": {
      state.clock.speed = cmd.speed;
      return { ok: true };
    }

    case "AddPerson": {
      if (!isWalkable(state.lot, cmd.x, cmd.y)) return { ok: false, error: "tile-blocked" };
      const id = asPersonId(state.nextEntityId++);
      state.people.add(id, {
        id,
        name: cmd.name,
        px: cmd.x,
        py: cmd.y,
        facing: "se",
        anim: "idle",
        path: [],
        pathNavVersion: state.lot.navVersion,
      });
      return { ok: true, personId: id };
    }

    case "WalkTo": {
      const person = state.people.get(cmd.person);
      if (!person) return { ok: false, error: "unknown-person" };
      if (!isWalkable(state.lot, cmd.x, cmd.y)) return { ok: false, error: "tile-blocked" };
      const path = findPath(state.lot, personTile(person), { x: cmd.x, y: cmd.y });
      if (path === null) return { ok: false, error: "unreachable" };
      person.path = path;
      person.pathNavVersion = state.lot.navVersion;
      return { ok: true };
    }
  }
}
