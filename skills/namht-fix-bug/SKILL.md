---
name: namht-fix-bug
description: >-
  Diagnose and fix a bug from a symptom OR a QA bug report (expected-vs-actual, repro steps, the
  environment, a failing test case / acceptance criterion): TRIAGE whether it's really a code defect
  (vs a config / env-var / data / migration / feature-flag / deploy-skew / spec-ambiguity issue),
  reproduce (environment-aware), find the ROOT CAUSE, assess blast radius, write a failing regression
  test tied to the broken AC, apply a minimal surgical fix, verify (tests + build) with rollback, and
  produce a hotfix report — then close the loop back to QA. Use when the user says "fix bug", "QA found
  a bug", "bug on staging/prod", "hotfix", "/fix-bug", "this is erroring", "incident", or pastes an
  error / a failing test case.
---

# namht-fix-bug — bug (or QA report) → triage → root cause → surgical fix → regression test → back to QA

A focused hotfix pipeline, distinct from `/namht-build` (which builds features). Production / a QA
environment = high stakes, so the bias is: **understand deeply, confirm it's actually a code bug,
change minimally, prove it with a test, don't break anything else, then hand it back to QA to
re-verify.** Ground in the code (structure/blast radius) + `knowledge-base/` (business rules) + the
user story / acceptance criteria the bug violated.

## Ground rules
- **Confirm it's a CODE bug first.** A bug found in a deployed environment is often *not* a code
  defect — it can be config, an env var, data/migration state, a feature flag, version skew between
  services, or an ambiguous/wrong spec. **Don't change code until you've ruled those out** — fixing
  code for a config/spec problem is the classic wrong fix.
- **Root cause, not band-aid.** Fix *why* it breaks, not the visible symptom. State the root cause
  explicitly before touching code.
- **Restore the INTENDED behavior.** "Correct" = what the acceptance criterion / business rule
  actually requires — not just making the error disappear. Tie the fix to that AC/rule.
- **Minimal, surgical, reversible.** Smallest diff that fixes the root cause; respect the
  "Architecture Invariants — DO NOT BREAK" and conventions; no drive-by refactors (see the change
  discipline in `namht-build`). For risky fixes prefer a guard/feature-flag and note a rollback.
- **Reuse before you create — MANDATORY.** The fix must use what the repo already has — an existing
  validator, guard, helper, service, mapper or **installed library** — instead of a new one-off. Search
  by *capability*, not just by name (grep synonyms, read the sibling files in the same module). Create
  something new ONLY when nothing suitable exists, and say why; **never add a dependency** an installed
  library already covers without the user's OK. A hotfix that duplicates logic the project already has
  is a failed fix — and if the same defect pattern exists elsewhere (Step 6), fix it at the shared
  source rather than patching each copy.
- **Prove it with a test** that FAILS before the fix and PASSES after, mapped to the failing QA case.
- **Read the code path first** — from the trace/repro, Read the failing files and grep for callers to
  get the exact code path + blast radius before changing anything.
- **Never deploy/push.** Produce the fix + test locally; the human deploys. (git-guard blocks pushes.)

## Pipeline

### 1. Intake — capture the QA bug report precisely
Gather (ask 2–4 targeted questions if missing — don't guess):
- **Expected vs Actual** — what should happen vs what happened (the crux of a QA report).
- **Reproduction steps** + the exact **input/data** used, and whether it's **consistent or intermittent**.
- **Environment** — which env (local/dev/staging/prod), build/commit/version, and **when it started**
  (right after a deploy? a data change? a config/flag change?).
- **Traceability** — the **failing test case ID / acceptance criterion / user story** it came from, if
  QA has one (from a `/namht-qa` plan). This defines "correct".
- Error text / **stack trace** / screenshots / logs, affected endpoint/feature/job, severity/urgency.
Also skim `spec-kit-sessions/answers/_journal.md` if present — a past Q&A about this area may already
name the flow/files involved (cheap: one small index).

### 2. TRIAGE — is this even a code bug? (do this BEFORE editing code)
Classify the root cause into one of these, gathering the matching evidence:
- **Code defect** → proceed to step 3.
- **Config / env-var** → compare the failing env's config to a working one; a value missing/wrong here
  but not locally is the tell. → the fix is config, not code (say so, hand back).
- **Data / migration** → the env's data or schema/Flyway state differs (a migration not run, bad rows).
  → fix = migration/data, possibly via `/namht-migrate`.
- **Feature flag / deploy skew** → a flag off/on, or services on mismatched versions (API/consumer,
  or an SQS message shape changed). → fix = flag/rollout/coordination, not necessarily this repo.
- **Spec / AC ambiguity** → the code does exactly what the story/AC said, but the AC was wrong or
  ambiguous. → this is a **spec bug**: don't "fix" correct code; flag it, propose the AC change
  (loop to `/namht-plan` or `/namht-user-story` to correct the story), and confirm with the user.
- **Environment-only (can't reproduce locally)** → don't force a local repro. Pull env evidence:
  logs via `/namht-splunk-report` or the structured fields from `/namht-observe` (filter by the
  correlation id / the failing request), the config/env diff, the recent **deploy commit range**
  (`git log` since the last good deploy), and the data/flag state. Diagnose from that and say the
  repro is evidence-based, not local.

State your classification with evidence. **Only continue to a code fix if it's a genuine code defect.**

### 3. Locate the code path
From the trace/repro, find the exact failing code: Read the top files and **grep the failing
function** → its source + callers; map the request/flow end-to-end (entry → service → data) via KB
`10-core-flows` / `modules/`. Identify the precise function(s) and line(s).

### 4. Reproduce (environment-aware)
Reproduce locally where feasible: run the failing test, hit the endpoint, or write a tiny harness with
the offending input; confirm the same symptom. **If it only reproduces in the deployed env**, use the
env evidence from step 2 (logs/config/data/deploy diff) and proceed on that, flagging that local repro
wasn't possible and what would confirm it.

### 5. Root-cause analysis (tie it to the AC)
Trace **why**: follow the data/state through the call path — inputs, nulls, types, edge cases,
concurrency, error handling, assumptions, and any env-specific condition. Distinguish the **root
cause** (real defect) from the **symptom**. Write it plainly:
> *"Root cause: `X` in `file:func` does Y when Z, because … (env: only when <condition>)"* — cite lines.
Name **which acceptance criterion / business rule the bug violated** (from the story or KB), or note it
exposed an **under-enforced** rule. If the code actually matched the AC → it's a spec bug (step 2).

### 6. Blast radius
Grep the callers/impact of the function you'll change → every consumer to re-verify. Does the **same
defect pattern** exist elsewhere (search siblings)? For a multi-repo/SQS system, check cross-service
consumers via the Event/Contract Catalog (`17-async-events` / `system-map`). Note which flows/rules the
fix must preserve.

### 7. Plan the minimal fix (+ rollback)
State the exact change: files + lines, corrected logic, why it fixes the root cause, why it's safe
(conforms to architecture, preserves behavior elsewhere). For non-trivial/risky fixes, show the plan
and get a quick OK. Include a **rollback note** and, if risky, a guard/feature-flag.

### 8. Regression test FIRST (red) — mapped to the QA case
Write a test that reproduces the bug and currently **fails**. **Name/tag it with the failing QA test
case ID / AC** (e.g. `// regression: TC-07 / AC-US-12-03`) so QA's suite and this fix line up. Cover
the exact failing case + the obvious neighbors (boundary/null/error path).

### 9. Apply the fix (minimal diff)
Implement the planned change with Edit — scope-locked, minimal, matching style. Make the regression
test pass. No unrelated edits.

### 10. Verify (with rollback)
Run, in order: the new regression test (now **green**), the related/affected test suite, and the
project's build/lint/typecheck. Confirm no regressions in blast-radius consumers. **If it can't be made
green quickly, revert** and report what blocked you — never leave prod code broken.

### 11. Hotfix report + close the loop back to QA
Save to `spec-kit-sessions/fixes/<slug>-<date>.md` (offer HTML via the render step if useful):
- **In plain words** (incident comms / non-tech): what broke, impact, what we changed, status.
- **Classification** (code / config / data / flag / spec — from step 2), **root cause** (cited), **the
  fix** (diff summary), **regression test** (+ the QA case it maps to), **test results**, **blast
  radius checked**, **risk + rollback plan**, **follow-ups**.
- **Close the loop:** tell the user to **redeploy, then re-verify on the environment** — re-run the
  failing case, ideally with `/namht-qa-integration` against the running app (or ask QA to re-test that
  case). Update the **QA plan** so this case is permanent regression coverage, and **update the KB**: if
  the bug revealed a missing/under-enforced rule, add it to `13-business-rules.md` and **Section 14** of
  `review-skills.md` so a future `/namht-build` or `/namht-review` catches it. Remind the user you don't
  deploy.

## Output
Summarize in chat: the **classification** (code bug or not), root cause (1–2 lines), the fix, test
status (mapped to the QA case), risk/rollback, how to re-verify on the env, and follow-ups + report
path. Be honest if it's a config/spec issue (not a code fix), or if you couldn't reproduce/verify.
```
Fits the loop: `/namht-build` → `/namht-qa` (cases) → deploy → QA finds a bug → **`/namht-fix-bug`** →
`/namht-qa-integration` (re-verify on the env) → done.
