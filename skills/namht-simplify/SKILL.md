---
name: namht-simplify
description: >-
  Make existing code easier to read and change WITHOUT changing what it does —
  guarded by tests, one small refactor at a time. Removes dead code, flattens
  nesting, extracts and renames for intent, kills duplication, and deletes
  needless abstraction. Use when the user says "/simplify", "refactor for
  clarity", "reduce complexity", "clean up this code", or "this is too complex".
  Edits code — change-discipline applies. Behavior must not change.
---

# namht-simplify — behavior-preserving simplification

The goal is the code a new teammate could read in one pass. The constraint is absolute: **same
inputs → same outputs and side-effects.** This is refactoring, not a feature or bug change — if you
spot a bug, you stop and report it, you do not "fix" it here.

## Two rules that make this safe
1. **A test net comes first.** Refactoring without tests is just editing and hoping. Confirm the
   target behavior is covered; if not, write **characterization tests** (assert what the code does
   *today*, bug-for-bug) before changing anything — those tests are the definition of "unchanged".
2. **One transformation at a time → run tests → next.** Never batch several risky moves. Green after
   each step is the proof behavior held; red means revert that step.

## What to hunt (and the fix)
- **Dead code** — unused vars, functions, branches, feature flags that are always one value → delete.
- **Deep nesting / arrow code** → guard clauses and early returns.
- **Long functions doing many jobs** → extract intention-revealing helpers (one job each).
- **Duplication** → one source of truth — but don't force-DRY *incidental* repetition that will diverge.
- **Mystery names / magic numbers** → names that state intent; named constants.
- **Needless indirection / over-abstraction** → inline it. A tiny wrapper used once hurts more than a
  little repetition. Clarity beats cleverness.
- **Tangled conditionals** → simplify boolean logic; replace flag arguments with clear call sites.

## Stack smells (common in this fleet)
- **Java:** speculative interfaces/factories with one impl, getters/setters hiding logic, deep
  inheritance → prefer composition, inline the single-impl indirection.
- **Rails:** fat models, callback chains, `method_missing` cleverness → extract POROs/service objects,
  make the flow explicit.
- **Node:** callback pyramids / long `.then` chains → `async/await`; scattered config → one module.

## Method
1. **Establish the net** — confirm/add tests around the target behavior.
2. **Simplify in small green steps** — apply one refactor, run tests, keep it only if green.
3. **Stop at "clear enough."** Don't restructure beyond the ask or gold-plate.

## Output
Chat summary: what got simpler and why (nesting/length/duplication reduced), tests green, diff kept
reviewable. Optionally save `spec-kit-sessions/simplify/<area>-<date>.md`.

## Rules
- **Behavior-preserving — NON-NEGOTIABLE.** No functional change. Found a bug? Stop, flag it, hand to `/namht-fix-bug`.
- **Minimal diff, one refactor at a time**; tests green after each or revert.
- **Don't over-abstract** — readable-and-slightly-repetitive beats clever-and-opaque.
- Respect conventions and the architecture invariants; no library swaps or structure churn.
- Change-discipline: scope-lock, verify + rollback, never touch secrets, confirm before destructive actions.
