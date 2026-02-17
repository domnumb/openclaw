# PROTOCOL — Bernard Harness Rules

1. **Single-writer rule.** Only one agent/human writes to a branch at a time. Coordinate via STATE.md.
2. **Required artefacts per task.** Every task produces: `PLAN.md`, `RUNLOG.txt`, `PATCH.diff` (or PR), `SMOKE.txt` + `SMOKE_OK` marker. No exceptions.
3. **Mandatory exfil at end of task.** `git push` the branch OR run `./harness/export_bundle.sh`. Work that isn't exfiled doesn't exist.
4. **No merge if smoke fails.** `./harness/smoke.sh` must print `SMOKE_OK` before any merge to master/main.
5. **Scope discipline.** Declare touched paths in `SCOPE.txt` before starting. Do not edit outside declared scope.
6. **VM rule.** When working inside a VM, exfil every 30 minutes — `git push` or bundle. No excuses.
