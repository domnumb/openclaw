#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y%m%d-%H%M)
BUNDLE="bernard_bundle_${STAMP}.tgz"
TMPDIR=$(mktemp -d)

trap 'rm -rf "$TMPDIR"' EXIT

echo "=== EXPORT BUNDLE ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Collect git metadata
git status --porcelain         > "$TMPDIR/_status.txt"        2>/dev/null || true
git log --oneline --decorate -n 80 > "$TMPDIR/_log.txt"       2>/dev/null || true
git rev-parse HEAD             > "$TMPDIR/_head.txt"           2>/dev/null || true
git diff                       > "$TMPDIR/_patch.diff"         2>/dev/null || true
git diff --staged              > "$TMPDIR/_patch_staged.diff"  2>/dev/null || true

# Collect untracked files
git ls-files --others --exclude-standard > "$TMPDIR/_untracked_files.txt" 2>/dev/null || true

# Include actual untracked file contents
UNTRACKED_DIR="$TMPDIR/_untracked"
mkdir -p "$UNTRACKED_DIR"
while IFS= read -r f; do
  if [ -f "$f" ]; then
    mkdir -p "$UNTRACKED_DIR/$(dirname "$f")"
    cp "$f" "$UNTRACKED_DIR/$f" 2>/dev/null || true
  fi
done < "$TMPDIR/_untracked_files.txt"

# Create tarball
tar czf "$BUNDLE" -C "$TMPDIR" . 2>/dev/null

echo ""
echo "READY $BUNDLE"
ls -lh "$BUNDLE"
