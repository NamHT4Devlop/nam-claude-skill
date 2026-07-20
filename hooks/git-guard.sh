#!/usr/bin/env bash
# git-guard.sh — Claude Code PreToolUse hook (Bash).
#
# Policy:
#   • git push          → ALLOWED only to a WHITELISTED personal remote (see ALLOW_OWNER_RE);
#                         pushes to any other remote (team/org repos) are BLOCKED.
#   • other remote ops  → BLOCKED (remote add/set-url/…, send-email, svn dcommit, p4 submit, config remote.*)
#   • destructive local → BLOCKED (reset --hard, clean -f, checkout --/./-f, restore,
#                         switch -C/--discard-changes, stash drop/clear, branch -D / -d -f,
#                         commit --amend, rebase, filter-branch, reflog expire, gc --prune, update-ref -d)
#   • everything else   → ALLOWED (fetch, pull, status, log, diff, show, blame, add, commit, stash,
#                         merge, checkout <branch>, …)
#
# Robust: splits chained commands on ; && || | & into SEGMENTS, resolves each
# segment's git SUBCOMMAND (the first non-option token after git and its global
# options like -C <dir>; surrounding quotes are stripped so `git "push"` cannot
# slip through), then applies the rules per subcommand — so rule words inside
# unrelated arguments (`git log --grep rebase`, `git checkout restore`) do not
# false-positive. Push targets are resolved from the push's own segment only.
# Quotes are NOT honored when splitting segments: conservative on purpose.

# ── EDIT ME: personal namespaces allowed to receive pushes ────────────────────
# Anchored at the start of the URL, so hosts like evil.example/github.com/… or
# github.com@evil.example cannot impersonate github.com.
# Add more owners: (NamHT4Devlop|my-other-user)
ALLOW_OWNER_RE='^(https://([^@/]+@)?|ssh://([^@/]+@)?|git@)github\.com[:/](NamHT4Devlop)/'

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0
printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_])git([^[:alnum:]_]|$)' || exit 0

deny() {
  local msg="🚫 namht git-guard blocked this command: $1
Allowed: read/sync git (fetch·pull·status·log·diff·show·blame·add·commit·stash·merge·checkout <branch>) and PUSH to a whitelisted personal repo. Forbidden: pushing to other repos + destructive operations. Need something else → run it yourself in a terminal."
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' \
    "$(printf '%s' "$msg" | jq -Rs .)"
  exit 0
}

set -f   # we word-split command text below; never glob-expand it

# Strip shell quoting/grouping chars from a token for classification
# ("push" → push, \git → git, $(git → $git). $ is deliberately KEPT: stripping
# it could make a hostname like gith$ub.com look whitelisted.
unq() {
  local t=$1 bt='`'
  t=${t//\"/}; t=${t//\'/}; t=${t//\\/}
  t=${t//$bt/}; t=${t//\(/}; t=${t//\)/}
  printf '%s' "$t"
}

# ── split the command into segments on ; && || | & (and newlines) ─────────────
s=${cmd//$'\n'/;}
s=${s//\|/;}
s=${s//&/;}
oldIFS=$IFS; IFS=';'; segs=($s); IFS=$oldIFS

CLEAN_F_RE='^-[A-Za-z]*f'

for seg in "${segs[@]}"; do
  toks=($seg)
  n=${#toks[@]}
  [ "$n" -eq 0 ] && continue

  # find the `git` word (also /usr/bin/git, \git, "git", $(git …)
  gi=-1; i=0
  while [ $i -lt $n ]; do
    t=$(unq "${toks[$i]}")
    case "$t" in git|*/git|\$git) gi=$i; break;; esac
    i=$((i+1))
  done
  [ $gi -lt 0 ] && continue

  # subcommand = first non-option token after git and its global options
  sub=""; cdir=""
  i=$((gi+1))
  while [ $i -lt $n ]; do
    t=$(unq "${toks[$i]}")
    case "$t" in
      -C) i=$((i+1)); [ $i -lt $n ] && cdir=$(unq "${toks[$i]}");;
      -c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env) i=$((i+1));;
      -*) ;;
      *) sub=$t; break;;
    esac
    i=$((i+1))
  done
  [ -z "$sub" ] && continue

  # quote-stripped arguments after the subcommand
  args=()
  j=$((i+1))
  while [ $j -lt $n ]; do args+=("$(unq "${toks[$j]}")"); j=$((j+1)); done

  # ── PUSH → whitelist by target remote owner (resolved from THIS segment) ────
  if [ "$sub" = push ]; then
    # URL only from the tokens AFTER `push` in this segment
    url=""
    for a in "${args[@]}"; do
      u=$(printf '%s' "$a" | grep -oE '(https://[^ ]+|ssh://[^ ]+|git@[^ ]+)' | head -1)
      [ -n "$u" ] && { url=$u; break; }
    done
    if [ -z "$url" ]; then
      # resolve working dir: segment's `git -C <dir>`, else leading `cd <dir>`, else hook cwd, else $PWD
      dir=$cdir
      [ -z "$dir" ] && dir=$(printf '%s' "$cmd" | sed -nE 's/.*(^|[;&|[:space:]])cd[[:space:]]+([^ &;|]+).*/\2/p' | head -1)
      [ -z "$dir" ] && dir=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
      [ -z "$dir" ] && dir="$PWD"
      dir="${dir/#\~/$HOME}"
      # remote name = first non-option token after 'push' (default origin)
      remote=""
      for a in "${args[@]}"; do
        case "$a" in -*) continue;; *) remote=$a; break;; esac
      done
      [ -z "$remote" ] && remote=origin
      url=$(git -C "$dir" remote get-url "$remote" 2>/dev/null)
    fi
    printf '%s' "$url" | grep -qE "$ALLOW_OWNER_RE" ||
      deny "git push to a remote NOT in the personal whitelist (${url:-could not resolve remote}) — only NamHT4Devlop/* may be pushed"
    continue   # whitelisted push → still check the remaining segments
  fi

  case "$sub" in
    # ── other REMOTE-affecting → forbidden ────────────────────────────────────
    remote)
      case "${args[0]:-}" in
        add|remove|rm|rename|set-url|set-head|set-branches|prune) deny "git remote changes the remote config";;
      esac;;
    send-email) deny "git send-email";;
    svn) [ "${args[0]:-}" = dcommit ] && deny "git svn dcommit";;
    p4)  [ "${args[0]:-}" = submit ]  && deny "git p4 submit";;
    config)
      for a in "${args[@]}"; do
        case "$a" in *remote.*) deny "modifies git config remote.*";; esac
      done;;

    # ── destructive LOCAL → forbidden ─────────────────────────────────────────
    reset)
      for a in "${args[@]}"; do [ "$a" = --hard ] && deny "git reset --hard (loses changes)"; done;;
    clean)
      for a in "${args[@]}"; do [[ $a =~ $CLEAN_F_RE ]] && deny "git clean -f (deletes untracked files)"; done;;
    checkout)
      for a in "${args[@]}"; do
        case "$a" in .|--|-f|--force) deny "git checkout that discards changes";; esac
      done;;
    restore) deny "git restore (loses changes)";;
    switch)
      for a in "${args[@]}"; do
        case "$a" in -C|--discard-changes) deny "git switch -C/--discard-changes (discards changes)";; esac
      done;;
    stash)
      case "${args[0]:-}" in drop|clear) deny "git stash drop/clear (deletes stashed work)";; esac;;
    branch)
      del=0; force=0
      for a in "${args[@]}"; do
        case "$a" in
          --delete) del=1;;
          --force)  force=1;;
          --*) ;;
          -*D*) deny "git branch -D (deletes a branch, loses commits)";;
          -*)
            case "$a" in *d*) del=1;; esac
            case "$a" in *f*) force=1;; esac;;
        esac
      done
      [ "$del" -eq 1 ] && [ "$force" -eq 1 ] && deny "git branch -d -f (force-deletes a branch, loses commits)";;
    commit)
      for a in "${args[@]}"; do [ "$a" = --amend ] && deny "git commit --amend (rewrites history)"; done;;
    rebase) deny "git rebase (rewrites history)";;
    filter-branch|filter-repo) deny "git filter-branch/filter-repo";;
    reflog) [ "${args[0]:-}" = expire ] && deny "git reflog expire";;
    gc)
      for a in "${args[@]}"; do case "$a" in --prune*) deny "git gc --prune";; esac; done;;
    update-ref)
      for a in "${args[@]}"; do [ "$a" = -d ] && deny "git update-ref -d"; done;;
  esac
done

exit 0
