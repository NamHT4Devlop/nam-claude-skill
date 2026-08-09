---
name: namht-rescan
description: >-
  Incrementally update an existing Knowledge Base after code changes — re-analyze
  only what changed (via git diff) and refresh the affected knowledge-base/ docs,
  modules, and Section 14 review rules, instead of regenerating everything. Use
  when the user asks to "rescan", "/rescan", "update the KB", or "refresh the
  knowledge base after my changes".
---

# Spec Rescan — update the Knowledge Base incrementally

A native port of Auto Spec Kit's `/rescan`. Keep `knowledge-base/` accurate without paying
for a full rebuild. If there is no existing KB, fall back to a full `/namht-scan`.

## Procedure
1. **Confirm the branch + diff base, then find what changed.** The rescan reads the **working tree
   of the currently checked-out branch** (it does NOT switch branches). Get the branch with
   `git rev-parse --abbrev-ref HEAD`. Pick the **diff base**: by default the last commit the KB was
   built from (usually `HEAD` / the most recent commit), else a **branch or commit the user names**
   (e.g. `main`, a tag, a release branch). List changed source files with
   `git diff --name-only <base>` **plus** uncommitted changes (`git status --short`). State it
   plainly before proceeding: *"Rescanning branch `<X>`, changes vs `<base>` (+ N uncommitted)."*
   If git isn't usable, ask the user which areas changed.
2. **Map changes → KB docs.** Determine which knowledge-base files the changes affect:
   - new/changed entities or migrations → `05-domain-model.md`, `08-database-schema.md`
   - new/changed endpoints → `11-api-docs.md`, `03-entry-points.md`
   - changed flows/services → `10-core-flows.md`, `06-modules.md`, the relevant `modules/<m>.md`
   - new validation/business logic → `13-business-rules.md`, `04-business-domain.md`
   - auth changes → `09-auth-security.md`
   - new/changed integrations, SQS queues/topics, events, Camel routes → `14-integrations.md`, `17-async-events.md` (Event/Contract Catalog)
   - structural/dependency changes → `01-project-structure.md`, `16-architecture-patterns.md`
   - **anything that changes the TOPOLOGY → `07-architecture-diagram.md`** — a new/removed service or
     deployable unit, a new datastore/queue/topic/external system, a new entry point, or a changed
     edge between components. Update the **Mermaid high-level diagram itself** (add/remove the node
     and its edges, keep labels real), not just the prose around it — a stale architecture picture is
     worse than none. Also refresh the request-journey sequence diagram if the path changed.
3. **Re-analyze only those areas** (read the changed files + their immediate context) and
   **merge** updates into the existing docs — preserve unrelated content; update, don't
   wholesale-replace. Keep citations real and current.
4. **Refresh `modules/_index.md`** if modules were added/removed.
5. **Update `review-skills.md` Section 14** if the change introduced or revealed a new
   project-specific rule, banned pattern, or convention.
6. Follow all the golden rules from `references/kb-steps.md` (cite real names; no filler;
   business depth; tests > services > controllers > models).

## Finish
Report which KB files were updated and why (the change that triggered each). Suggest
`/namht-build` for the next feature, now grounded on the refreshed KB.
