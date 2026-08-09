---
name: namht-plan-review
description: >-
  Critique an implementation plan or user-story plan BEFORE building, through
  multiple lenses — Product (right thing? simpler? scope creep), Architecture/Eng
  (fits existing patterns, blast radius, risk), Risk/QA (what breaks, regression,
  edge cases), DevEx (complexity, maintainability) — grounded in the KB,
  ending with a verdict (proceed / revise) + concrete fixes. Use when the user says
  "/plan-review", "review this plan", "is this plan good", or after /namht-plan.
---

# namht-plan-review — multi-lens critique of a plan (catch bad plans early)

A plan is the cheapest place
to fix a mistake. Review the plan (from `/namht-plan`, `/namht-discover`, or pasted) before code.

## Input
The plan / user stories (pasted, or a file under `spec-kit-sessions/`). Identify the feature + the
modules/entities it targets. Ground in KB (`13-business-rules`, `16-architecture-patterns`,
`10-core-flows`) and by tracing callers (blast radius of the proposed changes).

## Lenses (score each: ✅ ok / ⚠️ concern / ❌ blocker)
1. **Product** — is this the *right* thing? Is there a simpler version that delivers most value?
   Scope creep? Does it match the success metric? Anything that should be cut or deferred?
2. **Architecture / Eng** — does it follow the documented pattern & layer rules
   (`16-architecture-patterns`)? Blast radius (who else is affected — grep callers)? Migrations /
   breaking changes handled? Any risky shortcut?
3. **Risk / QA** — what existing flows could break (regression)? Edge cases, error paths,
   concurrency, permissions, data states the plan ignores? Is it testable?
4. **DevEx / Maintainability** — complexity added, duplication, naming, "will the next dev
   understand this?", premature abstraction (YAGNI).
5. **Reuse & Rollout** (when the plan came from `/namht-build`) — check its **Reuse Report**: for every
   row marked `new`, does the justification name real searches, and can you find an existing candidate
   it missed (helper, service, DTO, constant/enum, config key, error code, message, i18n key, style
   token, test fixture)? Does it add a dependency an installed library already covers? Then check
   **Rollout & Reversibility**: feature flag (default, who flips it, when removed), deploy order
   (migration ↔ code), behavior under version skew, how to undo in production, new config/env vars,
   backfill. **A missing rollback plan is a ❌ blocker, not a ⚠️.**

## Output (dual-audience; chat + offer to save `spec-kit-sessions/plan-reviews/<slug>-<date>.md`)
```
## In plain words            ← is the plan good to proceed? 2–3 sentences
## Scorecard                 ← | Lens | ✅/⚠️/❌ | one-line reason |
## Findings                  ← per lens, concrete issues with the specific fix/change to the plan
## Missing / risky           ← gaps (edge cases, regression, migration) the plan should add
## Verdict                   ← PROCEED · PROCEED WITH CHANGES · REVISE — with the must-change list
```

## Rules
- Critique the PLAN, don't write code. Output actionable plan edits, not vague advice.
- Ground every "this will break X" in the KB (+ grep) (real flow/consumer), not speculation.
- If the plan is solid, say so plainly — don't invent objections.
- After revisions, hand to **`/namht-build`** (or `/namht-qa` for test design).
