/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
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
    }
  ],
};
