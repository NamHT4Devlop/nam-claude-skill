---
name: namht-simplify
description: >-
  Reduce complexity and improve clarity of existing code WITHOUT changing its
  behavior — remove dead code, flatten nesting, extract/rename for readability,
  kill duplication, drop needless abstraction — one small behavior-preserving
  refactor at a time, kept green by tests. Use when the user says "/simplify",
  "refactor for clarity", "reduce complexity", "clean up this code", or "this is
  too complex". Edits code (change-discipline applies).
---

# namht-simplify — behavior-preserving simplification

Make code **easier to read and change** without altering what it does. The north star is
**clarity over cleverness**. This is refactoring only — **not** a behavior/feature change.

## Inputs & grounding
- The **file/function/module** to simplify (or the current diff). Read the real code + relevant KB
  (`12-conventions`, `16-architecture-patterns`) so the result matches house style and invariants.
- The **tests** that guard the behavior. If coverage is thin, add a **characterization test** first
  (capture current behavior) before refactoring — or proceed in tiny steps and verify manually (say so).

## What to look for
- **Dead code** (unused vars/functions/branches/flags) → delete.
- **Deep nesting** → guard clauses / early returns.
- **Long functions** doing many things → extract well-named helpers.
- **Duplication** → one source of truth (but don't over-DRY tiny incidental repeats).
- **Unclear names / magic numbers** → intention-revealing names + named constants.
- **Needless abstraction / indirection** → inline it (clarity > cleverness).
- **Convoluted conditionals** → simplify boolean logic, use early exits.

## Method
1. **Establish a safety net** — confirm tests cover the target behavior (or add characterization tests).
2. **One small refactor at a time**: apply a single transformation → **run tests** → confirm still
   green (behavior unchanged) → next. Never batch many risky changes.
3. **Stop when it's clear enough** — don't gold-plate or restructure beyond the ask.

## Output
Chat summary of what was simplified + why (readability/complexity reduced), with tests green. Optionally
save `spec-kit-sessions/simplify/<area>-<date>.md`. Keep the diff reviewable.

## Rules
- **Behavior-preserving — NON-NEGOTIABLE.** Same inputs → same outputs/side-effects. If you find a
  bug while simplifying, STOP and flag it (fix is a separate task via `/namht-fix-bug`) — don't
  silently change behavior.
- **Minimal diff, one refactor at a time**; tests must stay green after each. If you can't keep them
  green, revert.
- **Don't over-abstract** — prefer readable and slightly repetitive over clever and opaque.
- Respect conventions + architecture invariants; no structure churn / library swaps.
- Change-discipline (scope-lock, verify+rollback, never touch secrets, confirm before destructive actions).
