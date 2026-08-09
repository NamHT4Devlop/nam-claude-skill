#!/usr/bin/env bash
# onboard-project.sh — apply Spec Kit per-project hygiene (AI-engineering principles)
#
# What it does (idempotent, safe to re-run):
#   1. Adds `spec-kit-sessions/` to the project's .gitignore (generated artifacts).
#   2. Creates a starter CLAUDE.md ONLY if none exists, telling Claude Code that this
#      project has a knowledge-base/ and to use the Spec Kit commands.
#   3. Reports Knowledge Base status and the recommended next step.
#
# It does NOT touch your source, your KB, or commit anything. Review and commit yourself.
#
# Usage:
#   scripts/onboard-project.sh [PROJECT_DIR]      # default: current directory
#   scripts/onboard-project.sh ~/AI-TOOL/human-essentials

set -euo pipefail

PROJECT_DIR="${1:-$(pwd)}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ Not a directory: $PROJECT_DIR" >&2
  exit 1
fi
cd "$PROJECT_DIR"
NAME="$(basename "$PROJECT_DIR")"
echo "▶  Onboarding project: $NAME  ($PROJECT_DIR)"

# 1) gitignore generated session artifacts ------------------------------------
GI=".gitignore"
ensure_ignore() {
  local pattern="$1"
  touch "$GI"
  if ! grep -qxF "$pattern" "$GI" 2>/dev/null; then
    printf '%s\n' "$pattern" >> "$GI"
    echo "   ✅ .gitignore += $pattern"
  else
    echo "   •  .gitignore already has $pattern"
  fi
}
ensure_ignore "spec-kit-sessions/"
# knowledge-base/ is a full business analysis of the codebase — it must never land in a team repo.
ensure_ignore "knowledge-base/"

# 2) starter CLAUDE.md (only if missing) --------------------------------------
if [ -f "CLAUDE.md" ] || [ -f ".claude/CLAUDE.md" ]; then
  echo "   •  CLAUDE.md already exists — left untouched"
else
  cat > CLAUDE.md <<EOF
# $NAME

## Project knowledge
This repo has a Spec Kit **Knowledge Base** in \`knowledge-base/\` — the source of truth for
business rules, domain model, core flows, conventions, and architecture invariants. Ground
answers and changes in it; keep it updated with \`/spec-kit:rescan\` after meaningful changes.

## Spec Kit commands (installed globally)
- \`/spec-kit:ask\` — Q&A grounded in the KB
- \`/spec-kit:build\` — plan → code → review → test → evidence
- \`/spec-kit:review\` — two-phase review (quality + business consistency)
- \`/spec-kit:plan\` / \`:map\` / \`:document\` / \`:rescan\` — see \`/spec-kit:help\`

## Conventions
- Do NOT break the "Architecture Invariants — DO NOT BREAK" list in
  \`knowledge-base/16-architecture-patterns.md\`.
<!-- TODO: add this project's test command, language, and any local notes. -->
EOF
  echo "   ✅ Created starter CLAUDE.md (edit the TODO line)"
fi

# 3) KB status ----------------------------------------------------------------
if [ -d "knowledge-base" ] && ls knowledge-base/*.md >/dev/null 2>&1; then
  COUNT="$(ls knowledge-base/*.md 2>/dev/null | wc -l | tr -d ' ')"
  MODS=0; [ -d "knowledge-base/modules" ] && MODS="$(ls knowledge-base/modules/*.md 2>/dev/null | wc -l | tr -d ' ')"
  echo "   ✅ Knowledge Base present: $COUNT docs, $MODS module docs"
  echo "▶  Next: cd into this project, run 'claude', then use /spec-kit:ask or /spec-kit:build"
else
  echo "   ⚠  No knowledge-base/ found"
  echo "▶  Next: cd into this project, run 'claude', then run /spec-kit:scan to generate the KB"
fi
echo "✔  Done: $NAME"
