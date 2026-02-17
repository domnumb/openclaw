import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureThreadArtifact,
  createArtifact,
  getArtifactById,
  getArtefactVersion,
  iterateArtifact,
  touchUsage,
} from "./artefact-service.js";
import { closeArtefactsDb } from "./db.js";

vi.mock("../config/paths.js", () => ({
  resolveStateDir: () => process.env.OPENCLAW_ARTEFACTS_TEST_DIR ?? os.tmpdir(),
}));

describe("artefact-service", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "artefacts-mvp-"));
    process.env.OPENCLAW_ARTEFACTS_TEST_DIR = testDir;
    closeArtefactsDb();
  });

  afterEach(() => {
    delete process.env.OPENCLAW_ARTEFACTS_TEST_DIR;
    closeArtefactsDb();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("thread close creates artefact and v1 when none exist", () => {
    const result = ensureThreadArtifact("thread-1", "Hello world\n\nSome context.");
    expect(result.id).toBeDefined();
    expect(result.thread_id).toBe("thread-1");
    expect(result.title).toContain("Hello");
    const art = getArtifactById(result.id);
    expect(art).not.toBeNull();
    expect(art?.type).toBe("note");
    const v = getArtefactVersion(result.id);
    expect(v).not.toBeNull();
    expect(v?.version_no).toBe(1);
    expect(v?.content).toContain("Summary");
  });

  it("thread close returns existing artefact when one exists", () => {
    const r1 = ensureThreadArtifact("thread-2", "First");
    const r2 = ensureThreadArtifact("thread-2", "Second");
    expect(r1.id).toBe(r2.id);
  });

  it("iter creates v2 and increments version_no", () => {
    const r = ensureThreadArtifact("thread-3", "Initial");
    const iterResult = iterateArtifact(r.id, "New content here", "Updated");
    expect(iterResult.version_no).toBe(2);
    const v2 = getArtefactVersion(r.id, 2);
    expect(v2?.content).toBe("New content here");
  });

  it("touchUsage increments usage_count", () => {
    const r = ensureThreadArtifact("thread-4", "X");
    expect(getArtifactById(r.id)?.usage_count).toBe(0);
    touchUsage(r.id);
    touchUsage(r.id);
    expect(getArtifactById(r.id)?.usage_count).toBe(2);
  });
});
