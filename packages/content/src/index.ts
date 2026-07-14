import type { z } from "zod";
import type { InteractionDef } from "./schemas/interaction.js";
import type { ObjectDef } from "./schemas/objectDef.js";
import { interactionDefSchema } from "./schemas/interaction.js";
import { objectDefSchema } from "./schemas/objectDef.js";
import fridgeJson from "../data/objects/fridge.json";
import fridgeHaveSnackJson from "../data/interactions/fridge_have_snack.json";

export { MOTIVES, motiveRecord, motiveSchema } from "./schemas/motives.js";
export type { Motive } from "./schemas/motives.js";
export { objectCategorySchema, objectDefSchema, slotDefSchema } from "./schemas/objectDef.js";
export type { ObjectCategory, ObjectDef, SlotDef } from "./schemas/objectDef.js";
export { EXIT_STATE, interactionDefSchema } from "./schemas/interaction.js";
export type { InteractionDef, InteractionState } from "./schemas/interaction.js";

export interface ContentBundle {
  objects: ObjectDef[];
  interactions: InteractionDef[];
}

/** A raw (unvalidated) content file: its repo path plus parsed JSON. */
export interface RawContentSource {
  path: string;
  data: unknown;
}

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, source: RawContentSource): z.infer<S> {
  const result = schema.safeParse(source.data);
  if (result.success) return result.data as z.infer<S>;
  const lines = result.error.issues.map((issue) => {
    const at = issue.path.length > 0 ? `:${issue.path.join(".")}` : "";
    return `  ${source.path}${at} — ${issue.message}`;
  });
  throw new Error(`Content validation failed\n${lines.join("\n")}`);
}

/**
 * Validate raw content sources into a typed bundle. Throws with a
 * path-accurate message (file path + JSON path) on the first invalid file,
 * including cross-file checks (duplicate ids, object → interaction refs).
 */
export function validateContent(
  objects: RawContentSource[],
  interactions: RawContentSource[],
): ContentBundle {
  const objectDefs = objects.map((s) => parseOrThrow(objectDefSchema, s));
  const interactionDefs = interactions.map((s) => parseOrThrow(interactionDefSchema, s));

  const seen = new Map<string, string>();
  for (const [i, def] of objectDefs.entries()) {
    const path = objects[i]!.path;
    const prior = seen.get(def.id);
    if (prior !== undefined) throw new Error(`  ${path}:id — duplicate id '${def.id}' (also in ${prior})`);
    seen.set(def.id, path);
  }
  const interactionIds = new Map<string, string>();
  for (const [i, def] of interactionDefs.entries()) {
    const path = interactions[i]!.path;
    const prior = interactionIds.get(def.id);
    if (prior !== undefined) throw new Error(`  ${path}:id — duplicate id '${def.id}' (also in ${prior})`);
    interactionIds.set(def.id, path);
  }
  for (const [i, def] of objectDefs.entries()) {
    for (const [j, ref] of def.interactions.entries()) {
      if (!interactionIds.has(ref)) {
        throw new Error(
          `  ${objects[i]!.path}:interactions.${j} — references unknown interaction '${ref}'`,
        );
      }
    }
  }

  return { objects: objectDefs, interactions: interactionDefs };
}

/** All bundled content files. New JSON files must be registered here. */
const OBJECT_SOURCES: RawContentSource[] = [
  { path: "data/objects/fridge.json", data: fridgeJson },
];

const INTERACTION_SOURCES: RawContentSource[] = [
  { path: "data/interactions/fridge_have_snack.json", data: fridgeHaveSnackJson },
];

/** Validate the shipped content files and return the typed bundle. */
export function loadContent(): ContentBundle {
  return validateContent(OBJECT_SOURCES, INTERACTION_SOURCES);
}
