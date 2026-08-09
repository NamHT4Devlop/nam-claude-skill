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

# Known git subcommands. Anything else is treated as an ALIAS and denied: an alias
# starting with `!` runs an arbitrary shell command, which would bypass every rule below
# (e.g. `git -c alias.zz='!sh -c ...' zz`). Fail closed — add legitimate names here.
GIT_SUBCOMMANDS=" add am annotate apply archive bisect blame branch bugreport bundle cat-file
check-attr check-ignore check-mailmap checkout cherry cherry-pick citool clean clone column commit
commit-tree config count-objects describe diff diff-files diff-index diff-tree difftool fast-export
fast-import fetch fetch-pack filter-branch filter-repo for-each-ref format-patch fsck gc
get-tar-commit-id grep gui hash-object help init instaweb interpret-trailers log ls-files ls-remote
ls-tree mailinfo mailsplit maintenance merge merge-base merge-file merge-index merge-one-file
merge-tree mergetool mktag mktree multi-pack-index mv name-rev notes p4 pack-objects pack-redundant
pack-refs patch-id prune prune-packed pull push quiltimport range-diff read-tree rebase reflog remote
repack replace request-pull rerere reset restore rev-list rev-parse revert rm send-email send-pack
shortlog show show-branch show-index show-ref sparse-checkout stash status stripspace submodule svn
switch symbolic-ref tag unpack-file unpack-objects update-index update-ref update-server-info var
verify-commit verify-pack verify-tag version whatchanged worktree write-tree "

# Hide credentials embedded in a remote URL before echoing it back into the transcript.
redact() { printf '%s' "$1" | sed -E 's#//[^/@]*@#//***@#g'; }

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

  # An env-var prefix (GIT_DIR=… git push) silently retargets the repo — refuse to reason about it.
  k=0
  while [ $k -lt $gi ]; do
    case "$(unq "${toks[$k]}")" in
      GIT_*=*) deny "git with a GIT_* environment override (can retarget the repository)";;
    esac
    k=$((k+1))
  done

  # subcommand = first non-option token after git and its global options
  sub=""; cdir=""; redirected=0
  i=$((gi+1))
  while [ $i -lt $n ]; do
    t=$(unq "${toks[$i]}")
    case "$t" in
      # `-c alias.x=!sh` / `--config-env=alias.x` define a shell alias → arbitrary command execution
      -c|--config-env)
        i=$((i+1))
        case "$(unq "${toks[$i]:-}")" in
          alias.*|*[[:space:]]alias.*) deny "git -c alias.* (defines an alias that can run arbitrary shell)";;
        esac;;
      -c=*|--config-env=*|-c*alias.*)
        case "$t" in *alias.*) deny "git -c alias.* (defines an alias that can run arbitrary shell)";; esac;;
      # --git-dir/--work-tree point git at another repo; both the space and = forms
      --git-dir|--work-tree) redirected=1; i=$((i+1));;
      --git-dir=*|--work-tree=*) redirected=1;;
      -C) i=$((i+1)); [ $i -lt $n ] && cdir=$(unq "${toks[$i]}");;
      --namespace|--super-prefix) i=$((i+1));;
      -*) ;;
      *) sub=$t; break;;
    esac
    i=$((i+1))
  done
  [ -z "$sub" ] && continue

  # Is `git` actually in command position (segment start, after env assignments/wrappers)? Prose that
  # merely mentions git — a commit message, a doc string — must not be classified as an invocation.
  cmdpos=1; k=0
  while [ $k -lt $gi ]; do
    case "$(unq "${toks[$k]}")" in
      *=*|sudo|env|command|nohup|time|exec) ;;
      *) cmdpos=0; break;;
    esac
    k=$((k+1))
  done

  # Unknown subcommand ⇒ an alias ⇒ possibly `!<shell>`. Refuse — but only for a real invocation.
  # (the list spans several lines — collapse the newlines before matching)
  if [ "$cmdpos" -eq 1 ]; then
    case " ${GIT_SUBCOMMANDS//[$'\n\t']/ } " in
      *" $sub "*) ;;
      *) deny "unknown git subcommand '$sub' — it may be an alias running an arbitrary shell command";;
    esac
  fi

  # quote-stripped arguments after the subcommand
  args=()
  j=$((i+1))
  while [ $j -lt $n ]; do args+=("$(unq "${toks[$j]}")"); j=$((j+1)); done

  # ── PUSH → whitelist by target remote owner (resolved from THIS segment) ────
  if [ "$sub" = push ]; then
    # A redirected repo (--git-dir/--work-tree) makes the target unknowable here — refuse.
    [ "$redirected" -eq 1 ] &&
      deny "git push with --git-dir/--work-tree (the real push target cannot be verified)"

    # The remote is the FIRST non-option token after `push` — never scan every argument
    # (a whitelisted URL inside a trailing comment or --push-option must not authorize a push).
    target=""
    for a in "${args[@]}"; do
      case "$a" in
        \#*) break;;          # rest of the line is a shell comment
        -*) continue;;
        *) target=$a; break;;
      esac
    done

    url=""
    case "$target" in
      https://*|ssh://*|git@*|http://*|ftp*://*|file://*) url=$target;;
      *)
        # resolve working dir: segment's `git -C <dir>`, else a leading cd/pushd, else the hook's cwd
        dir=$cdir
        [ -z "$dir" ] && dir=$(printf '%s' "$cmd" | sed -nE 's/.*(^|[;&|(){}[:space:]])(pushd|cd)[[:space:]]+([^ &;|)]+).*/\3/p' | head -1)
        [ -z "$dir" ] && dir=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
        [ -z "$dir" ] && dir="$PWD"
        dir="${dir/#\~/$HOME}"
        remote=${target:-origin}
        url=$(git -C "$dir" remote get-url "$remote" 2>/dev/null);;
    esac

    printf '%s' "$url" | grep -qE "$ALLOW_OWNER_RE" ||
      deny "git push to a remote NOT in the personal whitelist ($(redact "${url:-could not resolve remote}")) — only NamHT4Devlop/* may be pushed"
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
      for a in "${args[@]}"; do
        [ "$a" = --force ] && deny "git clean --force (deletes untracked files)"
        [[ $a =~ $CLEAN_F_RE ]] && deny "git clean -f (deletes untracked files)"
      done;;
    worktree)
      case "${args[0]:-}" in
        remove|prune) deny "git worktree ${args[0]} (deletes a worktree and its uncommitted work)";;
      esac;;
    checkout)
      for a in "${args[@]}"; do
        case "$a" in .|--|-f|--force) deny "git checkout that discards changes";; esac
      done;;
    restore) deny "git restore (loses changes)";;
    switch)
      for a in "${args[@]}"; do
        case "$a" in
          --discard-changes|--force) deny "git switch --force/--discard-changes (discards changes)";;
          --*) ;;
          -*[Cf]*) deny "git switch -C/-f (discards changes)";;
        esac
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
