import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-restricted-globals": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // F-102: the simulation core must stay headless and dependency-free.
    files: ["packages/sim/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["pixi.js", "pixi.js/*", "@homestead/client", "@homestead/client/*"], message: "sim must not depend on rendering or the client" }] },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "sim is headless" },
        { name: "document", message: "sim is headless" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "use the seeded Rng — determinism rule" },
        { object: "Date", property: "now", message: "use the sim Clock — determinism rule" },
      ],
    },
  },
];
