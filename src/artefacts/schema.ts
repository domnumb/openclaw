import type { DatabaseSync } from "node:sqlite";

const MIGRATION_TABLE = "artefacts_schema_version";
const CURRENT_VERSION = 1;

export function getArtefactsSchemaVersion(db: DatabaseSync): number {
  try {
    const row = db.prepare(`SELECT value FROM ${MIGRATION_TABLE} WHERE key = 'version'`).get() as
      | { value: number }
      | undefined;
    return row?.value ?? 0;
  } catch {
    return 0;
  }
}

function setSchemaVersion(db: DatabaseSync, version: number): void {
  db.prepare(`INSERT OR REPLACE INTO ${MIGRATION_TABLE} (key, value) VALUES ('version', ?)`).run(
    String(version),
  );
}

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const existing = getArtefactsSchemaVersion(db);
  if (existing === 0) {
    db.exec(`INSERT OR REPLACE INTO ${MIGRATION_TABLE} (key, value) VALUES ('version', '0')`);
  }

  if (getArtefactsSchemaVersion(db) < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        meta_json TEXT NOT NULL DEFAULT '{}'
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS artefacts (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('note','plan','spec','prompt','code_patch','doc','dataset','template')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
        living INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS artefact_versions (
        id TEXT PRIMARY KEY,
        artefact_id TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        content TEXT NOT NULL,
        diff TEXT,
        change_note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (artefact_id) REFERENCES artefacts(id),
        UNIQUE(artefact_id, version_no)
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_artefacts_thread_id ON artefacts(thread_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_artefacts_type ON artefacts(type);`);
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_artefact_versions_artefact_version ON artefact_versions(artefact_id, version_no);`,
    );
    setSchemaVersion(db, 1);
  }
}
