/**
 * IntentScout — respond.ts
 * Generates a genuine, helpful response with an affiliate link for a qualified question.
 */

import type { QualifiedQuestion } from "./qualify.js";
import type { VerticalConfig } from "./types.js";

export type DraftResponse = {
  question: QualifiedQuestion;
  content: string;
  affiliateUrl: string;
  vertical: string;
};

export type ProductSuggestion = {
  name: string;
  asin: string;
  pitch: string;
};

/**
 * Builds the affiliate URL for an Amazon product.
 */
export function buildAffiliateUrl(asin: string, affiliateTag: string, baseUrl: string): string {
  return `${baseUrl}/dp/${asin}?tag=${affiliateTag}`;
}

/**
 * Generates a response draft for a qualified question.
 * In production, the `generateSuggestion` callback calls Bernard/Claude to pick the right product.
 */
export async function generateDraft(
  question: QualifiedQuestion,
  vertical: VerticalConfig,
  generateSuggestion: (
    question: QualifiedQuestion,
    vertical: VerticalConfig,
  ) => Promise<ProductSuggestion>,
): Promise<DraftResponse> {
  const suggestion = await generateSuggestion(question, vertical);
  const affiliateUrl = buildAffiliateUrl(suggestion.asin, vertical.affiliateTag, vertical.baseUrl);

  const content = vertical.responseTemplate
    .replace("{PRODUCT_NAME}", suggestion.name)
    .replace("{PRODUCT_PITCH}", suggestion.pitch)
    .replace("{AFFILIATE_LINK}", affiliateUrl)
    .replace("{DISCLOSURE}", vertical.disclosure);

  return {
    question,
    content,
    affiliateUrl,
    vertical: vertical.id,
  };
}

/**
 * Default product suggester — uses Claude via the provided LLM callback.
 */
export async function suggestProductWithLLM(
  question: QualifiedQuestion,
  vertical: VerticalConfig,
  llm: (prompt: string) => Promise<string>,
): Promise<ProductSuggestion> {
  const prompt = `
You are an affiliate marketing expert. A user on Quora asked:

Title: "${question.title}"
Context: "${question.snippet}"
Category: ${question.detectedCategory ?? "general"}
Vertical: ${vertical.name}

Suggest ONE specific product that genuinely answers this question.
Reply in JSON format only:
{
  "name": "Product Name",
  "asin": "B0XXXXXXXXX",
  "pitch": "One sentence explaining why this product is perfect for them"
}
`.trim();

  const raw = await llm(prompt);

  try {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) {
      throw new Error("No JSON found in LLM response");
    }
    return JSON.parse(match[0]) as ProductSuggestion;
  } catch {
    throw new Error(`Failed to parse product suggestion from LLM: ${raw}`);
  }
}
