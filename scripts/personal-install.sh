#!/usr/bin/env bash
# personal-install.sh — install for YOUR user only (zero footprint in any repo).
#
# Symlinks this repo's skills/agents/commands into ~/.claude so they're available in every
# project but live only in your home dir — never inside (or committed to) a project repo.
# Everything is already named `namht-*`, so commands are /namht-build, /namht-ask, … (they
# don't shadow built-ins like /help). Symlinks mean `git pull` here instantly updates you.
#
# Usage:
#   scripts/personal-install.sh            # install / refresh (idempotent)
#   scripts/personal-install.sh uninstall  # remove only the symlinks pointing back here
#
# Pick ONE install method — if you use this, do NOT also `/plugin install` the same plugin.

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root
DEST="$HOME/.claude"

# Remove any symlink under $DEST/{skills,commands,agents} that resolves back into $SRC.
unlink_ours() {
  for sub in skills commands agents; do
    local dir="$DEST/$sub"
    [ -d "$dir" ] || continue
    for entry in "$dir"/*; do
      [ -L "$entry" ] || continue
      local target; target="$(readlink "$entry" || true)"
      case "$target" in
        "$SRC"/*) rm -f "$entry"; echo "   - removed $sub/$(basename "$entry")";;
      esac
    done
  done
}

if [ "${1:-install}" = "uninstall" ]; then
  echo "▶  Uninstalling (personal)…"
  unlink_ours
  echo "✔  Done. Removed our symlinks from $DEST — your repos were never touched."
  exit 0
fi

echo "▶  Installing for this user only"
echo "   source: $SRC"
echo "   dest:   $DEST  (symlinks)"
mkdir -p "$DEST/skills" "$DEST/agents" "$DEST/commands"
unlink_ours   # clean any stale links first (e.g. after a rename), then relink fresh

n_s=0; n_a=0; n_c=0
for d in "$SRC"/skills/*/;     do [ -d "$d" ] && ln -sfn "${d%/}" "$DEST/skills/$(basename "$d")"   && n_s=$((n_s+1)); done
for f in "$SRC"/agents/*.md;   do [ -f "$f" ] && ln -sfn "$f"     "$DEST/agents/$(basename "$f")"   && n_a=$((n_a+1)); done
for f in "$SRC"/commands/*.md; do [ -f "$f" ] && ln -sfn "$f"     "$DEST/commands/$(basename "$f")" && n_c=$((n_c+1)); done

echo "   ✅ linked $n_s skills, $n_a agents, $n_c commands"
echo "✔  Done. Open Claude Code in any project and use /namht-build, /namht-ask, /namht-review, …"
echo "   (Skills also auto-activate from plain English — slash commands are optional.)"
