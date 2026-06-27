---
name: namht-build
description: >-
  Implement a feature or change end-to-end with a disciplined spec-driven
  pipeline: clarify → plan (impact + business flow) → generate code → multi-lens
  review → write tests → run tests → evidence report → update the Knowledge Base.
  Use when the user asks to "build", "implement", "add a feature", "/build", or
  wants a production-ready change that respects the existing architecture and
  business rules. Reads the repo's knowledge-base/ for grounding.
---

# Spec Build — 13-step implementation pipeline

A native port of Auto Spec Kit's `/build`. The goal: turn one requirement into a
**production-ready, architecture-conformant, tested** change — not a quick draft.
You (Claude Code) are the engine; use your own tools instead of an external model:
`Read/Grep/Glob` to investigate, the `Task` tool to fan out parallel specialist
sub-agents, `Edit/Write` to apply code, and `Bash` to run tests.

## Ground rules (apply to every step)
1. **Ground everything in the Knowledge Base.** Load `knowledge-base/` from the repo
   (especially `04-business-domain`, `05-domain-model`, `10-core-flows`,
   `13-business-rules`, `12-conventions`, `16-architecture-patterns`, `review-skills.md`).
   If `knowledge-base/` is missing, tell the user to run `/namht-scan` first, or
   proceed with reduced confidence using direct code reading.
2. **Do NOT break the existing design.** New code MUST follow the documented
   architectural style, layer/dependency rules, and the "Architecture Invariants —
   DO NOT BREAK" list in `16-architecture-patterns.md`. Copy the matching Extension Recipe.
3. **Cite real paths and names.** No invented files, APIs, or fields.
4. **Match the project's conventions exactly** — naming, error handling, logging, validation placement, test style.
5. **Persist artifacts.** Create a session folder
   `spec-kit-sessions/<YYYY-MM-DD-HHMMSS>-<slug>/` and save each phase's output there
   (`01-plan/plan.md`, `03-code/`, `04-code-review/review.md`, `05-tests/`,
   `07-evidence/EVIDENCE.md`, `README.md`). This mirrors the original tool and gives an audit trail.
6. **Stop and ask** before doing something destructive or ambiguous. Prefer a TodoList
   (TaskCreate/TaskUpdate) so the user can follow the 13 steps.

## Step 0 — Clarify (gate)
Assess the requirement's clarity. If it's vague or under-specified (missing acceptance
criteria, ambiguous scope, unknown entities), ask **2–4 targeted questions** before
building — don't build the wrong thing. Once clear, restate the final requirement.

## Step 1 — Planning (multi-agent)
Discover the relevant files (Grep/Glob + KB topic match), then fan out **3 parallel
sub-agents** via the `Task` tool (see `agents/` — `namht-codebase-analyzer`,
`namht-impact-detector`, `namht-business-flow-tracer`). If you don't spawn agents, do all three
analyses yourself in sequence. Then synthesize a **comprehensive implementation plan**
with these sections:
1. **Requirement Analysis** — scope (do / don't), ≥5 specific & measurable acceptance criteria, edge cases.
2. **Impact Analysis** — files that MUST change, downstream consumers (trace the blast radius via real imports/callers), API-contract changes, DB impact/migrations, breaking changes, side effects, a risk matrix `| Risk | Likelihood | Impact | Mitigation |`.
3. **Business Flow Mapping** — existing flows affected (before→after), new flow step-by-step, state-machine changes.
4. **Technical Design** — modules/layers affected, files to CREATE (full paths following existing patterns), files to MODIFY, reusable components to leverage.
5. **Implementation Steps** — ordered by dependency, as a checklist.
6. **Risk Assessment** — the matrix with mitigations.
7. **Estimate** — complexity (Simple/Medium/Complex) + rough time.
8. **Architecture Conformance** — which documented pattern the target module uses; the specific "Architecture Invariants — DO NOT BREAK" that apply, and how the plan honors each.

Save to `01-plan/plan.md`. **Do not write code yet.**

## Steps 2–3 — Plan review & feedback
Critically review your own plan (completeness, missing edge cases, risky assumptions,
architecture violations). Apply the fixes and produce the final plan. For a non-trivial
change, show the plan to the user and get a thumbs-up before coding.

## Step 4 — Code generation
Implement the plan. For multi-module changes, split work by module/layer (optionally
parallel sub-agents) and assemble. **Apply changes directly to the repo with Edit/Write**
(this is the big advantage over the original tool, which only emitted code blocks).
Rules: complete, production-ready code (no placeholders/TODOs); follow the REFERENCE
patterns; respect layer/dependency rules and the architecture invariants; correct
imports, types, error handling; match `12-conventions.md`. Mirror the raw output to
`03-code/` for the audit trail.

## Step 5 — Code review (multi-lens)
Review the change through **4 lenses** (parallel sub-agents in `agents/`, or sequentially):
- **Security** — input validation, injection, authn/authz, data exposure, crypto/secrets (use `knowledge-base/review-skills.md`; fall back to the bundled `references/review-skills-universal.md`).
- **Architecture & pattern conformance** — does it violate any "Architecture Invariant"? same pattern as the surrounding module? forbidden dependency direction? boundary violations? Quote the specific rule broken.
- **Performance** — N+1 queries, missing indexes, memory leaks, blocking/sequential calls, missing pagination/caching.
- **Business consistency** — business rules intact, no logic silently removed, valid state transitions, API contract preserved, all acceptance criteria implemented.

Produce a merged review with deduplicated issues (each: severity `[CRITICAL/MAJOR/MINOR]`,
exact location, bad code, complete fixed code), strengths, a verdict (APPROVED /
NEEDS_REVISION), and a quality score X/10. Save to `04-code-review/review.md`.

## Step 6 — Code feedback
Apply every `[CRITICAL]` and high-risk `[MAJOR]` fix from the review. Re-verify until the
verdict is APPROVED (or remaining items are explicitly accepted by the user).

## Step 7 — Write tests (multi-angle)
Write tests covering three angles (do them yourself, or spin up parallel general-purpose
sub-agents — one per angle — then merge):
- **Unit** — every public function/method; mock dependencies; happy path + return + side effects; name pattern `should [behavior] when [condition]`.
- **Integration** — API request→response, auth (401/403), validation (400), service composition, DB, full business flows.
- **Edge cases & security** — boundary values, null/undefined, concurrency/duplicates, error propagation, permission bypass, invalid state transitions, malicious input.

Start with a coverage table, then the test files. Save to `05-tests/` and apply them to the repo.

## Steps 8–9 — Test review & feedback
Review the tests (independent? deterministic? boundary-only mocking? meaningful assertions?),
fix gaps, finalize.

## Step 10 — Save files
Ensure all code + test files are written to the correct paths in the repo. Confirm the file list.

## Step 11 — Execute tests
Run the project's test command via `Bash`. Discover it from `package.json` scripts,
`pytest`, `go test`, `mvn`/`gradle`, `Gemfile`, etc., or ask the user. In an untrusted
context, ask before running. Capture pass/fail, coverage, and key failures. If tests fail,
loop back: diagnose → fix code or tests → re-run (a few iterations) before reporting failure.

## Step 12 — Evidence report
Write `07-evidence/EVIDENCE.md` with: a header table (requirement, session, date, test
status, coverage); Implementation Summary; Files Changed table; **Acceptance Criteria
Verification** table (each AC → ✅/❌ → which file/function proves it); Business Flow
Validation; Test Results; Code Quality score; Risk Assessment; Known Limitations & Next
Steps. Also write the session `README.md` with quick links.

## Step 13 — Update the Knowledge Base
Reflect the change back into `knowledge-base/`: update the affected docs (flows, rules,
domain model, API, modules) and append any new project-specific rule discovered during
review to **Section 14** of `review-skills.md`. Keep the KB accurate so the next build is smarter.

## Final
Summarize for the user: what changed, test status + coverage, the session folder path, and
any follow-ups. Be honest if tests were skipped or failing — never claim success you didn't verify.
