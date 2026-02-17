#!/usr/bin/env bash
set -euo pipefail

echo "=== SMOKE TEST ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Branch:    $(git branch --show-current 2>/dev/null || echo 'detached')"
echo "HEAD:      $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
echo ""

FAIL=0
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout 60"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout 60"
fi

run_with_timeout() {
  if [ -n "$TIMEOUT_CMD" ]; then
    $TIMEOUT_CMD "$@"
  else
    "$@"
  fi
}

# --- Node stack ---
if [ -f package.json ]; then
  echo "[node] package.json found"
  PM="npm"
  if [ -f pnpm-lock.yaml ] && command -v pnpm &>/dev/null; then PM="pnpm"; fi

  if grep -q '"build"' package.json 2>/dev/null; then
    echo "[node] running $PM run build..."
    if ! run_with_timeout $PM run build --if-present 2>&1; then
      echo "[node] BUILD FAILED"
      FAIL=1
    fi
  else
    echo "[node] no build script — skip"
  fi

  if grep -q '"test"' package.json 2>/dev/null; then
    echo "[node] running $PM test..."
    if ! run_with_timeout $PM test 2>&1; then
      echo "[node] TEST FAILED"
      FAIL=1
    fi
  else
    echo "[node] no test script — skip"
  fi
else
  echo "[node] no package.json — skip"
fi

# --- Python stack ---
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  echo "[python] python config found"
  if command -v pytest &>/dev/null; then
    echo "[python] running pytest -q..."
    if ! run_with_timeout pytest -q 2>&1; then
      echo "[python] PYTEST FAILED"
      FAIL=1
    fi
  else
    echo "[python] pytest not found — skip"
  fi
else
  echo "[python] no python config — skip"
fi

# --- Result ---
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SMOKE_OK"
  exit 0
else
  echo "SMOKE_FAIL"
  exit 1
fi
