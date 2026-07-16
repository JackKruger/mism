import type { MotiveName, PersonStatus, SimContent, SimEventType, TraitName } from "../../src/index.js";

/**
 * Scenario-test schema (Q-101, ARCHITECTURE.md §7.2).
 *
 * Scenarios are plain JSON files in test/scenario/scenarios/ (JSON, not YAML —
 * no extra dependency). Plain TS types + a hand-rolled validator in runner.ts;
 * no zod here so the suite stays dependency-light.
 */

export interface ScenarioObject {
  defId: string;
  /** [x, y] origin tile. */
  tile: [number, number];
  /** Quarter-turns clockwise; default 0. */
  rotation?: 0 | 1 | 2 | 3;
}

export interface ScenarioPerson {
  name: string;
  /** [x, y] spawn tile (must be walkable when the person is added). */
  tile: [number, number];
  /** Motive overrides applied via DebugSetNeed after spawning; each in [-100, 100]. */
  needs?: Partial<Record<MotiveName, number>>;
  /** Trait overrides merged over the neutral personality (all 5s); each 0..10. */
  personality?: Partial<Record<TraitName, number>>;
}

/**
 * A JSON-shaped sim Command. Fields are passed through verbatim except:
 *   - "person": a number is a scenario person INDEX, resolved to the PersonId
 *     returned by AddPerson;
 *   - "object": a number is a scenario object INDEX, resolved to the ObjectId
 *     returned by PlaceObject;
 *   - "tile": a [x, y] pair is converted to the sim's { x, y } Tile shape.
 */
export interface ScenarioCommand {
  t: string;
  [key: string]: unknown;
}

export interface ScenarioScriptEntry {
  /** Sim-minute (from scenario start) at which the command is applied. */
  atMin: number;
  cmd: ScenarioCommand;
}

/**
 * Time-bound assertions. Semantics (see runner.ts):
 *   - byMin:     checked every sim-minute; passes at the FIRST minute it holds,
 *                fails if still unmet when byMin elapses.
 *   - withinMin: watched over [0, withinMin]; fails the moment it is violated.
 *   - atMin:     checked exactly once, at that sim-minute.
 */
export type ScenarioAssertion =
  | {
      type: "motiveAtLeast";
      person: number;
      motive: MotiveName;
      value: number;
      byMin?: number;
      atMin?: number;
    }
  | {
      type: "motiveAtMost";
      person: number;
      motive: MotiveName;
      value: number;
      byMin?: number;
      atMin?: number;
    }
  | { type: "moodAtLeast"; person: number; value: number; byMin?: number; atMin?: number }
  | {
      type: "eventOccurred";
      eventType: SimEventType;
      byMin: number;
      /** Optional person index the event must belong to. */
      person?: number;
      /** Optional subset match against the event's data payload. */
      where?: Record<string, string | number>;
    }
  | {
      type: "eventNever";
      eventType: SimEventType;
      withinMin: number;
      person?: number;
      where?: Record<string, string | number>;
    }
  | { type: "statusIs"; person: number; status: PersonStatus; atMin: number };

export interface Scenario {
  name: string;
  seed: number;
  /** true → run against the real shipped catalog (loadContent + toSimContent). */
  useCatalog?: boolean;
  /** Inline sim content; required when useCatalog is false/absent. */
  content?: SimContent;
  objects?: ScenarioObject[];
  people: ScenarioPerson[];
  script?: ScenarioScriptEntry[];
  assertions: ScenarioAssertion[];
}
