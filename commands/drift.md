---
description: Audit the whole repo for drift between the docs/KB and the real code — stale entries, undocumented behavior, unshipped ACs, broken invariants
argument-hint: "[scope, e.g. orders module / src/payments — blank = whole repo]"
---

Use the **namht-drift** skill to audit this repository for **drift** between what the documents
claim and what the code actually does. Read-only — change nothing.

Cover the four kinds: stale Knowledge Base entries (D1), real behavior no document describes (D2),
acceptance criteria from past stories/plans in `namht-sessions/` that were never implemented (D3),
and violations of the "Architecture Invariants — DO NOT BREAK" list (D4). Verify every candidate
against the source yourself — cite `file:line` on one side and the document line on the other, and
say explicitly which side is wrong. Rank by consequence, give a verdict
(CONVERGED / DRIFTING / STALE), then hand each finding to its fix route: `/namht-rescan` for docs,
`/namht-build` for unshipped ACs, `/namht-review` for invariant breaks. Save the report under
`namht-sessions/drift/` and append a row to its journal.

Scope (blank = whole repo):
$ARGUMENTS
