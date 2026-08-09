---
description: Build a feature end-to-end — size → plan → safety net → code → independent review → tests (incl. regression) → verify vs baseline → evidence → KB → handoff
argument-hint: <requirement to implement, or a path to a story/plan under spec-kit-sessions/>
---

Use the **namht-build** skill to implement the following requirement, following its pipeline exactly.
Reuse the acceptance criteria of an existing `/namht-user-story` or `/namht-plan` artifact when one
matches (don't re-derive them), **confirm the ACs before coding**, size the change (S/M/L) so the
apparatus fits the risk, capture the **safety net** (baseline gates + snapshot) before the first edit,
review through independent sub-agents that didn't write the code, and verify against that baseline —
reverting via the safety net rather than leaving the tree broken. Ground everything in the repo's
`knowledge-base/` and do NOT break the documented architecture.

Requirement:
$ARGUMENTS

If the requirement is empty or vague, ask 2–4 targeted clarifying questions before building. Stop and
ask — even if the request said "go" — for a DB migration, a new dependency, a published API/event
contract change, or any deletion.
