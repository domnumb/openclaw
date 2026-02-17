#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./harness/run_task.sh <TASK-ID>"
  echo "Example: ./harness/run_task.sh B-000"
  exit 1
fi

TASK="$1"
STAMP=$(date -u +%Y%m%d-%H%M)
DIR="runs/${TASK}/${STAMP}"

mkdir -p "$DIR"

# --- Create templates ---
cat > "$DIR/PLAN.md" <<'PLAN'
# PLAN

## Task ID
<!-- e.g. B-000 -->

## Objective
<!-- One sentence: what does success look like? -->

## Steps
1.
2.
3.

## Scope (paths touched)
<!-- List files/dirs this task will modify -->
PLAN

cat > "$DIR/RUNLOG.txt" <<'RUNLOG'
# RUNLOG
# Append timestamped entries as you work.
# Format: YYYY-MM-DDTHH:MM — <what you did>
RUNLOG

cat > "$DIR/SCOPE.txt" <<'SCOPE'
# SCOPE — Declare all paths this task will touch.
# Do NOT edit files outside this list.
# One path per line (globs OK):
SCOPE

touch "$DIR/PATCH.diff"
touch "$DIR/SMOKE.txt"

echo "=== Task $TASK initialized ==="
echo "Run directory: $DIR"
echo ""
echo "Next steps:"
echo "  1. Edit $DIR/PLAN.md with your plan"
echo "  2. Do the work"
echo "  3. Capture patch:   git diff > $DIR/PATCH.diff"
echo "  4. Run smoke test:  ./harness/smoke.sh | tee $DIR/SMOKE.txt"
echo "  5. On success:      echo OK > $DIR/SMOKE_OK"
echo "  6. Exfil:           ./harness/export_bundle.sh  OR  git push"
