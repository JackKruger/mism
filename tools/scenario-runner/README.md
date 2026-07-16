# Scenario tests (Q-101)

Behavioral regression suite: JSON scenarios drive a headless sim and assert
outcomes with sim-time bounds (`packages/sim/test/scenario/`).

- **Add a scenario**: create `packages/sim/test/scenario/scenarios/NN_name.json`
  (schema in `test/scenario/types.ts`: seed, `useCatalog` or inline `content`,
  objects, people with need/trait overrides, optional timed `script` commands,
  assertions with `byMin` / `withinMin` / `atMin` bounds), then register it in
  `packages/sim/test/scenario.test.ts` (one import + one list entry).
- **Run all**: `pnpm --filter @homestead/sim test`
- **Run one**: `pnpm --filter @homestead/sim test -- -t "<scenario name>"`
