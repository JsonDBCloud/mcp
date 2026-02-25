import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    reporters: ["verbose", "junit"],
    outputFile: { junit: "test-results.xml" },
  },
});
