/**
 * IntentScout — qualify.ts
 * Scores a Quora question for purchase intent (0–10).
 * Score >= 8 = strong buy intent, worth responding to.
 */

import type { QuoraQuestion } from "./monitor.js";
import type { VerticalConfig } from "./types.js";

export type QualifiedQuestion = QuoraQuestion & {
  score: number;
  matchedSignals: string[];
  detectedCategory: string | null;
};

/**
 * Scores a question for purchase intent.
 * Returns null if score < vertical.minScore (below threshold).
 */
export function qualify(
  question: QuoraQuestion,
  vertical: VerticalConfig,
): QualifiedQuestion | null {
  const text = `${question.title} ${question.snippet}`.toLowerCase();
  const matchedSignals: string[] = [];

  let score = 0;

  // Check buy intent signals
  for (const signal of vertical.buyIntentSignals) {
    if (text.includes(signal.toLowerCase())) {
      matchedSignals.push(signal);
      score += 1;
    }
  }

  // Bonus: question mark = genuine question
  if (question.title.includes("?")) {
    score += 1;
  }

  // Bonus: multiple signals = stronger intent
  if (matchedSignals.length >= 3) {
    score += 1;
  }

  // Cap at 10
  score = Math.min(score, 10);

  // Detect category
  const detectedCategory = detectCategory(text, vertical);

  if (score < vertical.minScore) {
    return null;
  }

  return {
    ...question,
    score,
    matchedSignals,
    detectedCategory,
  };
}

/**
 * Scores all questions and returns only those above threshold, sorted by score.
 */
export function qualifyAll(
  questions: QuoraQuestion[],
  vertical: VerticalConfig,
): QualifiedQuestion[] {
  const qualified = questions
    .map((q) => qualify(q, vertical))
    .filter((q): q is QualifiedQuestion => q !== null);

  return qualified.toSorted((a, b) => b.score - a.score);
}

function detectCategory(text: string, vertical: VerticalConfig): string | null {
  for (const cat of vertical.categories) {
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return cat.id;
      }
    }
  }
  return null;
}
