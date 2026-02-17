export const ARTEFACT_TYPES = [
  "note",
  "plan",
  "spec",
  "prompt",
  "code_patch",
  "doc",
  "dataset",
  "template",
] as const;
export type ArtefactType = (typeof ARTEFACT_TYPES)[number];

export const ARTEFACT_STATUSES = ["draft", "published", "archived"] as const;
export type ArtefactStatus = (typeof ARTEFACT_STATUSES)[number];

export interface ThreadRow {
  id: string;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  meta_json: string;
}

export interface ArtefactRow {
  id: string;
  thread_id: string | null;
  type: ArtefactType;
  title: string;
  summary: string;
  status: ArtefactStatus;
  living: number;
  usage_count: number;
  created_at: number;
  updated_at: number;
}

export interface ArtefactVersionRow {
  id: string;
  artefact_id: string;
  version_no: number;
  content: string;
  diff: string | null;
  change_note: string;
  created_at: number;
}

export interface UsageMetrics {
  threads_closed: number;
  artefacts_created: number;
  pct_threads_with_artefact: number;
  avg_time_to_first_artefact_sec: number | null;
  artefact_versions_created: number;
  repeat_usage_count: number;
  living_artefacts_count: number;
}

