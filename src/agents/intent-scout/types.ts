/**
 * IntentScout — shared types
 */

export type VerticalConfig = {
  id: string;
  name: string;
  platform: string;
  affiliateTag: string;
  baseUrl: string;
  disclosure: string;
  minScore: number;
  searchQueries: string[];
  buyIntentSignals: string[];
  categories: Array<{
    id: string;
    keywords: string[];
    searchSuffix: string;
  }>;
  responseTemplate: string;
};

export type PersonaCredentials = {
  email: string;
  quoraUsername: string;
  amazonAssociatesTag: string;
};

export type RunReport = {
  vertical: string;
  questionsFound: number;
  questionsQualified: number;
  draftsGenerated: number;
  postsPublished: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
};
