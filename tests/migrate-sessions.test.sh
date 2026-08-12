#!/usr/bin/env bash
# migrate-sessions.test.sh — scripts/migrate-sessions.sh touches a user's REAL session data in
# other repos, so every branch gets a fixture test. The rule it must never break: no data loss.
set -uo pipefail
cd "$(dirname "$0")/.."
SCRIPT="$PWD/scripts/migrate-sessions.sh"
pass=0; fail=0
ok()   { echo "  ✓ $1"; pass=$((pass+1)); }
bad()  { echo "  ✗ $1"; fail=$((fail+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want '$3', got '$2')"; fi; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# --- fixture: a repo with only the legacy folder ---------------------------------
mk_legacy() {
  local r="$TMP/$1"; rm -rf "$r"; mkdir -p "$r/spec-kit-sessions/answers" "$r/spec-kit-sessions/builds"
  printf 'old answer\n'  > "$r/spec-kit-sessions/answers/a.md"
  printf 'old journal\n' > "$r/spec-kit-sessions/answers/_journal.md"
  printf 'old build\n'   > "$r/spec-kit-sessions/builds/b.md"
  echo "$r"
}

echo "migrate-sessions: --dry-run changes nothing"
r=$(mk_legacy dry)
"$SCRIPT" --dry-run "$r" >/dev/null 2>&1
check "legacy folder still there"  "$([ -d "$r/spec-kit-sessions" ] && echo yes || echo no)" yes
check "new folder NOT created"     "$([ -e "$r/namht-sessions"    ] && echo yes || echo no)" no

echo "migrate-sessions: plain rename when only the legacy folder exists"
r=$(mk_legacy plain)
"$SCRIPT" "$r" >/dev/null 2>&1
check "legacy folder gone"         "$([ -e "$r/spec-kit-sessions" ] && echo yes || echo no)" no
check "new folder exists"          "$([ -d "$r/namht-sessions"    ] && echo yes || echo no)" yes
check "nested file preserved"      "$(cat "$r/namht-sessions/builds/b.md" 2>/dev/null)" "old build"
check "file count preserved"       "$(find "$r/namht-sessions" -type f | wc -l | tr -d ' ')" 3

echo "migrate-sessions: merge without overwriting when BOTH exist"
r=$(mk_legacy merge)
mkdir -p "$r/namht-sessions/answers"
printf 'NEW journal\n' > "$r/namht-sessions/answers/_journal.md"   # same relative path, different content
printf 'new only\n'    > "$r/namht-sessions/answers/n.md"
"$SCRIPT" "$r" >/dev/null 2>&1
check "existing file NOT overwritten" "$(cat "$r/namht-sessions/answers/_journal.md")" "NEW journal"
check "legacy-only file carried over" "$(cat "$r/namht-sessions/answers/a.md" 2>/dev/null)" "old answer"
check "new-only file untouched"       "$(cat "$r/namht-sessions/answers/n.md")" "new only"
check "nested legacy dir carried"     "$(cat "$r/namht-sessions/builds/b.md" 2>/dev/null)" "old build"
check "legacy folder removed"         "$([ -e "$r/spec-kit-sessions" ] && echo yes || echo no)" no

echo "migrate-sessions: nothing to do is not an error"
r="$TMP/empty"; mkdir -p "$r"
"$SCRIPT" "$r" >/dev/null 2>&1
check "exit 0 with no legacy folder" "$?" 0
check "no folder invented"           "$([ -e "$r/namht-sessions" ] && echo yes || echo no)" no

echo "migrate-sessions: a missing directory is reported, not silently skipped"
"$SCRIPT" "$TMP/does-not-exist" >/dev/null 2>&1
check "exit non-zero for a bad path" "$([ $? -ne 0 ] && echo yes || echo no)" yes

echo "migrate-sessions: filenames with spaces survive"
r="$TMP/spaces"; rm -rf "$r"; mkdir -p "$r/spec-kit-sessions/qa reports"
printf 'spaced\n' > "$r/spec-kit-sessions/qa reports/my report.md"
mkdir -p "$r/namht-sessions"; printf 'x\n' > "$r/namht-sessions/keep.md"   # force the merge path
"$SCRIPT" "$r" >/dev/null 2>&1
check "spaced path carried over" "$(cat "$r/namht-sessions/qa reports/my report.md" 2>/dev/null)" "spaced"

echo "migrate-sessions: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
