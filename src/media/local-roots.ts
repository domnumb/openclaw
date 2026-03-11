import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveStateDir } from "../config/paths.js";

/**
 * Resolve a path to its canonical form (following symlinks and normalizing case
 * on case-insensitive filesystems like macOS HFS+/APFS).
 * Falls back to path.resolve() if realpath fails (directory may not exist yet).
 */
function canonicalize(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function buildMediaLocalRoots(stateDir: string): string[] {
  const resolvedStateDir = canonicalize(stateDir);
  return [
    canonicalize(os.tmpdir()),
    path.join(resolvedStateDir, "media"),
    path.join(resolvedStateDir, "agents"),
    path.join(resolvedStateDir, "workspace"),
    path.join(resolvedStateDir, "sandboxes"),
  ];
}

export function getDefaultMediaLocalRoots(): readonly string[] {
  return buildMediaLocalRoots(resolveStateDir());
}

export function getAgentScopedMediaLocalRoots(
  cfg: OpenClawConfig,
  agentId?: string,
): readonly string[] {
  const roots = buildMediaLocalRoots(resolveStateDir());
  const effectiveAgentId = agentId?.trim() || resolveDefaultAgentId(cfg);
  if (!effectiveAgentId) {
    return roots;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, effectiveAgentId);
  if (!workspaceDir) {
    return roots;
  }
  const normalizedWorkspaceDir = canonicalize(workspaceDir);
  if (!roots.includes(normalizedWorkspaceDir)) {
    roots.push(normalizedWorkspaceDir);
  }
  return roots;
}
