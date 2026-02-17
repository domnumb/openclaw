import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureThreadArtifact } from "./artefact-service.js";
import { closeArtefactsDb } from "./db.js";
import {
  computeMetricsForPeriod,
  computeSuccessScoreFromMetrics,
  runReviewToday,
} from "./metrics-service.js";

vi.mock("../config/paths.js", () => ({
  resolveStateDir: () => process.env.OPENCLAW_ARTEFACTS_TEST_DIR ?? os.tmpdir(),
}));

describe("metrics-service", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "artefacts-metrics-"));
    process.env.OPENCLAW_ARTEFACTS_TEST_DIR = testDir;
    closeArtefactsDb();
  });

  afterEach(() => {
    delete process.env.OPENCLAW_ARTEFACTS_TEST_DIR;
    closeArtefactsDb();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("review today creates daily review artefact and returns score", () => {
    const { metrics, scoreResult, reviewArtefactId } = runReviewToday(7);
    expect(reviewArtefactId).toBeDefined();
    expect(metrics).toHaveProperty("threads_closed");
    expect(metrics).toHaveProperty("pct_threads_with_artefact");
    expect(scoreResult).toHaveProperty("score");
    expect(scoreResult).toHaveProperty("diagnosis");
    expect(scoreResult.score).toBeGreaterThanOrEqual(0);
    expect(scoreResult.score).toBeLessThanOrEqual(100);
  });

  it("score formula correctness on fixed dataset", () => {
    const metrics = {
      threads_closed: 10,
      artefacts_created: 10,
      pct_threads_with_artefact: 100,
      avg_time_to_first_artefact_sec: 60,
      artefact_versions_created: 15,
      repeat_usage_count: 3,
      living_artefacts_count: 2,
    };
    const result = computeSuccessScoreFromMetrics(metrics);
    expect(result.A).toBe(100);
    expect(result.V).toBe(30);
    expect(result.R).toBe(30);
    expect(result.L).toBe(20);
    expect(result.T).toBe(90);
    expect(result.score).toBeCloseTo(0.35 * 100 + 0.15 * 30 + 0.2 * 30 + 0.1 * 20 + 0.2 * 90);
  });
});
