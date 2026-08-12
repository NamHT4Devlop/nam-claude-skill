#!/usr/bin/env bash
# migrate-sessions.sh — rename a repo's legacy `spec-kit-sessions/` to `namht-sessions/`.
#
# The folder was renamed so it is not confused with GitHub's unrelated "Spec Kit"
# (github/spec-kit). Contents are identical; only the folder name changes.
#
# Usage:
#   scripts/migrate-sessions.sh [REPO ...]     # migrate each repo (default: current dir)
#   scripts/migrate-sessions.sh --dry-run REPO # show what would happen, change nothing
#
# Safe by design: never deletes anything. If BOTH folders exist it merges the legacy
# one in without overwriting a file that already exists on the new side, and leaves
# whatever could not be merged in place for you to look at.
set -euo pipefail

OLD="spec-kit-sessions"
NEW="namht-sessions"
DRY=0
targets=()

for a in "$@"; do
  case "$a" in
    --dry-run|-n) DRY=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) targets+=("$a") ;;
  esac
done
[ ${#targets[@]} -eq 0 ] && targets=(".")

run() { if [ "$DRY" = 1 ]; then echo "   would: $*"; else "$@"; fi; }

status=0
for repo in "${targets[@]}"; do
  if [ ! -d "$repo" ]; then echo "✗ $repo — not a directory"; status=1; continue; fi
  old="$repo/$OLD"; new="$repo/$NEW"

  if [ ! -d "$old" ]; then
    echo "• $repo — no $OLD/ (nothing to do)"
    continue
  fi

  if [ ! -e "$new" ]; then
    echo "→ $repo — renaming $OLD/ → $NEW/"
    run mv "$old" "$new"
    continue
  fi

  echo "→ $repo — both folders exist, merging $OLD/ into $NEW/ (no overwrites)"
  # -n = never overwrite an existing destination file.
  while IFS= read -r f; do
    rel="${f#"$old"/}"
    dest="$new/$rel"
    if [ -e "$dest" ]; then
      echo "   skip (already there): $rel"
      continue
    fi
    run mkdir -p "$(dirname "$dest")"
    run cp -p "$f" "$dest"
  done < <(find "$old" -type f)

  if [ "$DRY" = 0 ]; then
    # Drop the legacy tree only when everything in it now exists on the new side.
    leftover=0
    while IFS= read -r f; do
      [ -e "$new/${f#"$old"/}" ] || leftover=1
    done < <(find "$old" -type f)
    if [ "$leftover" = 0 ]; then
      rm -rf "$old"
      echo "   merged; removed $OLD/"
    else
      echo "   ⚠ some files could not be merged — $OLD/ left in place, review it yourself"
      status=1
    fi
  fi
done

cat <<EOF

Reminder — the machine-wide ignore should list BOTH names while legacy folders exist:
  grep -q '^namht-sessions/\$' ~/.gitignore_global || echo 'namht-sessions/' >> ~/.gitignore_global
EOF
exit $status
