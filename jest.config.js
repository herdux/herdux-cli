/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // Coverage collection is scoped to the commands layer.
  // Unit tests mock infra/engines entirely — that layer is validated by E2E tests.
  collectCoverageFrom: ["<rootDir>/src/commands/**/*.ts"],
  coverageThreshold: {
    global: { lines: 95, functions: 95, branches: 80, statements: 95 },
  },
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: true }] },
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    },
    {
      displayName: "e2e",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: true }] },
      moduleFileExtensions: ["ts", "js", "mjs", "cjs", "json", "node"],
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      testTimeout: 120_000,
    },
    {
      displayName: "integration",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: true }] },
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 10_000,
    },
  ],
};
