import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { defaultRuntime } from "../runtime.js";
import { ensureThreadArtifact } from "../artefacts/artefact-service.js";
import {
  getArtifactById,
  getArtefactVersion,
  iterateArtifact,
} from "../artefacts/artefact-service.js";
import { runReviewToday } from "../artefacts/metrics-service.js";

export function registerThreadCli(program: Command) {
  const thread = program
    .command("thread")
    .description("Thread commands (artefacts MVP)");

  thread
    .command("close <threadId>")
    .description("Close a thread and ensure it has at least one artefact")
    .option("--messages-file <path>", "Path to file containing thread messages text")
    .option("--title <title>", "Optional thread title")
    .action((threadId: string, opts: { messagesFile?: string; title?: string }) => {
      const messagesPath = opts.messagesFile?.trim();
      if (!messagesPath) {
        defaultRuntime.error("Missing --messages-file");
        defaultRuntime.exit(1);
      }
      const absPath = path.resolve(messagesPath);
      if (!fs.existsSync(absPath)) {
        defaultRuntime.error(`File not found: ${absPath}`);
        defaultRuntime.exit(1);
      }
      const messagesText = fs.readFileSync(absPath, "utf-8");
      const result = ensureThreadArtifact(
        threadId,
        messagesText,
        opts.title ?? null,
      );
      defaultRuntime.log(`artefact_id=${result.id}`);
      defaultRuntime.log(`title=${result.title}`);
    });
}

export function registerArtefactCli(program: Command) {
  const artefact = program
    .command("artefact")
    .description("Artefact commands (artefacts MVP)");

  artefact
    .command("show <artefactId>")
    .description("Show an artefact (latest or specific version)")
    .option("--version <N>", "Version number (default: latest)")
    .option("--json", "Output as JSON")
    .action((artefactId: string, opts: { version?: string; json?: boolean }) => {
      const art = getArtifactById(artefactId);
      if (!art) {
        defaultRuntime.error(`Artefact not found: ${artefactId}`);
        defaultRuntime.exit(1);
      }
      const versionNo = opts.version ? parseInt(opts.version, 10) : undefined;
      const ver = getArtefactVersion(artefactId, versionNo);
      if (!ver) {
        defaultRuntime.error(`Version not found for artefact ${artefactId}`);
        defaultRuntime.exit(1);
      }
      if (opts.json) {
        defaultRuntime.log(
          JSON.stringify(
            {
              id: art.id,
              thread_id: art.thread_id,
              type: art.type,
              title: art.title,
              summary: art.summary,
              status: art.status,
              usage_count: art.usage_count,
              version_no: ver.version_no,
              content: ver.content,
              created_at: ver.created_at,
              change_note: ver.change_note,
            },
            null,
            2,
          ),
        );
        return;
      }
      defaultRuntime.log(`# ${art.title} (v${ver.version_no})`);
      defaultRuntime.log(ver.content);
    });

  artefact
    .command("iter <artefactId>")
    .description("Create a new version of an artefact")
    .requiredOption("--content-file <path>", "Path to new content file")
    .requiredOption("--note <text>", "Change note for this version")
    .action((artefactId: string, opts: { contentFile: string; note: string }) => {
      const absPath = path.resolve(opts.contentFile);
      if (!fs.existsSync(absPath)) {
        defaultRuntime.error(`File not found: ${absPath}`);
        defaultRuntime.exit(1);
      }
      const newContent = fs.readFileSync(absPath, "utf-8");
      const result = iterateArtifact(artefactId, newContent, opts.note);
      defaultRuntime.log(`version_no=${result.version_no}`);
    });
}

export function registerReviewCli(program: Command) {
  const review = program
    .command("review")
    .description("Review commands (artefacts MVP)");

  review
    .command("today")
    .description("Generate daily review artefact and print metrics + success score")
    .option("--days <n>", "Metrics period in days", "7")
    .option("--json", "Output metrics and score as JSON")
    .action((opts: { days?: string; json?: boolean }) => {
      const days = Math.max(1, parseInt(opts.days ?? "7", 10) || 7);
      const { metrics, scoreResult, reviewArtefactId } = runReviewToday(days);
      if (opts.json) {
        defaultRuntime.log(
          JSON.stringify(
            {
              metrics: {
                threads_closed: metrics.threads_closed,
                artefacts_created: metrics.artefacts_created,
                pct_threads_with_artefact: metrics.pct_threads_with_artefact,
                avg_time_to_first_artefact_sec: metrics.avg_time_to_first_artefact_sec,
                artefact_versions_created: metrics.artefact_versions_created,
                repeat_usage_count: metrics.repeat_usage_count,
                living_artefacts_count: metrics.living_artefacts_count,
              },
              success_score: scoreResult.score,
              success_score_components: {
                A: scoreResult.A,
                V: scoreResult.V,
                R: scoreResult.R,
                L: scoreResult.L,
                T: scoreResult.T,
              },
              diagnosis: scoreResult.diagnosis,
              review_artefact_id: reviewArtefactId,
            },
            null,
            2,
          ),
        );
        return;
      }
      defaultRuntime.log(`Review artefact: ${reviewArtefactId}`);
      defaultRuntime.log(`Success Score: ${scoreResult.score.toFixed(1)}/100`);
      if (scoreResult.diagnosis.length > 0) {
        defaultRuntime.log(`Diagnosis: ${scoreResult.diagnosis.join("; ")}`);
      }
    });
}
