#!/usr/bin/env bash
# personal-install.sh — install Spec Kit for YOUR user only (zero footprint in any repo).
#
# It symlinks this repo's skills/agents/commands into ~/.claude so they are available in
# every project, but live only in your home dir — never inside (or committed to) a project.
# Commands are installed with a `spec-` prefix so they don't shadow built-ins like /help.
# Symlinks mean `git pull` in this repo instantly updates your installed copy.
#
# Usage:
#   scripts/personal-install.sh            # install / refresh
#   scripts/personal-install.sh uninstall  # remove everything it created
#
# Pick ONE install method — if you use this, do NOT also `/plugin install` the same plugin.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root
DEST="$HOME/.claude"
ACTION="${1:-install}"

SKILLS=(spec-build spec-scan spec-rescan spec-review spec-ask spec-plan spec-map spec-document)
AGENTS=(codebase-analyzer impact-detector business-flow-tracer security-reviewer \
        architecture-reviewer performance-reviewer business-consistency-reviewer)
# command file (in repo)  ->  installed as spec-<file>.md (avoids clashing with /help, /review…)
CMDS=(build scan rescan review ask plan map document help)

if [ "$ACTION" = "uninstall" ]; then
  echo "▶  Uninstalling Spec Kit (personal)…"
  for s in "${SKILLS[@]}"; do rm -f "$DEST/skills/$s"; done
  for a in "${AGENTS[@]}"; do rm -f "$DEST/agents/$a.md"; done
  for c in "${CMDS[@]}"; do rm -f "$DEST/commands/spec-$c.md"; done
  echo "✔  Removed all Spec Kit symlinks from $DEST (your repos were never touched)."
  exit 0
fi

echo "▶  Installing Spec Kit for this user only"
echo "   source: $SRC"
echo "   dest:   $DEST  (symlinks)"
mkdir -p "$DEST/skills" "$DEST/agents" "$DEST/commands"

for s in "${SKILLS[@]}"; do ln -sfn "$SRC/skills/$s"      "$DEST/skills/$s"; done
for a in "${AGENTS[@]}"; do ln -sfn "$SRC/agents/$a.md"   "$DEST/agents/$a.md"; done
for c in "${CMDS[@]}";   do ln -sfn "$SRC/commands/$c.md" "$DEST/commands/spec-$c.md"; done

echo "   ✅ ${#SKILLS[@]} skills, ${#AGENTS[@]} agents, ${#CMDS[@]} commands linked"
echo "✔  Done. Open Claude Code in any project and use /spec-build, /spec-ask, /spec-review, …"
echo "   (Skills also auto-activate from plain English — the slash commands are optional.)"
