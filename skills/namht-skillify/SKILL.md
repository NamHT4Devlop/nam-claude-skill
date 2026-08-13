---
name: namht-skillify
description: >-
  Scaffold a NEW namht-* skill (and its command) from a description, following
  this toolkit's conventions, so the user can self-extend the kit. Use when the
  user says "/skillify", "create a new skill", "add a skill for X", "turn this
  workflow into a skill", "make a command for …".
---

# namht-skillify — create a new skill the right way

Meta-skill: scaffold a new `namht-*` skill + command that matches this repo's standard, then wire
and document it. Operate inside the `nam-claude-skill` repo (the toolkit source, e.g. `~/nam-claude-skill`).

## Steps
1. **Clarify** the new skill: name (kebab, will become `namht-<name>`), one-line purpose, when it
   should trigger, inputs, output, whether it needs the HTML renderer or the review checklist.
2. **Create `skills/namht-<name>/SKILL.md`** with frontmatter:
   - `name: namht-<name>` (MUST equal the folder name), `description: >-` a 1–3 sentence trigger
     description (when to use + key verbs/aliases). Body = the methodology, grounded in the KB
     where relevant, with a clear Output section and Rules. Reuse the house style: KB-first,
     dual-audience output, change-discipline if it edits code.
3. **Create `commands/<name>.md`** (UNPREFIXED filename) — thin entry: frontmatter `description` +
   `argument-hint`, body "Use the **namht-<name>** skill to … $ARGUMENTS".
4. **If it needs bundles** (HTML render / review checklist): add `namht-<name>` to the right list in
   `scripts/sync-bundles.sh` (`map_html` for the renderer, `map_review` for the checklist), then run
   `bash scripts/sync-bundles.sh`.
5. **Register it in EVERY place a skill is listed.** Missing one is how the kit drifts — and
   `tests/consistency.test.sh` fails on each of these, so check them off before running it:
   - `vscode-extension/src/extension.ts` → add the command to the **`ALLOWED`** set (and to
     `EDITS_CODE` if it modifies source).
   - `vscode-extension/media/main.js` → add an `A(...)` **card** in `ACTIONS`: pick the category,
     an icon, a short title/description, the form fields, and the `build(v)` that assembles the
     arguments. Pass `true` as the last argument if it edits code.
   - `vscode-extension/media/i18n.js` → Vietnamese strings for the new card's title, description
     and every field label (or list the term in `I18N_VI_SAME` if it stays English on purpose) —
     `tests/i18n.test.cjs` fails the suite otherwise.
   - `commands/help.md` → one table row.
   - `README.md` → the command table row (and the skill/command counts near the top).
   - `docs/skills-catalog.html` → one `<tr>` with the **Edits code / Read-only** badge, and bump the
     `<b>N</b> skills` fact.
   - `docs/manual-setup-guide.html` → the file counts shown in the copy-paste blocks.
   - `CHANGELOG.md` → an entry under **Added** (MINOR bump; MAJOR only if users must act).
6. **Install:** `bash scripts/personal-install.sh` (symlinks the new skill + command into `~/.claude`).
7. **Verify:** `bash tests/run.sh` — it checks skill-name==folder, bundle sync, `ALLOWED` ↔ `skills/`,
   command ↔ skill, `help.md` coverage, catalog coverage and the documented counts.

## Rules
- Follow the established conventions exactly (naming, unprefixed command files, frontmatter shape,
  references via sync) so audit/tests stay green — don't invent a new structure.
- Keep the new skill focused (one job) and the description trigger-friendly.
- Don't duplicate an existing skill — check `commands/` first; extend instead if overlap.
- Commit message must NOT contain the literal phrase a git command would match (e.g. "git push") on
  one line — it trips the git-guard. Commit and push as separate commands.
