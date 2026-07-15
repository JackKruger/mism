import { describe, expect, it } from "vitest";
import {
  interactionDefSchema,
  loadContent,
  objectDefSchema,
  validateContent,
} from "../src/index.js";
import fridgeJson from "../data/objects/fridge.json";
import fridgeHaveSnackJson from "../data/interactions/fridge_have_snack.json";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("loadContent", () => {
  it("validates the shipped M1 catalog into a typed bundle", () => {
    const bundle = loadContent();
    expect(bundle.objects).toHaveLength(8);
    expect(bundle.interactions).toHaveLength(9);
    const fridge = bundle.objects.find((o) => o.id === "fridge_econocool")!;
    expect(fridge.footprint).toEqual([1, 1]);
    expect(fridge.slots[0]!.facing).toBe("object");
    const snack = bundle.interactions.find((i) => i.id === "fridge.have_snack")!;
    expect(snack.states["eat"]!.perMin).toEqual({ hunger: 8 });
  });
});

describe("objectDefSchema", () => {
  it("rejects a zero-width footprint", () => {
    const bad = clone(fridgeJson) as Record<string, unknown>;
    bad["footprint"] = [0, 1];
    const result = objectDefSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0]!;
      expect(issue.path).toEqual(["footprint", 0]);
    }
  });

  it("rejects unknown motives and out-of-range ratings", () => {
    const bad = clone(fridgeJson) as Record<string, unknown>;
    bad["motiveRatings"] = { hunger: 11 };
    expect(objectDefSchema.safeParse(bad).success).toBe(false);
    bad["motiveRatings"] = { snacks: 3 };
    expect(objectDefSchema.safeParse(bad).success).toBe(false);
  });

  it("requires a 'default' sprite state", () => {
    const bad = clone(fridgeJson) as { states: Record<string, string> };
    delete bad.states["default"];
    expect(objectDefSchema.safeParse(bad).success).toBe(false);
  });
});

describe("interactionDefSchema", () => {
  it("rejects a chart with no 'start' state", () => {
    const bad = clone(fridgeHaveSnackJson) as { states: Record<string, unknown> };
    bad.states["begin"] = bad.states["start"];
    delete bad.states["start"];
    const result = interactionDefSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("'start'");
    }
  });

  it("rejects a dangling next reference with a path-accurate issue", () => {
    const bad = clone(fridgeHaveSnackJson) as {
      states: Record<string, { next?: string }>;
    };
    bad.states["start"]!.next = "nope";
    const result = interactionDefSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0]!;
      expect(issue.path).toEqual(["states", "start", "next"]);
      expect(issue.message).toContain("'nope'");
    }
  });

  it("rejects a dangling onFail reference", () => {
    const bad = clone(fridgeHaveSnackJson) as {
      states: Record<string, { onFail?: string }>;
    };
    bad.states["eat"]!.onFail = "cry";
    expect(interactionDefSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts '$exit' as a transition target but not as a state name", () => {
    const ok = clone(fridgeHaveSnackJson);
    expect(interactionDefSchema.safeParse(ok).success).toBe(true);

    const bad = clone(fridgeHaveSnackJson) as { states: Record<string, unknown> };
    bad.states["$exit"] = {};
    expect(interactionDefSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects interruptible.notDuring naming an unknown state", () => {
    const bad = clone(fridgeHaveSnackJson) as {
      interruptible: { notDuring?: string[] };
    };
    bad.interruptible.notDuring = ["prep"];
    const result = interactionDefSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(["interruptible", "notDuring", 0]);
    }
  });
});

describe("validateContent", () => {
  it("throws with file path and JSON path on invalid data", () => {
    const bad = clone(fridgeJson) as Record<string, unknown>;
    bad["footprint"] = [0, 1];
    expect(() =>
      validateContent([{ path: "data/objects/bad_fridge.json", data: bad }], []),
    ).toThrow(/data\/objects\/bad_fridge\.json:footprint\.0/);
  });

  it("throws on an object referencing an unknown interaction", () => {
    expect(() => validateContent([{ path: "data/objects/fridge.json", data: fridgeJson }], [])).toThrow(
      /data\/objects\/fridge\.json:interactions\.0 — references unknown interaction 'fridge\.have_snack'/,
    );
  });

  it("throws on duplicate ids", () => {
    expect(() =>
      validateContent(
        [
          { path: "data/objects/fridge.json", data: fridgeJson },
          { path: "data/objects/fridge2.json", data: fridgeJson },
        ],
        [{ path: "data/interactions/fridge_have_snack.json", data: fridgeHaveSnackJson }],
      ),
    ).toThrow(/duplicate id 'fridge_econocool'/);
  });
});
