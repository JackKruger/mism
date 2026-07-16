import type {
  Command,
  MotiveName,
  ObjectId,
  PersonId,
  PersonView,
  Scenario,
  ScenarioAssertion,
  ScenarioCommand,
  SimContent,
  SimEvent,
  SimHandle,
  SimSnapshot,
  TraitName,
} from "./deps.js";
import { TICKS_PER_SIM_MINUTE, createSim, loadCatalogContent } from "./deps.js";

/**
 * Q-101 scenario runner: build a headless sim from a JSON scenario, tick it
 * minute-by-minute up to the assertions' max horizon, and evaluate time-bound
 * assertions (see types.ts for byMin / withinMin / atMin semantics).
 */

// ---------------------------------------------------------------------------
// Validation (parseScenario) — hand-rolled, path-accurate errors, no zod.
// ---------------------------------------------------------------------------

const MOTIVE_NAMES: readonly string[] = [
  "hunger",
  "energy",
  "comfort",
  "fun",
  "social",
  "hygiene",
  "bladder",
  "room",
];

const TRAIT_NAMES: readonly string[] = ["neat", "outgoing", "active", "playful", "nice"];

const STATUS_NAMES: readonly string[] = ["normal", "passedOut", "dead"];

const EVENT_TYPES: readonly string[] = [
  "BladderAccident",
  "PassedOut",
  "WokeUp",
  "Death",
  "InteractionStarted",
  "InteractionCompleted",
  "InteractionFailed",
  "InteractionInterrupted",
];

const ASSERTION_TYPES: readonly string[] = [
  "motiveAtLeast",
  "motiveAtMost",
  "moodAtLeast",
  "eventOccurred",
  "eventNever",
  "statusIs",
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTilePair(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number");
}

class ScenarioParseError extends Error {}

function bad(source: string, path: string, msg: string): never {
  throw new ScenarioParseError(`${source}:${path} — ${msg}`);
}

function checkMotiveMap(source: string, path: string, v: unknown): void {
  if (!isRecord(v)) bad(source, path, "expected an object of motive → number");
  for (const [k, val] of Object.entries(v)) {
    if (!MOTIVE_NAMES.includes(k)) bad(source, `${path}.${k}`, `unknown motive '${k}'`);
    if (typeof val !== "number") bad(source, `${path}.${k}`, "expected a number");
  }
}

function checkAssertion(source: string, path: string, a: unknown, peopleCount: number): void {
  if (!isRecord(a)) bad(source, path, "expected an assertion object");
  if (typeof a.type !== "string" || !ASSERTION_TYPES.includes(a.type)) {
    bad(source, `${path}.type`, `expected one of ${ASSERTION_TYPES.join(", ")}`);
  }
  const personIndex = (required: boolean): void => {
    if (a.person === undefined) {
      if (required) bad(source, `${path}.person`, "person index required");
      return;
    }
    if (typeof a.person !== "number" || !Number.isInteger(a.person)) {
      bad(source, `${path}.person`, "expected an integer person index");
    }
    if (a.person < 0 || a.person >= peopleCount) {
      bad(source, `${path}.person`, `person index ${a.person} out of range (0..${peopleCount - 1})`);
    }
  };
  const oneTimeBoundOf = (fields: string[]): void => {
    const set = fields.filter((f) => a[f] !== undefined);
    if (set.length !== 1) {
      bad(source, path, `exactly one of ${fields.join("/")} required (got ${set.length})`);
    }
    const f = set[0]!;
    if (typeof a[f] !== "number" || (a[f] as number) < 0) {
      bad(source, `${path}.${f}`, "expected a sim-minute >= 0");
    }
  };
  switch (a.type) {
    case "motiveAtLeast":
    case "motiveAtMost":
      personIndex(true);
      if (typeof a.motive !== "string" || !MOTIVE_NAMES.includes(a.motive)) {
        bad(source, `${path}.motive`, `expected one of ${MOTIVE_NAMES.join(", ")}`);
      }
      if (typeof a.value !== "number") bad(source, `${path}.value`, "expected a number");
      oneTimeBoundOf(["byMin", "atMin"]);
      break;
    case "moodAtLeast":
      personIndex(true);
      if (typeof a.value !== "number") bad(source, `${path}.value`, "expected a number");
      oneTimeBoundOf(["byMin", "atMin"]);
      break;
    case "eventOccurred":
    case "eventNever": {
      if (typeof a.eventType !== "string" || !EVENT_TYPES.includes(a.eventType)) {
        bad(source, `${path}.eventType`, `expected one of ${EVENT_TYPES.join(", ")}`);
      }
      personIndex(false);
      if (a.where !== undefined && !isRecord(a.where)) {
        bad(source, `${path}.where`, "expected an object of data-field → value");
      }
      oneTimeBoundOf([a.type === "eventOccurred" ? "byMin" : "withinMin"]);
      break;
    }
    case "statusIs":
      personIndex(true);
      if (typeof a.status !== "string" || !STATUS_NAMES.includes(a.status)) {
        bad(source, `${path}.status`, `expected one of ${STATUS_NAMES.join(", ")}`);
      }
      oneTimeBoundOf(["atMin"]);
      break;
  }
}

/** Validate raw JSON into a typed Scenario; throws with `source:path — message`. */
export function parseScenario(raw: unknown, source: string): Scenario {
  if (!isRecord(raw)) bad(source, "$", "expected a scenario object");
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    bad(source, "name", "expected a non-empty string");
  }
  if (typeof raw.seed !== "number" || !Number.isInteger(raw.seed)) {
    bad(source, "seed", "expected an integer");
  }
  if (raw.useCatalog !== undefined && typeof raw.useCatalog !== "boolean") {
    bad(source, "useCatalog", "expected a boolean");
  }
  if (raw.useCatalog !== true && !isRecord(raw.content)) {
    bad(source, "content", "inline content required when useCatalog is not true");
  }

  if (raw.objects !== undefined) {
    if (!Array.isArray(raw.objects)) bad(source, "objects", "expected an array");
    for (const [i, o] of raw.objects.entries()) {
      const p = `objects[${i}]`;
      if (!isRecord(o)) bad(source, p, "expected an object placement");
      if (typeof o.defId !== "string") bad(source, `${p}.defId`, "expected a string");
      if (!isTilePair(o.tile)) bad(source, `${p}.tile`, "expected [x, y]");
      if (o.rotation !== undefined && ![0, 1, 2, 3].includes(o.rotation as number)) {
        bad(source, `${p}.rotation`, "expected 0|1|2|3");
      }
    }
  }

  if (!Array.isArray(raw.people) || raw.people.length === 0) {
    bad(source, "people", "expected a non-empty array");
  }
  for (const [i, person] of raw.people.entries()) {
    const p = `people[${i}]`;
    if (!isRecord(person)) bad(source, p, "expected a person object");
    if (typeof person.name !== "string") bad(source, `${p}.name`, "expected a string");
    if (!isTilePair(person.tile)) bad(source, `${p}.tile`, "expected [x, y]");
    if (person.needs !== undefined) checkMotiveMap(source, `${p}.needs`, person.needs);
    if (person.personality !== undefined) {
      if (!isRecord(person.personality)) bad(source, `${p}.personality`, "expected an object");
      for (const [k, v] of Object.entries(person.personality)) {
        if (!TRAIT_NAMES.includes(k)) bad(source, `${p}.personality.${k}`, `unknown trait '${k}'`);
        if (typeof v !== "number") bad(source, `${p}.personality.${k}`, "expected a number");
      }
    }
  }

  if (raw.script !== undefined) {
    if (!Array.isArray(raw.script)) bad(source, "script", "expected an array");
    for (const [i, entry] of raw.script.entries()) {
      const p = `script[${i}]`;
      if (!isRecord(entry)) bad(source, p, "expected a script entry");
      if (typeof entry.atMin !== "number" || entry.atMin < 0) {
        bad(source, `${p}.atMin`, "expected a sim-minute >= 0");
      }
      if (!isRecord(entry.cmd) || typeof entry.cmd.t !== "string") {
        bad(source, `${p}.cmd`, "expected a command object with a 't' field");
      }
    }
  }

  if (!Array.isArray(raw.assertions) || raw.assertions.length === 0) {
    bad(source, "assertions", "expected a non-empty array");
  }
  for (const [i, a] of raw.assertions.entries()) {
    checkAssertion(source, `assertions[${i}]`, a, raw.people.length);
  }

  return raw as unknown as Scenario;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** A SimEvent tagged with the sim-minute of the runner loop that observed it. */
interface ObservedEvent extends SimEvent {
  minute: number;
}

interface Tracker {
  assertion: ScenarioAssertion;
  index: number;
  /** Resolved (pass) — "by" assertions latch at first satisfaction. */
  passed: boolean;
  passedAtMin?: number;
}

function neutralPersonality(
  overrides: Partial<Record<TraitName, number>> | undefined,
): Record<TraitName, number> {
  return { neat: 5, outgoing: 5, active: 5, playful: 5, nice: 5, ...overrides };
}

function formatPerson(p: PersonView): string {
  const needs = (Object.entries(p.needs) as Array<[string, number]>)
    .map(([m, v]) => `${m}:${v}`)
    .join(" ");
  return `#${p.id} ${p.name} @(${p.x.toFixed(1)},${p.y.toFixed(1)}) status=${p.status} mood=${p.mood} activity=${p.activity ?? "-"} | ${needs}`;
}

function formatEvent(e: ObservedEvent): string {
  const data = e.data ? ` ${JSON.stringify(e.data)}` : "";
  const who = e.personId !== undefined ? ` person=${e.personId}` : "";
  return `  min ${e.minute} (tick ${e.tick}): ${e.type}${who}${data}`;
}

class ScenarioRun {
  private readonly sim: SimHandle;
  private readonly personIds: PersonId[] = [];
  private readonly objectIds: ObjectId[] = [];
  private readonly trackers: Tracker[];
  private readonly events: ObservedEvent[] = [];
  private lastEventTick = -1;
  private snap: SimSnapshot;

  constructor(private readonly scenario: Scenario) {
    const content: SimContent = scenario.useCatalog
      ? loadCatalogContent()
      : (scenario.content ?? { objects: [], interactions: [] });
    this.sim = createSim({ seed: scenario.seed, content });
    this.trackers = scenario.assertions.map((assertion, index) => ({
      assertion,
      index,
      passed: false,
    }));

    for (const [i, o] of (scenario.objects ?? []).entries()) {
      const res = this.sim.apply({
        t: "PlaceObject",
        defId: o.defId,
        tile: { x: o.tile[0], y: o.tile[1] },
        rotation: o.rotation ?? 0,
      });
      if (!res.ok || res.objectId === undefined) {
        throw this.setupError(`objects[${i}] PlaceObject ${o.defId} at (${o.tile[0]},${o.tile[1]})`, res);
      }
      this.objectIds.push(res.objectId);
    }

    for (const [i, p] of scenario.people.entries()) {
      const res = this.sim.apply({
        t: "AddPerson",
        name: p.name,
        x: p.tile[0],
        y: p.tile[1],
        personality: neutralPersonality(p.personality),
      });
      if (!res.ok || res.personId === undefined) {
        throw this.setupError(`people[${i}] AddPerson '${p.name}' at (${p.tile[0]},${p.tile[1]})`, res);
      }
      this.personIds.push(res.personId);
      for (const [motive, value] of Object.entries(p.needs ?? {})) {
        const set = this.sim.apply({
          t: "DebugSetNeed",
          person: res.personId,
          motive: motive as MotiveName,
          value,
        });
        if (!set.ok) throw this.setupError(`people[${i}] DebugSetNeed ${motive}=${value}`, set);
      }
    }

    this.snap = this.sim.snapshot(this.lastEventTick);
    this.lastEventTick = this.snap.tick;
  }

  run(): void {
    const horizon = this.horizon();
    this.applyScript(0);
    this.evaluate(0);
    for (let min = 1; min <= horizon; min++) {
      this.sim.tick(TICKS_PER_SIM_MINUTE);
      this.snap = this.sim.snapshot(this.lastEventTick);
      this.lastEventTick = this.snap.tick;
      for (const e of this.snap.events) this.events.push({ ...e, minute: min });
      this.applyScript(min);
      this.evaluate(min);
    }
  }

  private horizon(): number {
    let max = 0;
    for (const a of this.scenario.assertions) {
      const bound =
        (a as { byMin?: number }).byMin ??
        (a as { withinMin?: number }).withinMin ??
        (a as { atMin?: number }).atMin ??
        0;
      max = Math.max(max, bound);
    }
    for (const entry of this.scenario.script ?? []) max = Math.max(max, entry.atMin);
    return max;
  }

  private applyScript(min: number): void {
    for (const [i, entry] of (this.scenario.script ?? []).entries()) {
      if (entry.atMin !== min) continue;
      const res = this.sim.apply(this.resolveCommand(entry.cmd, i));
      if (!res.ok) {
        throw this.setupError(`script[${i}] at min ${min}: ${JSON.stringify(entry.cmd)}`, res);
      }
    }
  }

  /** Resolve person/object index refs and [x,y] tiles to sim shapes. */
  private resolveCommand(cmd: ScenarioCommand, scriptIndex: number): Command {
    const out: Record<string, unknown> = { ...cmd };
    if (typeof out.person === "number") {
      const id = this.personIds[out.person];
      if (id === undefined) {
        throw new Error(
          `Scenario "${this.scenario.name}": script[${scriptIndex}].cmd.person index ${String(out.person)} out of range`,
        );
      }
      out.person = id;
    }
    if (typeof out.object === "number") {
      const id = this.objectIds[out.object];
      if (id === undefined) {
        throw new Error(
          `Scenario "${this.scenario.name}": script[${scriptIndex}].cmd.object index ${String(out.object)} out of range`,
        );
      }
      out.object = id;
    }
    if (isTilePair(out.tile)) out.tile = { x: out.tile[0], y: out.tile[1] };
    return out as unknown as Command;
  }

  private personView(index: number): PersonView {
    const id = this.personIds[index];
    const view = this.snap.people.find((p) => p.id === id);
    if (!view) throw new Error(`Scenario "${this.scenario.name}": person index ${index} missing from snapshot`);
    return view;
  }

  private matchesEvent(
    e: ObservedEvent,
    a: { eventType: string; person?: number; where?: Record<string, string | number> },
  ): boolean {
    if (e.type !== a.eventType) return false;
    if (a.person !== undefined && e.personId !== this.personIds[a.person]) return false;
    if (a.where) {
      for (const [k, v] of Object.entries(a.where)) {
        if (e.data?.[k] !== v) return false;
      }
    }
    return true;
  }

  private evaluate(min: number): void {
    for (const t of this.trackers) {
      if (t.passed) continue;
      const a = t.assertion;
      switch (a.type) {
        case "motiveAtLeast":
        case "motiveAtMost":
        case "moodAtLeast": {
          const view = this.personView(a.person);
          const actual =
            a.type === "moodAtLeast" ? view.mood : view.needs[(a as { motive: MotiveName }).motive];
          const holds = a.type === "motiveAtMost" ? actual <= a.value : actual >= a.value;
          if (a.atMin !== undefined) {
            if (min !== a.atMin) break;
            if (holds) this.pass(t, min);
            else throw this.failure(t, min, `actual value ${actual}`);
          } else {
            if (holds) this.pass(t, min);
            else if (min >= (a.byMin ?? 0)) {
              throw this.failure(t, min, `never satisfied; value at deadline: ${actual}`);
            }
          }
          break;
        }
        case "eventOccurred": {
          const hit = this.events.find((e) => this.matchesEvent(e, a));
          if (hit) this.pass(t, hit.minute);
          else if (min >= a.byMin) throw this.failure(t, min, "event never observed");
          break;
        }
        case "eventNever": {
          const hit = this.events.find((e) => e.minute <= a.withinMin && this.matchesEvent(e, a));
          if (hit) {
            throw this.failure(t, hit.minute, `forbidden event observed:\n${formatEvent(hit)}`);
          }
          if (min >= a.withinMin) this.pass(t, min);
          break;
        }
        case "statusIs": {
          if (min !== a.atMin) break;
          const view = this.personView(a.person);
          if (view.status === a.status) this.pass(t, min);
          else throw this.failure(t, min, `actual status '${view.status}'`);
          break;
        }
      }
    }
  }

  private pass(t: Tracker, min: number): void {
    t.passed = true;
    t.passedAtMin = min;
  }

  private setupError(what: string, res: { ok: boolean; error?: string }): Error {
    const err = res.ok ? "missing id in result" : (res.error ?? "unknown");
    return new Error(`Scenario "${this.scenario.name}": setup failed — ${what} → ${err}`);
  }

  private failure(t: Tracker, min: number, detail: string): Error {
    const lines = [
      `Scenario "${this.scenario.name}" FAILED`,
      `  assertion[${t.index}]: ${JSON.stringify(t.assertion)}`,
      `  ${detail}`,
      `  sim time: min ${min} of scenario (day ${this.snap.day} ${this.snap.timeString}, tick ${this.snap.tick})`,
      `  people:`,
      ...this.snap.people.map((p) => `    ${formatPerson(p)}`),
    ];
    const recent = this.events.slice(-12);
    if (recent.length > 0) {
      lines.push(`  last ${recent.length} events:`, ...recent.map(formatEvent));
    }
    return new Error(lines.join("\n"));
  }
}

/** Run a parsed scenario to completion; throws a rich Error on the first failed assertion. */
export function runScenario(scenario: Scenario): void {
  new ScenarioRun(scenario).run();
}
