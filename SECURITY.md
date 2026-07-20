# Security & Enterprise Notes — `nam-claude-skill`

This document is for a security reviewer evaluating whether to use this toolkit on a
company machine. It describes exactly what the code does, what it does **not** do, and how to
verify it yourself.

## TL;DR
- The analyzer/renderer code is **pure local** (Node `fs` / `path` / `crypto` only). **No `eval`,
  no dynamic `require`, no telemetry, no secrets.** Safe to copy and run locally.
- Exactly **three opt-in components touch the network or a local process** — each only at the
  user's explicit request, never in the background:
  1. `skills/namht-rails-to-spring/references/shadow-parity.cjs` — sends HTTP requests **only to
     the two `--source`/`--target` endpoints the user passes on the command line** (a parity test
     harness). No other destinations, no telemetry.
  2. The optional **VS Code extension** (`vscode-extension/`) — spawns the **local `claude` CLI**
     (whitelisted commands only); it makes no network calls of its own.
  3. `namht-splunk-report` (a prompt, not code) — instructs the agent to query Splunk / post to
     Slack using credentials from env/MCP, never hardcoded.
- Generated HTML can load Mermaid/Cytoscape from a CDN at view-time — **eliminated** when the
  bundled `vendor/` libraries are present (default in this repo → fully offline HTML).
- It contains **no credentials**. Nothing phones home. There is no telemetry in this repo.

## What's in the repo
| Type | Files | Risk |
|------|-------|------|
| Skill / command / agent prompts | `skills/`, `commands/`, `agents/` (Markdown) | Instructions for the AI; reviewed below |
| Static code analyzer | `skills/namht-map/references/graph-builder.js` | Reads source files, builds a graph. `fs`/`path` only |
| HTML renderers | `skills/*/references/html-builder.js` + `render-html.cjs`, `build-map.cjs` | Markdown/graph → HTML. `fs`/`path`/`crypto` only |
| Vendored JS libs | `vendor/mermaid.min.js`, `vendor/cytoscape.min.js` | Upstream OSS, inlined into HTML for offline render |
| Install scripts | `scripts/personal-install.sh`, `scripts/onboard-project.sh`, `scripts/sync-bundles.sh` | Symlink into `~/.claude`; write `.gitignore`/`CLAUDE.md`; copy bundled files |
| Parity harness | `skills/namht-rails-to-spring/references/shadow-parity.cjs` | **Outbound HTTP — only to the two user-supplied `--source`/`--target` URLs** (opt-in per run) |
| VS Code extension | `vscode-extension/` (TypeScript, proprietary) | **Spawns the local `claude` CLI** (whitelisted skill commands); no network of its own |
| Git guard hook | `hooks/git-guard.sh` | Blocks remote-touching/destructive git; push only to the personal whitelist |

## Executable-surface audit (verify it yourself)
```bash
# 1) Shell-out / eval / network surface — the ONLY expected matches are:
#      - RegExp .exec(...) string matching (not process execution)
#      - fetch( in skills/namht-rails-to-spring/references/shadow-parity.cjs (user-supplied endpoints only)
#      - child_process/spawn in vscode-extension/src/extension.ts (spawns the local claude CLI)
grep -rnE "child_process|execSync|spawn|\beval\(|new Function|http\.|https\.|fetch\(|net\.|dns\." \
  --include='*.js' --include='*.cjs' --include='*.sh' --include='*.ts' .

# 2) Real require()s are stdlib + local siblings only:
grep -rnE "require\((['\"])" --include='*.js' --include='*.cjs' .   # fs, path, crypto, ./html-builder, ./graph-builder

# 3) No secrets committed:
grep -rniE "api[_-]?key|secret|password|BEGIN (RSA|PRIVATE)|sk-|ghp_|AKIA[0-9A-Z]{16}" .
#   → only the WORD "secret/token" in review checklists, no actual values.
```
Findings (as audited): no `eval`/`Function`, no dynamic `require`, no hardcoded secrets, no
telemetry. Process/network use is limited to the three opt-in components listed in the TL;DR
(shadow-parity → user-supplied endpoints; the extension → local `claude` CLI; splunk-report →
env/MCP credentials). `graph-builder.js`/`html-builder.js` are readable `tsc` output (not
minified) — provenance: the author's own Auto Spec Kit project.

## Data flow & egress
- **KB / analyzer**: 100% local. The `knowledge-base/` never leaves the machine.
- **The real egress is the AI agent itself**: when Claude reads code (via `Read`),
  that source enters the LLM context (Anthropic). This is inherent to using
  an AI coding assistant — **not added by this toolkit**. It is acceptable under a company
  **Team/Enterprise** Claude plan (commercial terms; Anthropic does not train on your data by
  default). Confirm your plan tier with your admin.
- **Generated HTML**: graph/markdown data is embedded **inline**. With `vendor/` present, the
  chart library is inlined too → the HTML makes **zero external network requests**. Without
  `vendor/`, it links Mermaid/Cytoscape from `cdnjs.cloudflare.com` at view-time (no data sent;
  may be blocked by a strict proxy). Delete `vendor/` for the small CDN-linked output, keep it
  for offline/air-gapped.

## Install-script safety
- `personal-install.sh` only creates symlinks under `~/.claude/{skills,commands,agents}` and, on
  uninstall, **only removes symlinks whose target points back into this repo** (`case "$SRC"/*`).
  It cannot delete arbitrary files.
- `onboard-project.sh` **writes into a target project** (`.gitignore` += `spec-kit-sessions/`,
  and a starter `CLAUDE.md` if absent). Do **not** run it on a shared/team repo if you want zero
  footprint — review its diff first.

## Built-in safety behavior (prompts)
- `namht-build` / `namht-review` enforce a **change-discipline contract**: scope-locked, minimal
  diff, no drive-by refactors, don't leave the build broken (verify + rollback), confirm before
  destructive/outward actions, never touch secrets.
- `namht-scan` skips secret files and records that a secret exists, never its value.
- All tool calls (Bash, Edit, installs) remain gated by Claude Code's permission system — the
  user approves them. Use an **untrusted workspace** until you trust a repo.

## Git guardrail (hard-blocked, read/sync-in only)

A **PreToolUse hook** (`hooks/git-guard.sh`) + **`permissions.deny`** rules make git commands that
touch the **remote** or **destroy local work** *impossible* — enforced by the Claude Code harness,
not by the model's goodwill. This holds even for chained commands (`cd x && git push`), `git -C`,
and ignores the word "push" inside a quoted commit message.

- **Allowed** (read / sync-in): `fetch`, `pull`, `status`, `log`, `diff`, `show`, `blame`,
  `branch` (list), `add`, `commit`, `stash`, `merge`, `checkout <branch>` — **plus `push` ONLY
  to a whitelisted personal remote** (default `github.com/NamHT4Devlop/*`; edit `ALLOW_OWNER_RE`
  in `hooks/git-guard.sh`). The guard resolves the actual target (explicit URL, `git -C <dir>`,
  leading `cd`, or the remote's configured URL) and allows the push only if its owner is whitelisted.
- **Blocked**: `push` to **any non-whitelisted remote** (team/org repos — e.g. Agenta-AI,
  rubyforgood), `remote add/set-url/remove/rename/set-head/set-branches/prune`, `send-email`,
  `svn dcommit`, `p4 submit`, `config remote.*`; and destructive local: `reset --hard`,
  `clean -f`, `checkout -- / . / -f / --force`, `restore`, `branch -D`, `commit --amend`,
  `rebase`, `filter-branch/filter-repo`, `reflog expire`, `gc --prune`, `update-ref -d`.

Wire it into `~/.claude/settings.json` (the installer symlinks the script to
`~/.claude/hooks/namht-git-guard.sh`; arm it once with this snippet):

```jsonc
{
  "permissions": {
    "deny": [
      "Bash(git remote add:*)", "Bash(git remote set-url:*)", "Bash(git remote remove:*)",
      "Bash(git reset --hard:*)", "Bash(git clean -f:*)", "Bash(git rebase:*)",
      "Bash(git commit --amend:*)", "Bash(git restore:*)", "Bash(git branch -D:*)",
      "Bash(git send-email:*)"
    ]
    // NOTE: no blanket "git push" deny here — the hook decides push by target owner (whitelist).
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "~/.claude/hooks/namht-git-guard.sh", "timeout": 10 } ] }
    ]
  }
}
```

Verify (push to a team URL is denied, pull is allowed):
`printf '{"tool_input":{"command":"git push https://github.com/some-org/repo"}}' | ~/.claude/hooks/namht-git-guard.sh`
→ `permissionDecision":"deny"`. A push to a whitelisted personal remote returns no output (allowed).
Edit `ALLOW_OWNER_RE` / the rules in `hooks/git-guard.sh` to taste. (A settings change needs a
Claude Code reload to go live; editing the hook script itself takes effect immediately.)

## Recommended enterprise hardening
1. Use a company **Team/Enterprise** Claude plan (not a personal consumer plan).
2. Pin the toolkit to a specific commit/tag and review diffs before pulling updates.
3. Keep `vendor/` so generated HTML is fully offline.
4. Keep secrets out of repos (the toolkit won't index raw secret files, but config source files
   are read like any other code).
5. Have your security team skim `graph-builder.js` / `html-builder.js` (readable JS) and the two
   shell scripts — they are short.

_Not a substitute for your own security review. This reflects the state of the repo at audit time._
