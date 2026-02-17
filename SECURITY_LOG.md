# OpenClaw Security Log

## Intent
Security-first setup. Default to safe, local-only, least privilege, and explicit approvals for any expansion.

## Non-negotiable constraints (user provided)
- Never expose Control UI / Gateway / WebSocket to the public internet.
- Treat all inbound content as untrusted.
- Never paste secrets; use placeholders.
- Only official sources (openclaw/openclaw + docs.openclaw.ai).
- Default read-only; ask before enabling writes, browser, email, shell, remote nodes, dynamic skills.
- After any config change: run `openclaw security audit` + `openclaw security audit --deep`, then propose `--fix` with explanation.

## Environment
- Project root: `/Users/mael/Projects/openclaw/openclaw`
- CODEX_HOME: `/Users/mael/Projects/openclaw/.codex`
- OS: macOS (implied by paths)

## Timeline / Actions
### 2026-01-30
- Created project directory: `/Users/mael/Projects/openclaw`
- Set up clean CODEX_HOME: `/Users/mael/Projects/openclaw/.codex`
- Installed OpenClaw repo: cloned `openclaw/openclaw` to `/Users/mael/Projects/openclaw/openclaw`
- Installed curated Codex skills into new CODEX_HOME
- Installed pnpm via Corepack
- Installed deps: `pnpm install`
- Built UI: `pnpm ui:build`

## Current state
- OpenClaw onboarding wizard is running in terminal.
- User wants **Manual** mode (ultra-restrictive configuration).

## Next step (pending)
- In wizard: choose **Manual**.
- Then share next screen for step-by-step safe selections.

## Rollback notes
- To remove local OpenClaw state: remove `/Users/mael/Projects/openclaw/.codex` (only if asked).
- To remove repo: delete `/Users/mael/Projects/openclaw/openclaw` (only if asked).

### 2026-01-30 (continued)
- Onboarding completed in Manual mode
  - Local gateway
  - Workspace: /Users/mael/Projects/openclaw/workspace
  - Model provider skipped (no auth configured)
  - Default model set: openai-codex/gpt-5.2-codex
  - Gateway bind: loopback (127.0.0.1)
  - Gateway token: auto-generated
  - Channels: not configured
  - Skills: not configured
  - Gateway service install: NO
- Note: Config written to ~/.openclaw/openclaw.json (state dir defaults to ~/.openclaw)

#### Security audit results
- Ran: openclaw security audit
  - WARN gateway.trusted_proxies_missing
  - WARN gateway.token_too_short
  - WARN fs.state_dir.perms_readable (/Users/mael/.openclaw mode=755)
  - INFO tools.elevated: enabled; browser control: enabled
- Ran: openclaw security audit --deep
  - Same warnings + WARN gateway.probe_failed (gateway not running)

#### Observed issues
- Dashboard link failed because gateway service is not running (expected; service install was skipped).
- State dir is in ~/.openclaw (not isolated in project folder).

#### Pending decisions
- Whether to relocate OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH to project-local paths.
- Whether to disable elevated tools and browser control by default.
- Whether to regenerate a longer gateway token.
- Whether to run openclaw security audit --fix (will change config/permissions).
### 2026-01-30 (audits rerun)
- Ran (manual): CODEX_HOME=/Users/mael/Projects/openclaw/.codex pnpm openclaw security audit
  - WARN gateway.trusted_proxies_missing
  - WARN gateway.token_too_short
  - WARN fs.state_dir.perms_readable (/Users/mael/.openclaw mode=755)
  - INFO tools.elevated: enabled; browser control: enabled
- Ran (manual): CODEX_HOME=/Users/mael/Projects/openclaw/.codex pnpm openclaw security audit --deep
  - Same warnings + WARN gateway.probe_failed (gateway not running)

Checklist (in progress)
- [x] Bind local only (loopback)
- [ ] Access via private overlay (Tailscale) + auth
- [ ] Pairing + allowlist + mention-gating
- [ ] Strict sandbox + dedicated workspace
- [ ] Disable elevated tools + browser control
- [x] Audits run after config change
### 2026-01-30 (state isolation)
- Moved state dir:
  - from: /Users/mael/.openclaw
  - to:   /Users/mael/Projects/openclaw/state
- Created local env helper (ignored by git):
  - /Users/mael/Projects/openclaw/openclaw/.local/openclaw-env.sh
    - exports OPENCLAW_STATE_DIR, OPENCLAW_CONFIG_PATH, CODEX_HOME
- Audits rerun with new state dir:
  - WARN fs.state_dir.perms_readable now points to /Users/mael/Projects/openclaw/state (mode 755)
  - WARN token too short, trusted proxies missing
  - INFO tools.elevated enabled; browser control enabled
  - WARN gateway probe failed (gateway not running)

Rollback
- Move state back: mv /Users/mael/Projects/openclaw/state /Users/mael/.openclaw
- Remove helper: rm /Users/mael/Projects/openclaw/openclaw/.local/openclaw-env.sh
### 2026-01-30 (disable elevated + browser)
- Config changes in /Users/mael/Projects/openclaw/state/openclaw.json:
  - tools.deny += ["browser"]
  - tools.elevated.enabled = false
  - browser.enabled = false
- Audits rerun:
  - tools.elevated: disabled
  - browser control: disabled
  - Remaining warnings: trusted_proxies_missing, token_too_short, state dir perms (755), gateway probe failed (not running)

Rollback
- In openclaw.json: remove tools.deny "browser" (or tools.deny entirely), set tools.elevated.enabled=true, set browser.enabled=true.
### 2026-01-30 (regenerate gateway token)
- Regenerated gateway.auth.token (long random) in /Users/mael/Projects/openclaw/state/openclaw.json
  - Token not logged (per security policy)
- Audits rerun:
  - gateway.token_too_short warning cleared
  - Remaining warnings: trusted_proxies_missing, state dir perms (755), gateway probe failed (not running)

Rollback
- If needed, restore previous token from backup (none kept). Otherwise regenerate again.
### 2026-01-30 (audit --fix)
- Ran: openclaw security audit --fix
  - chmod 700 /Users/mael/Projects/openclaw/state
  - chmod 700 /Users/mael/Projects/openclaw/state/agents/main
  - chmod 700 /Users/mael/Projects/openclaw/state/agents/main/sessions
- Audits after fix:
  - Remaining WARN: gateway.trusted_proxies_missing (expected for loopback-only)
  - Deep WARN: gateway.probe_failed (gateway not running)

Rollback
- To undo perms (not recommended), chmod 755 those dirs.
### 2026-01-30 (pairing + allowlist + mention-gating)
- Config updates in /Users/mael/Projects/openclaw/state/openclaw.json:
  - channels.whatsapp: dmPolicy=pairing, allowFrom=[], groupPolicy=allowlist, groupAllowFrom=[]
  - channels.imessage: dmPolicy=pairing, allowFrom=[], groupPolicy=allowlist, groupAllowFrom=[]
  - agents.list includes main with groupChat.mentionPatterns=["@openclaw"]
- Audits run:
  - allowlist count now 2 (whatsapp + imessage)
  - tools.elevated disabled; browser control disabled
  - WARN: trusted_proxies_missing
  - Deep WARN: gateway.probe_failed (gateway not running)

Rollback
- Remove channels.whatsapp and channels.imessage blocks (or set dmPolicy/groupPolicy to desired values).
- Remove agents.list main entry or remove groupChat.mentionPatterns.
### 2026-01-30 (incident: OAuth code leaked in chat)
- User pasted an OAuth code into chat (treated as compromised).
- Action: discard code and restart OAuth flow to generate a new code.
- Reminder: never paste tokens/keys/codes into chat; enter locally only.
### 2026-01-30 (browser tool enable + strict deny list)
- Config updates in /Users/mael/Projects/openclaw/state/openclaw.json:
  - browser.enabled = true
  - tools.deny: removed "browser", added ["group:runtime","group:fs","group:nodes","group:automation","canvas","image"]
  - tools.elevated.enabled = false (kept)
  - channels.whatsapp.dmPolicy = "disabled"
  - channels.whatsapp.groupPolicy = "disabled"
  - channels.imessage.dmPolicy = "disabled"
  - channels.imessage.groupPolicy = "disabled"
- Note: initial attempt to set channels.*.enabled was invalid; removed and replaced with dmPolicy/groupPolicy disabled.
- Audits run after fix:
  - browser control: enabled
  - tools.elevated: disabled
  - allowlist: 0
  - WARN: trusted_proxies_missing
  - Deep WARN: gateway.probe_failed (gateway not running)

Rollback
- Set browser.enabled=false
- Add "browser" back to tools.deny and remove strict deny entries
- Restore channels.whatsapp/imessage dmPolicy and groupPolicy as desired
### 2026-01-30 (force managed browser profile)
- Set browser.defaultProfile = "openclaw" in /Users/mael/Projects/openclaw/state/openclaw.json
- Audits run:
  - browser control: enabled
  - tools.elevated: disabled
  - WARN: trusted_proxies_missing
  - Deep WARN: gateway.probe_failed (gateway not running)

Rollback
- Remove browser.defaultProfile or set to "chrome" if you want relay takeover.
### 2026-01-30 (disable canvas host + remove channel configs)
- Removed channels.whatsapp and channels.imessage blocks from /Users/mael/Projects/openclaw/state/openclaw.json
- Set canvasHost.enabled = false (avoid ~/.openclaw canvas root)

Rollback
- Restore channels.whatsapp/imessage blocks if needed
- Set canvasHost.enabled = true (or remove canvasHost block)
### 2026-01-30 (install imsg)
- Installed imsg via Homebrew: `brew install steipete/tap/imsg`
- Caveats: requires Full Disk Access and Automation permission for Terminal
### 2026-01-30 (iMessage allowlist)
- Added channels.imessage in /Users/mael/Projects/openclaw/state/openclaw.json:
  - cliPath: /opt/homebrew/bin/imsg
  - dmPolicy: allowlist
  - allowFrom: ["+33782208346"]
  - groupPolicy: disabled
- Audits run after change.

Rollback
- Remove channels.imessage block or set dmPolicy/groupPolicy to desired values.
### 2026-02-09 (Brave browser + cleanup)
- Configured Brave browser in /Users/mael/Projects/openclaw/state/openclaw.json:
  - browser.executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
- Cleaned up ~/.openclaw:
  - Removed: browser/ (Chrome profile, redundant with state/browser), canvas/, workspace/ (duplicate), openclaw.json.bak* (old backups)
  - Kept: agents/, cron/, devices/, identity/, logs/, media/, sandbox/, sandboxes/ (runtime data)
  - Size reduced: 86M → 984K
  - Backup created: .backup/openclaw-home-backup-20260209-163235.tar.gz (59M)
- OpenClaw now uses Brave instead of Chrome for browser automation.

Rollback
- Restore from backup: `tar -xzf .backup/openclaw-home-backup-20260209-163235.tar.gz -C ~`
- Remove browser.executablePath from config to revert to auto-detection (will prefer Chrome if available).
### 2026-02-09 (web search + fetch enabled)
- In /Users/mael/Projects/openclaw/state/openclaw.json:
  - tools.web.search.enabled = true
  - tools.web.fetch.enabled = true
- web_search requires a Brave Search API key: run `openclaw configure --section web` or set BRAVE_API_KEY in the Gateway environment. Without it, web_search will return a setup hint.
- web_fetch does not require an API key (plain HTTP fetch).

Rollback
- Set tools.web.search.enabled and tools.web.fetch.enabled back to false in state/openclaw.json.
### 2026-02-09 (harmonize paths: projects → Projects)
- Canonical path is /Users/mael/Projects/openclaw (capital P). Replaced /Users/mael/projects/openclaw everywhere in:
  - openclaw/.local/openclaw-env.sh (OPENCLAW_STATE_DIR, OPENCLAW_CONFIG_PATH, CODEX_HOME)
  - state/openclaw.json (agents.defaults.workspace)
  - state/agents/main/sessions/sessions.json and session .jsonl files
  - state/openclaw.json.bak*
  - SECURITY_LOG.md (this file)
- Left state/browser/ profile LOG files unchanged (browser runtime; macOS is case-insensitive).

Rollback
- Replace /Users/mael/Projects/openclaw with /Users/mael/projects/openclaw in the same files if you need lowercase.
