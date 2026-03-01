/**
 * IntentScout — post.ts
 * Posts a response on Quora using Playwright via browser-tool.
 * Implements human-like behavior: random delays, not only affiliate links.
 */

import type { DraftResponse } from "./respond.js";
import type { PersonaCredentials } from "./types.js";

export type PostResult = {
  success: boolean;
  url?: string;
  error?: string;
  postedAt?: string;
};

/**
 * Posts a draft response to the Quora question.
 * Uses Playwright browser automation via the browser tool.
 *
 * @param draft - The prepared response to post
 * @param persona - Quora credentials for the persona account
 * @param browserAct - Callback that executes a Playwright action description
 */
export async function postToQuora(
  draft: DraftResponse,
  persona: PersonaCredentials,
  browserAct: (instruction: string) => Promise<string>,
): Promise<PostResult> {
  try {
    // Human-like random delay before acting (30s–3min)
    await humanDelay(30_000, 180_000);

    // Navigate to the question
    await browserAct(`Navigate to ${draft.question.url}`);
    await humanDelay(2_000, 5_000);

    // Log in if needed
    await browserAct(
      `Check if logged in to Quora. If not, log in with email "${persona.email}" and password from env QUORA_PASSWORD`,
    );
    await humanDelay(1_000, 3_000);

    // Click the answer button
    await browserAct("Click the 'Answer' button on the Quora question page");
    await humanDelay(1_500, 4_000);

    // Type the response with human-like speed
    await browserAct(`Type the following answer in the Quora editor (use realistic typing speed):
---
${draft.content}
---`);

    await humanDelay(3_000, 8_000);

    // Submit
    await browserAct("Click the 'Submit' button to post the answer");
    await humanDelay(2_000, 5_000);

    // Get the URL of the posted answer
    const postedUrl = await browserAct("Get the current page URL after posting");

    return {
      success: true,
      url: postedUrl.trim(),
      postedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Random delay between min and max milliseconds.
 */
function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
