# Artefacts MVP — Thread → Artefact + Success Score

Minimal MVP to prove the habit loop: **every thread produces at least one artefact**, with **versioning**, and a **Product Success Score** from real usage metrics.

## Schema

### Tables

**threads**
- `id` (TEXT PK)
- `title` (TEXT nullable)
- `started_at` (INTEGER)
- `ended_at` (INTEGER nullable)
- `meta_json` (TEXT)

**artefacts**
- `id` (TEXT PK)
- `thread_id` (TEXT nullable, FK → threads.id)
- `type` (TEXT: note|plan|spec|prompt|code_patch|doc|dataset|template)
- `title`, `summary`, `status` (draft|published|archived)
- `living` (INTEGER 0/1), `usage_count` (INTEGER)
- `created_at`, `updated_at` (INTEGER)

**artefact_versions**
- `id` (TEXT PK)
- `artefact_id` (FK), `version_no` (INTEGER)
- `content` (TEXT), `diff` (TEXT nullable), `change_note` (TEXT)
- `created_at` (INTEGER)
- UNIQUE(artefact_id, version_no)

Indexes: `artefacts(thread_id)`, `artefacts(type)`, `artefact_versions(artefact_id, version_no)`.

## Commands

All commands use the `openclaw` CLI (e.g. `openclaw thread close ...`).

1. **Thread close** — ensure a closed thread has ≥1 artefact (creates a `note` if none).
   ```bash
   openclaw thread close <threadId> --messages-file ./thread.txt [--title "Optional title"]
   ```
   Prints `artefact_id=` and `title=`.

2. **Artefact show** — show artefact content (latest or specific version).
   ```bash
   openclaw artefact show <artefactId> [--version N] [--json]
   ```

3. **Artefact iter** — create a new version (v2, v3, …) with optional diff.
   ```bash
   openclaw artefact iter <artefactId> --content-file ./new.md --note "Change note"
   ```

4. **Review today** — compute metrics, create/update daily review note, print score.
   ```bash
   openclaw review today [--days 7] [--json]
   ```

## Migrations

Migrations run **automatically** on first use when the artefacts DB is opened (e.g. on first `thread close` or `review today`). The DB file is created at:

- `$OPENCLAW_STATE_DIR/artefacts.sqlite` (default: `~/.openclaw/artefacts.sqlite`).

Schema version is stored in `artefacts_schema_version`. To reset (e.g. for testing), remove the DB file.

## Example session

```bash
# 1. Close a thread (creates thread + note artefact + v1)
echo "Discuss MVP scope and timeline." > /tmp/thread.txt
openclaw thread close my-thread-1 --messages-file /tmp/thread.txt --title "MVP scope"

# 2. Show the artefact (latest version)
openclaw artefact show <artefact_id from step 1>

# 3. Create v2
echo "# Updated scope" > /tmp/new.md
openclaw artefact iter <artefact_id> --content-file /tmp/new.md --note "Updated scope"

# 4. Daily review (metrics + success score)
openclaw review today --days 7
openclaw review today --days 7 --json
```

## Success score (0–100)

- **A** (35%): `pct_threads_with_artefact`
- **V** (15%): versions per thread (capped)
- **R** (20%): reuse rate (artefacts with usage_count > 1)
- **L** (10%): living artefacts proportion
- **T** (20%): time-to-first-artefact (or 50 if N/A)

Diagnosis hints: habit loop broken (A&lt;95), artefacts not reused (R&lt;20), no iteration (V&lt;10), too slow to first value (T&lt;50).

## Sample metrics JSON + score

After one thread closed and one review:

```json
{
  "metrics": {
    "threads_closed": 1,
    "artefacts_created": 1,
    "pct_threads_with_artefact": 100,
    "avg_time_to_first_artefact_sec": 0,
    "artefact_versions_created": 1,
    "repeat_usage_count": 0,
    "living_artefacts_count": 0
  },
  "success_score": 58,
  "success_score_components": { "A": 100, "V": 20, "R": 0, "L": 0, "T": 100 },
  "diagnosis": ["artefacts not reused"],
  "review_artefact_id": "<uuid>"
}
```

Score 58 = 0.35×100 + 0.15×20 + 0.2×0 + 0.1×0 + 0.2×100.
