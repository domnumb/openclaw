/**
 * IntentScout — monitor.ts
 * Searches Quora for buying intent questions using web_search.
 */

import type { VerticalConfig } from "./types.js";

export type QuoraQuestion = {
  url: string;
  title: string;
  snippet: string;
  vertical: string;
};

/**
 * Runs web searches for each vertical query and returns raw Quora question candidates.
 * In production, this calls Bernard's web_search tool.
 */
export async function monitorQuora(
  vertical: VerticalConfig,
  webSearch: (query: string) => Promise<Array<{ url: string; title: string; snippet: string }>>,
): Promise<QuoraQuestion[]> {
  const results: QuoraQuestion[] = [];

  for (const query of vertical.searchQueries) {
    try {
      const hits = await webSearch(query);
      for (const hit of hits) {
        if (isQuoraUrl(hit.url) && !results.some((r) => r.url === hit.url)) {
          results.push({
            url: hit.url,
            title: hit.title,
            snippet: hit.snippet,
            vertical: vertical.id,
          });
        }
      }
    } catch (err) {
      console.warn(`[monitor] Search failed for query "${query}":`, err);
    }
  }

  return results;
}

function isQuoraUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.quora.com" || u.hostname === "quora.com";
  } catch {
    return false;
  }
}
