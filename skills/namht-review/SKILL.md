---
name: namht-review
description: >-
  Review a file or a diff in two phases — code quality against a comprehensive
  universal checklist (architecture, security, error handling, performance,
  observability, testing, data integrity, API design, code quality) AND business
  consistency against the project's Knowledge Base (business rules intact, no
  logic removed, valid state transitions, API contract preserved). Use when the
  user asks to "review", "/review", "check this file", or audit a change.
---

# Spec Review — two-phase code review

A native port of Auto Spec Kit's `/review`. Produce an **actionable** review: every issue
must show the exact bad code and the complete fixed code — never "add X here".

## Inputs
- **Target**: the file(s) the user named, the active file, or the current diff
  (`git diff`). If none specified, ask or default to the working-tree diff.
- **Checklist**: load `knowledge-base/review-skills.md` from the repo if present (it has
  the universal checklist + project-specific **Section 14** — highest priority). If absent,
  use the bundled `references/review-skills-universal.md`. Mention which source you used and
  that running `/namht-scan` adds project-specific rules.
- **Grounding**: load relevant `knowledge-base/` docs (business rules, domain model,
  conventions, architecture patterns) and `git` context (how the file changed vs the
  default branch) for Phase 2.

## Phase 1 — Code quality
Go through **every section** of the review checklist as a gate. For each section, list
issues (citing file · function · ~line) or mark `✅ Clean` — do not skip sections. Cover at
minimum: Architecture & Design, Security, Error Handling & Resilience, Performance,
Observability, Testing, Data Integrity, API Design, Code Quality. Keep the AI/LLM section
only if the project has AI components.

## Phase 2 — Business consistency
Cross-reference the Knowledge Base:
- Does this code violate any documented business rule or invariant?
- Was any existing business logic deleted or silently overridden?
- Are entity state transitions valid per the domain model?
- Is any existing API contract changed (breaking)?
- (For a change) are all the relevant acceptance criteria satisfied?

## Output format (required)
```
## 📋 SECTION COVERAGE
| Section | Status | Issues |
|---------|--------|--------|
(one row per checklist section; ✅/⚠️/❌/N/A + count)

## 🏢 BUSINESS CONSISTENCY
| Check | Result | Notes |
|-------|--------|-------|
| Business rules intact | ✅/❌ | |
| No logic removed | ✅/❌ | |
| State machine valid | ✅/❌/N/A | |
| API contract preserved | ✅/❌/N/A | |

## 🐛 ISSUES   (each issue has all 4 parts)
### Issue #N — [CRITICAL/MAJOR/MINOR] · `function()` · line ~XX
> **Problem:** why it's wrong + business/technical impact
**❌ Bad code (current):**
```<lang>
…exact problematic code…
```
**✅ Fixed code (complete, no placeholders):**
```<lang>
…complete corrected code…
```

## ✅ STRENGTHS (≥3 specific points)
## 🎯 VERDICT: APPROVED / NEEDS_REVISION
## 📊 QUALITY SCORE: X/10 — short reason
```

## Severity → merge rules
`[CRITICAL]` blocks merge (must fix + re-review). `[MAJOR]` with high risk blocks; with low
risk may merge with a follow-up ticket. `[MINOR]`/`[NIT]` don't block. Section 14
(project-specific) rules have the highest priority when present.

## Optional: apply fixes
If the user asks, apply the `[CRITICAL]`/high-risk `[MAJOR]` fixes directly with Edit, then
re-verify. Otherwise leave the review as a report. You may save it to
`spec-kit-sessions/reviews/<file>-<date>.md`.
