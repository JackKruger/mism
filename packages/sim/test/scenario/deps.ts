/**
 * Single import point for everything the scenario runner pulls from outside
 * test/scenario/.
 *
 * NOTE on the zero-dependency rule (F-102 / ARCHITECTURE.md §1): the sim's
 * RUNTIME stays dependency-free — @homestead/content is a devDependency of
 * @homestead/sim used only from test code, never from src/. The ESLint
 * no-restricted-imports guard covers "packages/sim/src" files only (and the
 * root lint script scans only the packages' src directories), so this
 * test-only usage is both allowed and intentional: scenario tests exercise
 * the real shipped catalog, not a copy.
 */
import { loadContent, toSimContent } from "@homestead/content";
import type { SimContent } from "../../src/index.js";

export type {
  Command,
  MotiveName,
  ObjectId,
  PersonId,
  PersonView,
  SimContent,
  SimEvent,
  SimHandle,
  SimSnapshot,
  TraitName,
} from "../../src/index.js";
export { TICKS_PER_SIM_MINUTE, createSim } from "../../src/index.js";
export type { Scenario, ScenarioAssertion, ScenarioCommand } from "./types.js";

/**
 * Validate the shipped content catalog and map it to the sim's structural
 * input shape. toSimContent's return type is a local structural mirror in
 * @homestead/content, assignable to the sim's SimContent by design.
 */
export function loadCatalogContent(): SimContent {
  return toSimContent(loadContent());
}
