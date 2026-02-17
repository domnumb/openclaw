import type { UsageMetrics } from "./types.js";

export interface SuccessScoreResult {
  score: number;
  A: number;
  V: number;
  R: number;
  L: number;
  T: number;
  diagnosis: string[];
}

export function computeSuccessScore(metrics: UsageMetrics): SuccessScoreResult {
  const A = metrics.pct_threads_with_artefact;
  const V = Math.min(
    100,
    (20 * metrics.artefact_versions_created) / Math.max(1, metrics.threads_closed),
  );
  const R = Math.min(
    100,
    (100 * metrics.repeat_usage_count) / Math.max(1, metrics.artefacts_created),
  );
  const L = Math.min(
    100,
    (100 * metrics.living_artefacts_count) / Math.max(1, metrics.artefacts_created),
  );
  const T =
    metrics.avg_time_to_first_artefact_sec != null
      ? Math.max(0, Math.min(100, 100 - (metrics.avg_time_to_first_artefact_sec / 600) * 100))
      : 50;

  const score =
    0.35 * A + 0.15 * V + 0.2 * R + 0.1 * L + 0.2 * T;

  const diagnosis: string[] = [];
  if (A < 95) diagnosis.push("habit loop broken");
  if (R < 20) diagnosis.push("artefacts not reused");
  if (V < 10) diagnosis.push("no iteration");
  if (T < 50 && metrics.avg_time_to_first_artefact_sec != null)
    diagnosis.push("too slow to first value");

  return { score, A, V, R, L, T, diagnosis };
}
