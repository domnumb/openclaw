import { randomUUID } from "node:crypto";
import type { ArtefactRow, ArtefactType } from "./types.js";
import { openArtefactsDb } from "./db.js";

function now(): number {
  return Date.now();
}

function firstMeaningfulLine(text: string): string {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 2 && line.length < 120) {
      return line.slice(0, 80);
    }
  }
  return lines[0]?.slice(0, 80) ?? "";
}

function heuristicSummary(messagesText: string): string {
  const lines = messagesText.split(/\r?\n/).filter((s) => s.trim().length > 0);
  const bullets = lines.slice(0, 8).map((l) => `- ${l.trim().slice(0, 200)}`);
  return bullets.join("\n") || "No summary extracted.";
}

function simpleDiff(oldContent: string, newContent: string): string {
  const a = oldContent.split(/\r?\n/);
  const b = newContent.split(/\r?\n/);
  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (j < b.length && (i >= a.length || a[i] !== b[j])) {
      lines.push(`+ ${b[j] ?? ""}`);
      j++;
      continue;
    }
    if (i < a.length) {
      lines.push(`- ${a[i] ?? ""}`);
      i++;
    }
  }
  return lines.join("\n");
}

export interface EnsureThreadArtefactResult {
  id: string;
  title: string;
  thread_id: string;
}

export function ensureThreadArtifact(
  threadId: string,
  messagesText: string,
  threadTitle?: string | null,
): EnsureThreadArtefactResult {
  const db = openArtefactsDb();

  const existing = db
    .prepare("SELECT id, title FROM artefacts WHERE thread_id = ? LIMIT 1")
    .get(threadId) as { id: string; title: string } | undefined;
  if (existing) {
    return { id: existing.id, title: existing.title, thread_id: threadId };
  }

  const title =
    threadTitle?.trim() || firstMeaningfulLine(messagesText) || `Thread ${threadId} summary`;
  const summary = heuristicSummary(messagesText);
  const content = `# Summary\n\n${summary}`;
  const artefactId = randomUUID();
  const t = now();

  db.prepare(
    "INSERT INTO threads (id, title, started_at, ended_at, meta_json) VALUES (?, ?, ?, ?, ?)",
  ).run(threadId, title, t, t, "{}");

  db.prepare(
    `INSERT INTO artefacts (id, thread_id, type, title, summary, status, living, usage_count, created_at, updated_at)
     VALUES (?, ?, 'note', ?, ?, 'draft', 0, 0, ?, ?)`,
  ).run(artefactId, threadId, title, summary, t, t);

  db.prepare(
    `INSERT INTO artefact_versions (id, artefact_id, version_no, content, diff, change_note, created_at)
     VALUES (?, ?, 1, ?, NULL, 'Initial version', ?)`,
  ).run(randomUUID(), artefactId, content, t);

  return { id: artefactId, title, thread_id: threadId };
}

export function createArtifact(params: {
  threadId: string | null;
  type: ArtefactType;
  title: string;
  summary: string;
  content: string;
  living?: boolean;
}): ArtefactRow {
  const db = openArtefactsDb();
  const id = randomUUID();
  const t = now();
  db.prepare(
    `INSERT INTO artefacts (id, thread_id, type, title, summary, status, living, usage_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, 0, ?, ?)`,
  ).run(
    id,
    params.threadId,
    params.type,
    params.title,
    params.summary,
    params.living ? 1 : 0,
    t,
    t,
  );
  db.prepare(
    `INSERT INTO artefact_versions (id, artefact_id, version_no, content, diff, change_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), id, 1, params.content, null, "Initial", t);
  return getArtifactById(id) as ArtefactRow;
}

export function getArtifactById(id: string): ArtefactRow | null {
  const db = openArtefactsDb();
  const row = db.prepare("SELECT * FROM artefacts WHERE id = ?").get(id) as ArtefactRow | undefined;
  if (!row) return null;
  return row;
}

export function getArtefactVersion(artefactId: string, versionNo?: number): {
  content: string;
  version_no: number;
  created_at: number;
  change_note: string;
} | null {
  const db = openArtefactsDb();
  const v = versionNo ?? db.prepare("SELECT MAX(version_no) as m FROM artefact_versions WHERE artefact_id = ?").get(artefactId) as { m: number };
  const ver = versionNo ?? (v as { m: number })?.m;
  if (ver == null) return null;
  const row = db
    .prepare(
      "SELECT content, version_no, created_at, change_note FROM artefact_versions WHERE artefact_id = ? AND version_no = ?",
    )
    .get(artefactId, ver) as
    | { content: string; version_no: number; created_at: number; change_note: string }
    | undefined;
  return row ?? null;
}

export function iterateArtifact(
  artefactId: string,
  newContent: string,
  changeNote: string,
): { version_no: number } {
  const db = openArtefactsDb();
  const prev = db
    .prepare(
      "SELECT version_no, content FROM artefact_versions WHERE artefact_id = ? ORDER BY version_no DESC LIMIT 1",
    )
    .get(artefactId) as { version_no: number; content: string } | undefined;
  if (!prev) throw new Error(`Artefact not found: ${artefactId}`);
  const versionNo = prev.version_no + 1;
  const diff = simpleDiff(prev.content, newContent);
  const t = now();
  db.prepare(
    `INSERT INTO artefact_versions (id, artefact_id, version_no, content, diff, change_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), artefactId, versionNo, newContent, diff, changeNote, t);
  db.prepare("UPDATE artefacts SET updated_at = ? WHERE id = ?").run(t, artefactId);
  return { version_no: versionNo };
}

export function touchUsage(artefactId: string): void {
  const db = openArtefactsDb();
  db.prepare("UPDATE artefacts SET usage_count = usage_count + 1 WHERE id = ?").run(artefactId);
}
