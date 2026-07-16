import { describe, it } from "vitest";
import { parseScenario } from "./scenario/runner.js";
import { runScenario } from "./scenario/runner.js";

// Scenario JSON files are imported statically (resolveJsonModule) instead of
// fs.readdir so the suite typechecks without @types/node in the sim package.
// Adding a scenario = drop the JSON in test/scenario/scenarios/ + one entry here.
import s01 from "./scenario/scenarios/01_hungry_fridge.json";
import s02 from "./scenario/scenarios/02_bladder_toilet.json";
import s03 from "./scenario/scenarios/03_tired_bed.json";
import s04 from "./scenario/scenarios/04_dirty_shower.json";
import s05 from "./scenario/scenarios/05_bored_tv.json";
import s06 from "./scenario/scenarios/06_furnished_24h_survival.json";
import s07 from "./scenario/scenarios/07_empty_lot_bladder_accident.json";
import s08 from "./scenario/scenarios/08_empty_lot_pass_out.json";
import s09 from "./scenario/scenarios/09_unreachable_fridge.json";
import s10 from "./scenario/scenarios/10_two_person_24h_survival.json";

const SCENARIOS: ReadonlyArray<[path: string, raw: unknown]> = [
  ["scenarios/01_hungry_fridge.json", s01],
  ["scenarios/02_bladder_toilet.json", s02],
  ["scenarios/03_tired_bed.json", s03],
  ["scenarios/04_dirty_shower.json", s04],
  ["scenarios/05_bored_tv.json", s05],
  ["scenarios/06_furnished_24h_survival.json", s06],
  ["scenarios/07_empty_lot_bladder_accident.json", s07],
  ["scenarios/08_empty_lot_pass_out.json", s08],
  ["scenarios/09_unreachable_fridge.json", s09],
  ["scenarios/10_two_person_24h_survival.json", s10],
];

describe("scenario suite (Q-101)", () => {
  for (const [path, raw] of SCENARIOS) {
    const scenario = parseScenario(raw, path);
    it(scenario.name, () => {
      runScenario(scenario);
    });
  }
});
