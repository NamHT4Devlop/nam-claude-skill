#!/usr/bin/env bash
# Regression tests for hooks/git-guard.sh — the security-critical git guard.
# Asserts: remote-affecting + destructive git is DENIED; read/sync-in + whitelisted
# personal-repo push is ALLOWED. (Needs jq, which the guard itself uses.)
set -uo pipefail
cd "$(dirname "$0")/.."
GUARD=hooks/git-guard.sh
pass=0; fail=0

run() { printf '{"tool_input":{"command":"%s"}}' "$1" | bash "$GUARD"; }
deny()  { if run "$1" | grep -q '"permissionDecision":"deny"'; then pass=$((pass+1)); else echo "  ✗ expected BLOCK: $1"; fail=$((fail+1)); fi; }
allow() { local o; o=$(run "$1"); if [ -z "$o" ]; then pass=$((pass+1)); else echo "  ✗ expected ALLOW: $1"; fail=$((fail+1)); fi; }

echo "git-guard: BLOCK cases"
deny "git push https://github.com/acme-corp/app main"
deny "git push git@github.com:acme-corp/app.git"
deny "cd /tmp && git push https://github.com/acme-corp/app"
deny "git remote set-url origin x"
deny "git remote add up https://github.com/acme/x"
deny "git reset --hard HEAD~1"
deny "git clean -fd"
deny "git checkout -- file.ts"
deny "git checkout ."
deny "git restore src/"
deny "git rebase main"
deny "git branch -D feature"
deny "git commit --amend -m x"
deny "git send-email"
# regressions for audited bypasses (must stay BLOCKED)
deny "git clone https://github.com/NamHT4Devlop/x && git push https://github.com/acme-corp/secret main"
deny "git push https://evil.example/github.com/NamHT4Devlop/x main"
deny "git \\\"push\\\" git@github.com:acme-corp/app.git"
deny "git branch -d -f feature"
deny "git switch --discard-changes main"
deny "git switch -C wip"
deny "git stash drop"
deny "git stash clear"

echo "git-guard: ALLOW cases"
allow "git push https://github.com/NamHT4Devlop/nam-claude-skill main"
allow "git push git@github.com:NamHT4Devlop/x.git"
allow "git pull"
allow "git fetch --all"
allow "git status"
allow "git log --oneline -5"
allow "git diff HEAD"
allow "git add ."
allow "git commit -m fix-the-thing"
allow "git checkout main"
allow "git branch -d merged"
allow "ls -la"
# regressions for audited false positives (must stay ALLOWED)
allow "git log --grep rebase"
allow "git stash"
allow "git stash pop"
allow "git switch main"
allow "git clone https://github.com/NamHT4Devlop/x && git push https://github.com/NamHT4Devlop/y main"

echo "git-guard: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
