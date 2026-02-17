import type { UsageMetrics } from "./types.js";
import { openArtefactsDb } from "./db.js";
import { computeSuccessScore } from "./success-score.js";
import type { SuccessScoreResult } from "./success-score.js";
import {
  createArtifact,
  iterateArtifact,
  getArtifactById,
} from "./artefact-service.js";

export function computeMetricsForPeriod(days: number): UsageMetrics {
  const db = openArtefactsDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const threadsClosed =
    (db
      .prepare(
        "SELECT COUNT(*) as c FROM threads WHERE ended_at IS NOT NULL AND ended_at >= ?",
      )
      .get(since) as { c: number })?.c ?? 0;

  const artefactsCreated =
    (db.prepare("SELECT COUNT(*) as c FROM artefacts WHERE created_at >= ?").get(since) as {
      c: number;
    })?.c ?? 0;

  const threadsWithArtefact =
    (db
      .prepare(
        `SELECT COUNT(DISTINCT t.id) as c FROM threads t
         INNER JOIN artefacts a ON a.thread_id = t.id
         WHERE t.ended_at IS NOT NULL AND t.ended_at >= ?`,
      )
      .get(since) as { c: number })?.c ?? 0;

  const pct_threads_with_artefact =
    threadsClosed > 0 ? (100 * threadsWithArtefact) / threadsClosed : 100;

  let avg_time_to_first_artefact_sec: number | null = null;
  const firstArtifactRows = db
    .prepare(
      `SELECT t.started_at as started, MIN(a.created_at) as first_at
       FROM threads t
       INNER JOIN artefacts a ON a.thread_id = t.id
       WHERE t.ended_at IS NOT NULL AND t.ended_at >= ?
       GROUP BY t.id`,
    )
    .all(since) as Array<{ started: number; first_at: number }>;
  if (firstArtifactRows.length > 0) {
    const sum = firstArtifactRows.reduce(
      (acc, r) => acc + Math.max(0, (r.first_at - r.started) / 1000),
      0,
    );
    avg_time_to_first_artefact_sec = sum / firstArtifactRows.length;
  }

  const artefactVersionsCreated =
    (db
      .prepare(
        "SELECT COUNT(*) as c FROM artefact_versions WHERE created_at >= ?",
      )
      .get(since) as { c: number })?.c ?? 0;

  const repeatUsageCount =
    (db
      .prepare(
        "SELECT COUNT(*) as c FROM artefacts WHERE usage_count > 1 AND created_at >= ?",
      )
      .get(since) as { c: number })?.c ?? 0;

  const livingArtefactsCount =
    (db
      .prepare("SELECT COUNT(*) as c FROM artefacts WHERE living = 1 AND created_at >= ?")
      .get(since) as { c: number })?.c ?? 0;

  return {
    threads_closed: threadsClosed,
    artefacts_created: artefactsCreated,
    pct_threads_with_artefact,
    avg_time_to_first_artefact_sec,
    artefact_versions_created: artefactVersionsCreated,
    repeat_usage_count: repeatUsageCount,
    living_artefacts_count: livingArtefactsCount,
  };
}

export function computeSuccessScoreFromMetrics(metrics: UsageMetrics): SuccessScoreResult {
  return computeSuccessScore(metrics);
}

export function runReviewToday(days: number): {
  metrics: UsageMetrics;
  scoreResult: SuccessScoreResult;
  reviewArtefactId: string;
} {
  const metrics = computeMetricsForPeriod(days);
  const scoreResult = computeSuccessScore(metrics);
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = `Daily Review ${dateStr}`;
  const content = [
    `# ${title}`,
    "",
    "## Metrics",
    `- threads_closed: ${metrics.threads_closed}`,
    `- artefacts_created: ${metrics.artefacts_created}`,
    `- pct_threads_with_artefact: ${metrics.pct_threads_with_artefact.toFixed(1)}%`,
    `- artefact_versions_created: ${metrics.artefact_versions_created}`,
    `- repeat_usage_count: ${metrics.repeat_usage_count}`,
    `- living_artefacts_count: ${metrics.living_artefacts_count}`,
    metrics.avg_time_to_first_artefact_sec != null
      ? `- avg_time_to_first_artefact_sec: ${metrics.avg_time_to_first_artefact_sec.toFixed(1)}`
      : "",
    "",
    "## Success Score",
    `Score: ${scoreResult.score.toFixed(1)}/100`,
    `(A=${scoreResult.A.toFixed(0)} V=${scoreResult.V.toFixed(0)} R=${scoreResult.R.toFixed(0)} L=${scoreResult.L.toFixed(0)} T=${scoreResult.T.toFixed(0)})`,
    "",
    scoreResult.diagnosis.length > 0
      ? `Diagnosis: ${scoreResult.diagnosis.join("; ")}`
      : "No diagnosis.",
  ]
    .filter(Boolean)
    .join("\n");

  const db = openArtefactsDb();
  const existing = db
    .prepare(
      "SELECT id FROM artefacts WHERE type = 'note' AND title = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(title) as { id: string } | undefined;

  let reviewArtefactId: string;
  if (existing) {
    iterateArtifact(existing.id, content, `Review update ${dateStr}`);
    reviewArtefactId = existing.id;
  } else {
    const art = createArtifact({
      threadId: null,
      type: "note",
      title,
      summary: `Daily review metrics and success score for ${dateStr}`,
      content,
      living: false,
    });
    reviewArtefactId = art.id;
  }

  return { metrics, scoreResult, reviewArtefactId };
}
