#!/usr/bin/env bash
# personal-install.test.sh — this is the only script in the kit that DELETES files under a user's
# ~/.claude. It was untestable (DEST was hardcoded) and therefore untested, so a regression that
# widened `unlink_ours` would quietly remove someone's own skills on the next update.
#
# NAMHT_CLAUDE_DIR points it at a throwaway directory; the real ~/.claude is never touched.
set -uo pipefail
cd "$(dirname "$0")/.."
INSTALL="$PWD/scripts/personal-install.sh"
pass=0; fail=0
ok()   { echo "  ✓ $1"; pass=$((pass+1)); }
bad()  { echo "  ✗ $1"; fail=$((fail+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want '$3', got '$2')"; fi; }

TMP=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/personal-install.XXXXXX")" && pwd); trap 'rm -rf "$TMP"' EXIT
export NAMHT_CLAUDE_DIR="$TMP/dotclaude"

echo "personal-install: install links skills, commands (prefixed) and agents"
"$INSTALL" >/dev/null 2>&1
skills=$(ls -d "$NAMHT_CLAUDE_DIR"/skills/namht-*/ 2>/dev/null | wc -l | tr -d ' ')
repo_skills=$(ls -d skills/namht-*/ | wc -l | tr -d ' ')
check "every skill linked"        "$skills" "$repo_skills"
check "commands carry the namht- prefix" "$([ -e "$NAMHT_CLAUDE_DIR/commands/namht-build.md" ] && echo yes || echo no)" yes
check "links are symlinks, not copies"   "$([ -L "$NAMHT_CLAUDE_DIR/skills/namht-build" ] && echo yes || echo no)" yes
check "the guard hook is installed"      "$([ -e "$NAMHT_CLAUDE_DIR/hooks/namht-git-guard.sh" ] && echo yes || echo no)" yes

echo "personal-install: re-running is idempotent"
before=$(find "$NAMHT_CLAUDE_DIR" -maxdepth 2 | sort | md5 2>/dev/null || find "$NAMHT_CLAUDE_DIR" -maxdepth 2 | sort | md5sum)
"$INSTALL" >/dev/null 2>&1
after=$(find "$NAMHT_CLAUDE_DIR" -maxdepth 2 | sort | md5 2>/dev/null || find "$NAMHT_CLAUDE_DIR" -maxdepth 2 | sort | md5sum)
check "tree unchanged on second run" "$after" "$before"

echo "personal-install: uninstall removes ONLY this kit's links"
# a foreign skill (real dir) and a foreign symlink pointing outside the repo must both survive
mkdir -p "$TMP/elsewhere/my-own-skill" "$NAMHT_CLAUDE_DIR/skills"
printf 'name: my-own-skill\n' > "$TMP/elsewhere/my-own-skill/SKILL.md"
ln -s "$TMP/elsewhere/my-own-skill" "$NAMHT_CLAUDE_DIR/skills/my-own-skill"
mkdir -p "$NAMHT_CLAUDE_DIR/commands"; printf '# mine\n' > "$NAMHT_CLAUDE_DIR/commands/my-command.md"
"$INSTALL" uninstall >/dev/null 2>&1
check "kit skills gone"           "$(ls -d "$NAMHT_CLAUDE_DIR"/skills/namht-*/ 2>/dev/null | wc -l | tr -d ' ')" 0
check "foreign symlink survived"  "$([ -L "$NAMHT_CLAUDE_DIR/skills/my-own-skill" ] && echo yes || echo no)" yes
check "foreign target untouched"  "$([ -f "$TMP/elsewhere/my-own-skill/SKILL.md" ] && echo yes || echo no)" yes
check "foreign real file survived" "$([ -f "$NAMHT_CLAUDE_DIR/commands/my-command.md" ] && echo yes || echo no)" yes

echo "personal-install: the real ~/.claude was never a target"
check "override honoured" "$(printf '%s' "$NAMHT_CLAUDE_DIR" | grep -c "^$TMP")" 1

echo "personal-install: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
