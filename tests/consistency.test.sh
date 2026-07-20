#!/usr/bin/env bash
# Drift guards: commands/ ↔ skills/ ↔ extension ALLOWED ↔ help.md must stay in sync.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

# Intentional exceptions:
#   help — command-only (commands/help.md is documentation; there is no skills/namht-help/).
CMD_ONLY="help"

echo "consistency: commands reference existing skills"
bad=0
for f in commands/*.md; do
  base=$(basename "$f" .md)
  refs=$(grep -oE 'namht-[a-z-]+' "$f" | sort -u)
  if [ -z "$refs" ]; then echo "  ✗ $f references no namht-* skill"; bad=1; continue; fi
  for r in $refs; do
    [ -d "skills/$r" ] && continue
    [ -f "agents/$r.md" ] && continue   # sub-agents (namht-codebase-analyzer, …) are valid references
    short=${r#namht-}
    # help.md lists commands, so a command-only reference is fine there
    if [ "$base" = "help" ] && [ -f "commands/$short.md" ]; then continue; fi
    echo "  ✗ $f references $r — no skills/$r/ and no agents/$r.md"; bad=1
  done
done
[ "$bad" -eq 0 ] && echo "  ✓ command → skill references OK" || fail=1

echo "consistency: every skill has a matching command"
bad=0
for d in skills/namht-*/; do
  s=$(basename "$d"); short=${s#namht-}
  [ -f "commands/$short.md" ] || { echo "  ✗ skills/$s/ has no commands/$short.md"; bad=1; }
done
[ "$bad" -eq 0 ] && echo "  ✓ skill → command mapping OK" || fail=1

echo "consistency: extension ALLOWED == skills/namht-*/"
allowed=$(sed -n '/const ALLOWED = new Set(\[/,/\]);/p' vscode-extension/src/extension.ts | grep -oE "'namht-[a-z-]+'" | tr -d "'" | sort -u)
skills_set=$(for d in skills/namht-*/; do basename "$d"; done | sort -u)
if [ "$allowed" = "$skills_set" ]; then
  echo "  ✓ ALLOWED matches skills/"
else
  echo "  ✗ ALLOWED != skills/namht-*/ (< only in ALLOWED, > only in skills/):"
  diff <(echo "$allowed") <(echo "$skills_set") | grep '^[<>]' | sed 's/^/    /'
  fail=1
fi

echo "consistency: help.md mentions every command"
bad=0
for f in commands/*.md; do
  base=$(basename "$f" .md)
  [ "$base" = "$CMD_ONLY" ] && continue
  grep -qE "/namht-$base([^a-z-]|\$)" commands/help.md || { echo "  ✗ /namht-$base missing from commands/help.md"; bad=1; }
done
[ "$bad" -eq 0 ] && echo "  ✓ help.md covers every command" || fail=1

echo "consistency: $([ "$fail" -eq 0 ] && echo PASS || echo FAIL)"
[ "$fail" -eq 0 ]
