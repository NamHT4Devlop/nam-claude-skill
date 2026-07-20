#!/usr/bin/env bash
# Run the full test suite. Used locally and by CI.
set -uo pipefail
cd "$(dirname "$0")/.."
rc=0
echo "== bundles in sync? =="; bash scripts/sync-bundles.sh --check || rc=1
echo; echo "== git-guard =="; bash tests/git-guard.test.sh || rc=1
echo; echo "== smoke =="; bash tests/smoke.test.sh || rc=1
echo; echo "== skill name == folder? =="
names_rc=0
for d in skills/*/; do d=${d%/}; n=$(grep -m1 '^name:' "$d/SKILL.md" | awk '{print $2}'); [ "$n" = "$(basename "$d")" ] || { echo "  ✗ $(basename "$d") != $n"; names_rc=1; }; done
[ "$names_rc" -eq 0 ] && echo "  ✓ skill names OK" || rc=1
echo; echo "== consistency =="; bash tests/consistency.test.sh || rc=1
echo; [ "$rc" -eq 0 ] && echo "✅ ALL TESTS PASSED" || echo "❌ TESTS FAILED"
exit $rc
