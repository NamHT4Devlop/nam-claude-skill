#!/usr/bin/env bash
# Drift guards: commands/ ↔ skills/ ↔ extension ALLOWED ↔ help.md must stay in sync.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

# Intentional exceptions:
#   help — command-only (commands/help.md is documentation; there is no skills/namht-help/).
CMD_ONLY="help"
# Tokens that match the namht-* shape but are NOT skills — the artifact folder every skill
# writes to. Keep this list tiny; anything else matching namht-* must be a real skill/agent.
NON_SKILL="namht-sessions"

echo "consistency: commands reference existing skills"
bad=0
for f in commands/*.md; do
  base=$(basename "$f" .md)
  refs=$(grep -oE 'namht-[a-z-]+' "$f" | sort -u | grep -vxF "$NON_SKILL")
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

echo "consistency: extension card (media/main.js) per skill"
bad=0
cards=$(grep -oE "^  A\('namht-[a-z-]+'" vscode-extension/media/main.js | grep -oE "namht-[a-z-]+" | sort -u)
for s in $skills_set; do
  echo "$cards" | grep -qxF "$s" || { echo "  ✗ $s has no A(...) card in media/main.js"; bad=1; }
done
[ "$bad" -eq 0 ] && echo "  ✓ every skill has a UI card" || fail=1

echo "consistency: docs/skills-catalog.html lists every skill"
bad=0
rows=$(grep -oE 'class="name">namht-[a-z-]+' docs/skills-catalog.html | sed 's/.*>//' | sort -u)
for s in $skills_set; do
  echo "$rows" | grep -qxF "$s" || { echo "  ✗ $s has no row in docs/skills-catalog.html"; bad=1; }
done
for r in $rows; do
  [ -d "skills/$r" ] || { echo "  ✗ catalog lists $r but skills/$r/ does not exist"; bad=1; }
done
[ "$bad" -eq 0 ] && echo "  ✓ catalog covers every skill" || fail=1

# The counts are written by hand in several docs; drift there is invisible until someone counts.
echo "consistency: documented counts match reality"
bad=0
n_skills=$(ls -d skills/namht-*/ | wc -l | tr -d ' ')
n_cmds=$(ls commands/*.md | wc -l | tr -d ' ')
check_count() {  # file, regex with ONE capture group, expected, label
  local f="$1" re="$2" want="$3" label="$4" got
  got=$(grep -oE "$re" "$f" | grep -oE '[0-9]+' | head -1)
  [ -z "$got" ] && { echo "  ✗ $f: could not find the $label count (pattern changed?)"; bad=1; return; }
  [ "$got" = "$want" ] || { echo "  ✗ $f says $got $label, actual is $want"; bad=1; }
}
check_count README.md                    '# [0-9]+ skills \(the methodology' "$n_skills" skills
check_count README.md                    'The [0-9]+ skills and 7 sub-agents' "$n_skills" skills
check_count README.md                    '# [0-9]+ slash commands'           "$n_cmds"   commands
check_count docs/skills-catalog.html     '<b>[0-9]+</b> skills'              "$n_skills" skills
check_count vscode-extension/README.md   'all [0-9]+ skills'                 "$n_skills" skills
check_count docs/manual-setup-guide.html '# [0-9]+ skill →'                  "$n_skills" skills
check_count docs/manual-setup-guide.html '# [0-9]+ command'                  "$n_cmds"   commands
[ "$bad" -eq 0 ] && echo "  ✓ documented counts match ($n_skills skills / $n_cmds commands)" || fail=1

echo "consistency: version + changelog"
bad=0
plugin_v=$(grep -oE '"version": "[0-9.]+"' .claude-plugin/plugin.json | grep -oE '[0-9.]+')
grep -qF "## [$plugin_v]" CHANGELOG.md || { echo "  ✗ plugin.json is $plugin_v but CHANGELOG.md has no '## [$plugin_v]' entry"; bad=1; }
[ "$bad" -eq 0 ] && echo "  ✓ plugin version $plugin_v is in the changelog" || fail=1

echo "consistency: $([ "$fail" -eq 0 ] && echo PASS || echo FAIL)"
[ "$fail" -eq 0 ]
