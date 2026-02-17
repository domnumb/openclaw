# Bernard Harness — 60-Second Quickstart

## Setup

```bash
git checkout -b harness/my-task
git config core.hooksPath .githooks   # optional: enable pre-commit smoke
```

## Work on a task

```bash
./harness/run_task.sh B-000           # creates runs/B-000/<timestamp>/
# ... do the work ...
git diff > runs/B-000/<timestamp>/PATCH.diff
./harness/smoke.sh | tee runs/B-000/<timestamp>/SMOKE.txt
echo OK > runs/B-000/<timestamp>/SMOKE_OK
```

## Exfil (mandatory)

```bash
git push                              # preferred
# OR
./harness/export_bundle.sh            # creates a .tgz bundle with full state
```

## If you are in a VM

**Exfil every 30 minutes.** `git push` or `./harness/export_bundle.sh`. Work that isn't exfiled doesn't exist. See `PROTOCOL.md` for full rules.
