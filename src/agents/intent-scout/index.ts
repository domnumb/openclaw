/**
 * IntentScout — index.ts
 *
 * Affiliate agent spawned by Bernard.
 * Pipeline: monitor → qualify → respond → (review) → post
 *
 * Sprint 0: No posting yet, output drafts for Maël validation.
 * Sprint 2+: Automated posting via post.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VerticalConfig, PersonaCredentials, RunReport } from "./types.js";
import { monitorQuora } from "./monitor.js";
import { postToQuora } from "./post.js";
import { qualifyAll } from "./qualify.js";
import { generateDraft, suggestProductWithLLM } from "./respond.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type IntentScoutConfig = {
  verticalId: string;
  autoPost: boolean;
  personaPath?: string;
};

export type IntentScoutDeps = {
  webSearch: (query: string) => Promise<Array<{ url: string; title: string; snippet: string }>>;
  llm: (prompt: string) => Promise<string>;
  browserAct?: (instruction: string) => Promise<string>;
  notifyDraft?: (draft: { question: string; url: string; content: string }) => Promise<void>;
};

/**
 * Main entry point for IntentScout.
 * Bernard calls this with the appropriate dependencies injected.
 */
export async function runIntentScout(
  config: IntentScoutConfig,
  deps: IntentScoutDeps,
): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // Load vertical config
  const verticalPath = path.join(__dirname, "config", "verticals", `${config.verticalId}.json`);

  if (!fs.existsSync(verticalPath)) {
    throw new Error(`Vertical config not found: ${verticalPath}`);
  }

  const vertical: VerticalConfig = JSON.parse(fs.readFileSync(verticalPath, "utf-8"));

  // Load persona credentials (if posting)
  let persona: PersonaCredentials | null = null;
  if (config.autoPost) {
    const personaPath =
      config.personaPath ??
      path.join(process.env.HOME ?? "~", ".openclaw", "intent-scout", "persona.json");
    if (!fs.existsSync(personaPath)) {
      throw new Error(`Persona credentials not found: ${personaPath}. Run Sprint 0 first.`);
    }
    persona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
  }

  console.log(
    `[IntentScout] Starting run — vertical: ${vertical.name}, autoPost: ${config.autoPost}`,
  );

  // Step 1: Monitor — find Quora questions
  const questions = await monitorQuora(vertical, deps.webSearch);
  console.log(`[IntentScout] Found ${questions.length} candidate questions`);

  // Step 2: Qualify — score and filter
  const qualified = qualifyAll(questions, vertical);
  console.log(
    `[IntentScout] Qualified ${qualified.length} questions (score >= ${vertical.minScore})`,
  );

  // Step 3: Generate drafts
  const drafts = [];
  for (const question of qualified.slice(0, 5)) {
    // max 5 per run
    try {
      const draft = await generateDraft(question, vertical, (q, v) =>
        suggestProductWithLLM(q, v, deps.llm),
      );
      drafts.push(draft);
    } catch (err) {
      const msg = `Failed to generate draft for "${question.title}": ${String(err)}`;
      console.warn(`[IntentScout] ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`[IntentScout] Generated ${drafts.length} drafts`);

  // Step 4a: Notify Maël for review (Sprint 1)
  if (deps.notifyDraft) {
    for (const draft of drafts) {
      await deps.notifyDraft({
        question: draft.question.title,
        url: draft.question.url,
        content: draft.content,
      });
    }
  }

  // Step 4b: Auto-post (Sprint 2+)
  let postsPublished = 0;
  if (config.autoPost && deps.browserAct && persona) {
    for (const draft of drafts) {
      const result = await postToQuora(draft, persona, deps.browserAct);
      if (result.success) {
        postsPublished++;
        console.log(`[IntentScout] Posted: ${result.url}`);
      } else {
        const msg = `Failed to post "${draft.question.title}": ${result.error}`;
        console.error(`[IntentScout] ${msg}`);
        errors.push(msg);
      }
    }
  }

  const report: RunReport = {
    vertical: vertical.id,
    questionsFound: questions.length,
    questionsQualified: qualified.length,
    draftsGenerated: drafts.length,
    postsPublished,
    errors,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  console.log(`[IntentScout] Run complete:`, report);
  return report;
}
