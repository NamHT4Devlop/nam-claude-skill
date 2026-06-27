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
1. **Find what changed.** Use `git` to get changed source files since the KB was last
   updated — e.g. `git diff --name-only` vs the last commit/branch the user names, plus
   uncommitted changes (`git status`). If git isn't usable, ask the user which areas changed.
2. **Map changes → KB docs.** Determine which knowledge-base files the changes affect:
   - new/changed entities or migrations → `05-domain-model.md`, `08-database-schema.md`
   - new/changed endpoints → `11-api-docs.md`, `03-entry-points.md`
   - changed flows/services → `10-core-flows.md`, `06-modules.md`, the relevant `modules/<m>.md`
   - new validation/business logic → `13-business-rules.md`, `04-business-domain.md`
   - auth changes → `09-auth-security.md`
   - new integrations → `14-integrations.md`
   - structural/dependency changes → `01-project-structure.md`, `16-architecture-patterns.md`
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
