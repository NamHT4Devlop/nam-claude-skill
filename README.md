# Spec Kit for Claude Code

A native **Claude Code** port of the [Auto Spec Kit](../auto-spec-extension) VS Code
extension. Same spec-driven workflow — **Requirement → Plan → Code → Review → Test →
Evidence** — plus Knowledge Base generation, codebase Q&A, user stories, dependency mapping,
and business↔code documentation. The difference: it runs on **Claude Code** (your own
tools: file ops, Bash, git, parallel sub-agents) instead of GitHub Copilot / `vscode.lm`.

> **Your existing Knowledge Bases work as-is.** The KBs you generated with the old extension
> are plain Markdown under each repo's `knowledge-base/`. Every command here reads that same
> folder — nothing to migrate or regenerate. Only run `/spec-kit:scan` for brand-new repos.

---

## What's inside

```
claude-skill/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest
│   └── marketplace.json     # local marketplace (for one-command install)
├── commands/                # 9 slash commands → /spec-kit:build, :scan, :review, …
├── skills/                  # 8 skills (the methodology — also usable standalone)
│   ├── spec-build/          #   13-step pipeline   (+ bundled review checklist)
│   ├── spec-scan/           #   KB generation       (+ bundled kb-steps spec)
│   ├── spec-rescan/         #   incremental KB update
│   ├── spec-review/         #   two-phase review    (+ bundled review checklist)
│   ├── spec-ask/            #   KB-grounded Q&A
│   ├── spec-plan/           #   PO/BA user stories
│   ├── spec-map/            #   dependency graph → Mermaid
│   └── spec-document/       #   business↔code doc
├── agents/                  # 7 specialist sub-agents (planning + review)
└── resources/               # review-skills-universal.md, kb-steps.md
```

Commands are thin entry points; the **skills** hold the actual methodology and auto-activate
from natural language too (you don't have to type the slash command). The **agents** are the
read-only specialists the build/review steps fan out to in parallel.

---

## Prerequisites

- **Claude Code** installed and working (`claude --version`). Plugins/marketplaces need a
  recent version — if `/plugin` is unknown, update Claude Code first (`claude update` or
  reinstall from the official docs).
- **git** installed (`git --version`) — needed to clone this repo and used by `rescan`/`review`.
- **Access to this repository.** It is currently **private**, so cloning requires that your
  GitHub account has access (or ask the owner to add you / make it public). The plugin itself
  needs **no API key** — it runs on your existing Claude Code.
- Paths below use `~/.claude` (macOS/Linux). On **Windows** use `%USERPROFILE%\.claude`
  (PowerShell: `$HOME\.claude`).

---

## Get the code

Pick a stable location to keep the plugin (so you can update it with `git pull` later):

```bash
# via SSH (recommended if your GitHub uses SSH keys)
git clone git@github.com:NamHT4Devlop/claude-skill.git ~/claude-skill

# or via HTTPS
git clone https://github.com/NamHT4Devlop/claude-skill.git ~/claude-skill
```

Everywhere below, `<PLUGIN_DIR>` means the folder you cloned into (e.g. `~/claude-skill`).
If you keep the files somewhere else, substitute that absolute path.

---

## Install — Option A: as a plugin (recommended)

Best when you want every command available across **all** your repos on a machine, with the
nice `/spec-kit:*` namespacing. Run these **inside a Claude Code session** (the `/plugin`
commands are typed into Claude Code, not your shell):

```
/plugin marketplace add ~/claude-skill
/plugin install spec-kit@spec-kit-marketplace
```

- `marketplace add <PLUGIN_DIR>` registers the local marketplace defined in
  `.claude-plugin/marketplace.json`. You can also point it straight at the GitHub repo:
  `/plugin marketplace add NamHT4Devlop/claude-skill` (Claude Code clones it for you; requires
  repo access).
- `install spec-kit@spec-kit-marketplace` installs the plugin named `spec-kit` from that
  marketplace.
- Reload when prompted (or run `/plugin` to manage installed plugins).

After install you'll have these commands (type `/` to see them):
`/spec-kit:scan`, `/spec-kit:rescan`, `/spec-kit:build`, `/spec-kit:review`, `/spec-kit:ask`,
`/spec-kit:plan`, `/spec-kit:map`, `/spec-kit:document`, `/spec-kit:help`. The 8 skills and 7
sub-agents load automatically — skills also activate from plain English (you don't have to
type the slash command).

> **Team install:** commit/host this repo, then each teammate runs the two `/plugin` commands
> above pointing at their clone (or at `NamHT4Devlop/claude-skill`). To pin the plugin for a
> whole project automatically, add it to the project's `.claude/settings.json` under
> `enabledPlugins` / configure a marketplace there (see Claude Code plugin docs).

## Install — Option B: plain skills (no plugin machinery)

Best when you want to **commit the skills into a specific repo** (so collaborators get them on
clone), or you prefer not to use marketplaces.

**B1 — Per project** (only that repo gets the commands/skills):

```bash
# run from the target repo's root
mkdir -p .claude/skills .claude/commands .claude/agents
cp -R <PLUGIN_DIR>/skills/*   .claude/skills/
cp -R <PLUGIN_DIR>/commands/* .claude/commands/
cp -R <PLUGIN_DIR>/agents/*   .claude/agents/
```

**B2 — Per user** (all your repos on this machine):

```bash
mkdir -p ~/.claude/skills ~/.claude/commands ~/.claude/agents
cp -R <PLUGIN_DIR>/skills/*   ~/.claude/skills/
cp -R <PLUGIN_DIR>/commands/* ~/.claude/commands/
cp -R <PLUGIN_DIR>/agents/*   ~/.claude/agents/
```

**You do NOT need to copy the plugin's `resources/` folder for Option B.** Each skill is
self-contained — it bundles whatever it needs under its own `references/` subfolder, which
comes along automatically with `cp -R skills/*`:
`spec-build`/`spec-review`/`spec-scan`/`spec-rescan` carry the review checklist and/or the
KB-section spec. `resources/` at the repo root is only a canonical copy for the plugin form.

> ⚠️ **Difference from Option A:** as plain skills the slash commands are **not** namespaced —
> they're `/build`, `/review`, `/scan`, etc. If those names clash with other commands you have,
> rename the files in `.claude/commands/` (e.g. `build.md` → `spec-build.md`).

## Install — Option C: personal-only, zero footprint in any repo (just for you)

Use this when the plugin/skills are **for your eyes only** and must never appear in — or be
committed to — any team/project repo. It installs into your home dir via symlinks and routes
all generated artifacts to a machine-wide gitignore.

```bash
# 1) symlink skills/agents/commands into ~/.claude (commands get a spec- prefix)
<PLUGIN_DIR>/scripts/personal-install.sh

# 2) make every Spec Kit artifact invisible to git, machine-wide (no per-repo edits)
touch ~/.gitignore_global
printf '%s\n' 'spec-kit-sessions/' 'knowledge-base/' 'CLAUDE.local.md' '.spec-kit/' >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

- Commands become `/spec-build`, `/spec-scan`, `/spec-review`, … (prefixed so they don't shadow
  built-ins like `/help`). Skills also auto-activate from plain English.
- Because it's symlinks, `git pull` in `<PLUGIN_DIR>` instantly updates your install.
- The global gitignore means even if you run `/spec-kit:scan` inside a team repo, its
  `knowledge-base/` and `spec-kit-sessions/` stay **local and uncommitted** — nothing leaks.
- **Pick ONE method** — if you use this, do *not* also `/plugin install` the same plugin.
- Uninstall: `<PLUGIN_DIR>/scripts/personal-install.sh uninstall`.

> Note: a global ignore of `knowledge-base/` keeps your KBs private. If a project legitimately
> needs a committed `knowledge-base/`, force-add it there with `git add -f knowledge-base/`.

---

## Verify the install

1. In a Claude Code session, type `/` and confirm the `spec-kit:` commands (Option A) or
   `/build`, `/scan`… (Option B) appear.
2. Run `/spec-kit:help` (or `/help` for plain skills) — it prints all commands **and** checks
   whether the current repo has a `knowledge-base/`.
3. Plugin only: run `/plugin` → you should see **spec-kit** listed as installed/enabled.

## Update to the latest version

- **Option A (plugin):**
  ```bash
  cd <PLUGIN_DIR> && git pull
  ```
  then in Claude Code: `/plugin marketplace update spec-kit-marketplace` (or remove & re-add
  the marketplace, then reinstall). Reload when prompted.
- **Option B (plain skills):** `git pull` in `<PLUGIN_DIR>`, then re-run the `cp -R` commands
  to overwrite the copies.

## Uninstall

- **Option A:** `/plugin uninstall spec-kit` (and optionally
  `/plugin marketplace remove spec-kit-marketplace`).
- **Option B:** delete the copied folders, e.g.
  `rm -rf ~/.claude/skills/spec-* ~/.claude/commands/{build,scan,rescan,review,ask,plan,map,document,help}.md ~/.claude/agents/{codebase-analyzer,impact-detector,business-flow-tracer,security-reviewer,architecture-reviewer,performance-reviewer,business-consistency-reviewer}.md`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/plugin` is not recognized | Update Claude Code; plugins require a recent version. |
| `marketplace add` fails on a path | Pass an **absolute** path to `<PLUGIN_DIR>` and ensure `.claude-plugin/marketplace.json` exists there. |
| `git clone` asks for a password / permission denied | The repo is private — use an account with access, set up SSH keys, or have the owner share/publish it. |
| Commands don't show up | Reload the Claude Code window/session after install; for plain skills, confirm files landed in `.claude/commands` & `.claude/skills`. |
| A command says "no knowledge-base found" | Run `/spec-kit:scan` once in that repo (or reuse an existing `knowledge-base/` folder). |
| Command name clash (Option B) | Rename the files in `.claude/commands/`. |

---

## Recommended setup for a multi-project workspace

If you keep many repos under one parent folder (a "workspace"), follow this separation:

- **Tool = global, from git.** Install once as a plugin (Option A). Update everywhere with one
  `git pull` + marketplace update. Don't copy skills into each repo.
- **Knowledge Base = per project, versioned with the code.** Each repo keeps its own
  `knowledge-base/`; commit it so the team shares it. Refresh with `/spec-kit:rescan`.
- **Operate one project per session.** `cd <project> && claude` so commands read *that*
  project's `knowledge-base/`. The parent workspace is just an organizing folder — don't run
  from the workspace root and expect commands to guess which sub-project you mean. (A true
  **monorepo** — one git repo, many packages — is the opposite: run at the repo root; `scan`
  produces per-module docs under `knowledge-base/modules/`.)
- **Per-project hygiene** — gitignore the generated `spec-kit-sessions/`, and drop a short
  `CLAUDE.md` so every session in that repo knows the KB exists. Automate it:

  ```bash
  # from your clone of this repo
  scripts/onboard-project.sh /path/to/your/project   # idempotent; commits nothing
  ```

  It adds `spec-kit-sessions/` to `.gitignore`, creates a starter `CLAUDE.md` (only if absent),
  and reports whether the project has a KB yet (→ run `/spec-kit:scan` if not).

## Commands

| Command | What it does |
|---------|--------------|
| `/spec-kit:scan` | Generate the Knowledge Base from the codebase (16 docs + `review-skills.md` + per-module docs). Run first on a new repo. |
| `/spec-kit:rescan` | Update the KB incrementally after code changes (git-diff aware). |
| `/spec-kit:build <requirement>` | 13-step pipeline: clarify → plan (impact + business flow) → code → multi-lens review → tests → run tests → evidence → update KB. |
| `/spec-kit:review [file]` | Two-phase review: quality checklist + business consistency vs the KB. Empty arg = current diff. |
| `/spec-kit:ask <question>` | Q&A grounded in the KB — plain language + Mermaid diagram + technical detail. |
| `/spec-kit:plan <epic>` | PO/BA: Epic → features → impact → user stories (Given/When/Then) → sprint plan. |
| `/spec-kit:map [scope]` | Dependency graph (imports/DI/calls/inheritance) → Mermaid, enriched with business meaning. |
| `/spec-kit:document <topic>` | Business↔code field-level technical document for a feature/entity/module. |
| `/spec-kit:help` | Show all commands + KB status for the current repo. |

**Recommended flow:** `scan` once → `ask` / `map` / `document` to understand → `plan` to break
down work → `build` to implement → `rescan` to keep the KB fresh.

---

## How this maps to the original extension

| Auto Spec Kit (VS Code + Copilot) | Spec Kit for Claude Code |
|-----------------------------------|--------------------------|
| `vscode.lm` calls to Copilot | Claude Code itself (no external API key) |
| `agent-orchestrator` parallel sub-agents | `Task` tool fan-out to the `agents/` specialists |
| Emits ```### FILE:``` code blocks to copy | Applies changes directly with Edit/Write |
| `testCommand` run by the extension | `Bash` runs the project's test command |
| Session outputs in `spec-kit-sessions/` | Same — artifacts saved per run |
| `knowledge-base/` (16 docs + review-skills + modules) | **Identical format — reused as-is** |
| Webview HTML (ask/plan/document/map) | Markdown + Mermaid (renders anywhere; HTML on request) |

### Not ported (and why)
- The VS Code UI bits (Quick Picks, webviews, keybindings, output channel) — Claude Code is
  the UI now. Q&A/plans/docs are returned as Markdown + Mermaid; ask for HTML if you want it.
- Token-budget/throttling/checkpoint-resume plumbing — Claude Code manages context and tools
  natively, so the methodology is preserved without the bespoke machinery.

---

## Notes
- Every command degrades gracefully if a repo has no `knowledge-base/` — it'll read source
  directly and suggest running `/spec-kit:scan`, but results are richer with a KB.
- `build` and `review` enforce the **"Architecture Invariants — DO NOT BREAK"** list from
  `knowledge-base/16-architecture-patterns.md` and the rules in `knowledge-base/review-skills.md`.
- Source of truth for the methodology: the original prompts in
  `../auto-spec-extension/src/` (pipeline steps, `constants/kb-steps.ts`,
  `resources/review-skills-universal.md`).
