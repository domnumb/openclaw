/**
 * D4 — Vitest config for Bernard kernel unit tests.
 * Run: npx vitest run --config vitest.kernel.config.ts
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["../workspace/bernard-kernel/__tests__/**/*.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
  },
});
