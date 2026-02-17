import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "../config/paths.js";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { runMigrations } from "./schema.js";

const DB_FILENAME = "artefacts.sqlite";

let cachedDb: DatabaseSync | null = null;

export function getArtefactsDbPath(): string {
  return path.join(resolveStateDir(), DB_FILENAME);
}

export function openArtefactsDb(): DatabaseSync {
  if (cachedDb) {
    return cachedDb;
  }
  const { DatabaseSync } = requireNodeSqlite();
  const dbPath = getArtefactsDbPath();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  runMigrations(db);
  cachedDb = db;
  return db;
}

export function closeArtefactsDb(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      // ignore
    }
    cachedDb = null;
  }
}
