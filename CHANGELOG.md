# Changelog

All notable changes to this kit. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/) — for a toolkit that means:

- **MAJOR** — you have to do something after updating (a renamed folder, a removed command, a
  changed artifact layout).
- **MINOR** — new skills or capabilities; `git pull` and carry on.
- **PATCH** — fixes and doc corrections only.

Two things are versioned separately: the **plugin** (`.claude-plugin/plugin.json`, the skills and
commands) and the **VS Code extension** (`vscode-extension/package.json`). The extension version is
noted per release when it changed.

---

## [2.0.0] — 2026-08-12

### ⚠️ Breaking

- **`spec-kit-sessions/` is now `namht-sessions/`.** The old name collided with GitHub's unrelated
  [`github/spec-kit`](https://github.com/github/spec-kit), which is confusing now that this repo is
  public. The product name dropped "Spec Kit" too — it is **namht Kit**.
  **What you have to do:** nothing urgent. Every skill that reads past work (`ask`, `build`,
  `fix-bug`, `retro`, `rails-to-spring`) falls back to a legacy `spec-kit-sessions/` folder, and the
  extension's report detector matches both names. When convenient, merge the old folder in:
  ```bash
  scripts/migrate-sessions.sh --dry-run <repo>   # look first
  scripts/migrate-sessions.sh <repo>             # then do it
  ```
  Add the new name to your machine-wide ignore (keep the old one while legacy folders exist):
  ```bash
  printf '%s\n' 'namht-sessions/' 'spec-kit-sessions/' >> ~/.gitignore_global
  ```

### Added

- **`/namht-drift`** — the missing whole-picture check. Every other command works one change at a
  time; nothing verified that the documents still describe the software. It audits the repo and
  reports four kinds of drift: stale KB entries (D1), undocumented behavior (D2), acceptance
  criteria promised in `namht-sessions/` but never shipped (D3), and broken architecture invariants
  (D4). Each finding cites `file:line` on one side and the document line on the other and states
  which side is wrong. Ends with a verdict (`CONVERGED` / `DRIFTING` / `STALE`) and a journal row so
  successive runs show the trend.
- **`/namht-drift --fix-docs`** — opt-in mode that closes the documentation half only: D1/D2
  findings where the audit concluded the *document* was wrong, after showing you the exact
  `knowledge-base/` files and taking one explicit yes, with a backup to
  `namht-sessions/drift/<date>-kb-backup/` first (that folder is gitignored, so git is not an undo
  here). Never edits source, never writes an unbuilt AC into the docs as if shipped, never relaxes
  an invariant to match the code.
- `scripts/migrate-sessions.sh` — safe rename/merge for the folder change above. Never overwrites,
  supports `--dry-run`, and leaves anything it could not merge in place.
- VS Code extension **v0.14.0**: a `drift` card, and form fields now support a checkbox type (used
  for the `--fix-docs` toggle).

### Fixed

- `scripts/onboard-project.sh` wrote a stale `/spec-kit:*` command namespace into the project
  CLAUDE.md — the correct namespace is `/namht:*`.

---

## [1.4.0] — 2026-08-10

### Added

- **Resumable ports** — `namht-rails-to-spring` keeps `namht-sessions/port/_progress.md` and
  continues from it; a port spanning weeks no longer restarts each session.
- **Journals as cross-session memory** — `build` and `fix-bug` now write `builds/_journal.md` and
  `fixes/_journal.md` alongside the existing `answers/_journal.md`, and `retro` reads all three.
- **`/namht-scan` depth knob** — `quick` / `standard` / `deep`; proposes `quick` above ~1500 files.
- **Read-only mode for the extension** (`namhtSpecUi.mode: readonly`) — the seven code-editing
  skills are hidden *and refused by the host*, so a PM/SM build cannot change source even if the
  command is sent by hand.
- `scripts/fetch-vendor.sh` — fetch the render libraries on demand (npm first, so a corporate
  registry is respected; cdnjs fallback) and verify them against `vendor/SHA256SUMS`, instead of
  copying 3.6 MB between machines.

### Changed

- **PDF export is dark by default** (`#0f1420`) end to end, with `PDF_KEEP_COLORS=1` to preserve a
  source document's own colours and `PDF_LIGHT=1` for a light page.

### Fixed

- Diagram labels, links and images were unreadable in dark exports — Mermaid bakes colours into the
  SVG at render time, so the theme now matches from the start instead of being inverted at print.
- Light panels from source HTML no longer leave white patches on the dark page.
- Off-screen images no longer fail to render during headless print (`loading="lazy"` removed), and
  relative image paths resolve from a `<base href>` injected into the temp copy.

---

## [1.3.0] — 2026-08-09

### Security

Reproduced and closed real bugs, each with a regression test:

- **git-guard alias RCE** — `git -c alias.zz='!echo PWNED' zz` ran arbitrary shell and bypassed the
  guard entirely. `-c` / `--config-env` values naming `alias.*` are now denied, alongside a
  subcommand allowlist, `--git-dir`/`--work-tree` redirection, `GIT_*=` env prefixes, and credential
  redaction in reported URLs. The suite grew from 26 to **56 cases**.
- **XSS in the dependency-map viewer** — a `</script>` sequence inside a scanned repo's comment
  broke out of the embedded JSON block and injected HTML at `file://`. Graph data is now escaped and
  the viewer ships a CSP.
- **Untrusted input is data, not instructions** — `build`, `user-story`, `fix-bug`, `splunk-report`,
  `pr`, `review`, `qa-integration`, `design-review` and `scan` now treat Slack threads, tickets,
  logs and page content as data. Acceptance criteria that originated outside the user need one
  explicit yes before they reach code.
- **PII redaction** in `splunk-report` — the one skill that touches real customer data now reports
  error type, signature and count rather than raw payloads.
- Extension config (`claudePath`, `extraArgs`, `mode`) is **machine-scoped**, so a repo's
  `.vscode/settings.json` cannot change which binary runs or how; URL-shaped form values are
  redacted before history is persisted.

### Added

- **`namht-build` safety net** — before the first edit: a clean-tree check, a recorded baseline of
  the gates (including already-failing tests), and a pre-change patch, with an explicit revert route
  that the git-guard permits.
- Objective plan-approval triggers (migration · dependency · published contract · >3 callers ·
  >5 files · Medium/Complex · auth/money) replacing "trivial by feel", and a rule that a blanket
  "go" authorizes reversible work only.
- **Reuse before you create** is now a hard rule across `build`, `fix-bug` and `rails-to-spring`,
  extended to the things that get duplicated most: constants, enums, config keys, error codes,
  messages, i18n keys, style tokens and test fixtures.
- Step 5 review lenses run as **fresh sub-agents that did not write the code**.

---

## [1.2.0] — 2026-07-20

### Added

- **`/namht-user-story`** — deep investigation of a requirement, or comprehension of a Slack thread,
  into INVEST stories with maximally granular Given/When/Then acceptance criteria.
- **`/namht-rails-to-spring`** (renamed from `namht-port`) — contract-first, parity-verified stack
  port with a bundled shadow-test harness and an independent parity reviewer.
- **Q&A journal** — `/namht-ask` writes one line per answered question, so a new session remembers
  what was asked before, with a staleness check before reusing an old conclusion.
- Branch confirmation in `scan` / `rescan` — it now says which git branch it is reading.
- VS Code extension **v0.13.0**: app-window layout, chat bubbles, per-run model picker that survives
  switching models mid-session (`--resume` keeps the context), free "Ask anything" chat, step
  timeline and per-file diffs, squirrel icon, Yarn, `UNLICENSED`.

---

## [1.1.0] — 2026-07-08

### Added

- `docs/skills-catalog.html` — the skill catalog as a table (name · intended user · description)
  with an edits-code vs read-only badge per skill.
- Setup guides for a personal machine, a company machine, and a no-clone manual install.

---

## [1.0.0] — 2026-06-27

Initial release: a native Claude Code port of the author's private Auto Spec VS Code extension
(which ran on GitHub Copilot). Knowledge Base generation, the spec-driven build pipeline, two-phase
review, grounded Q&A, planning, dependency maps, business↔code docs — plus the read/sync-in-only
git guard hook.
