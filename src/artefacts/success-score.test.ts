import { describe, expect, it } from "vitest";
import { computeSuccessScore } from "./success-score.js";

describe("success-score", () => {
  it("diagnosis when A < 95", () => {
    const r = computeSuccessScore({
      threads_closed: 10,
      artefacts_created: 5,
      pct_threads_with_artefact: 50,
      avg_time_to_first_artefact_sec: null,
      artefact_versions_created: 0,
      repeat_usage_count: 0,
      living_artefacts_count: 0,
    });
    expect(r.diagnosis).toContain("habit loop broken");
  });

  it("diagnosis when R < 20", () => {
    const r = computeSuccessScore({
      threads_closed: 10,
      artefacts_created: 10,
      pct_threads_with_artefact: 100,
      avg_time_to_first_artefact_sec: null,
      artefact_versions_created: 20,
      repeat_usage_count: 1,
      living_artefacts_count: 5,
    });
    expect(r.diagnosis).toContain("artefacts not reused");
  });

  it("diagnosis when V < 10", () => {
    const r = computeSuccessScore({
      threads_closed: 10,
      artefacts_created: 10,
      pct_threads_with_artefact: 100,
      avg_time_to_first_artefact_sec: null,
      artefact_versions_created: 2,
      repeat_usage_count: 5,
      living_artefacts_count: 5,
    });
    expect(r.diagnosis).toContain("no iteration");
  });
});
