---
name: namht-migrate
description: >-
  Plan and execute a SAFE migration or deprecation — API version change, DB
  schema (Flyway/Liquibase), event/message-contract change (SQS/Kafka), library
  upgrade, or config rename — with backward compatibility, a rollout + rollback
  plan, and a deprecation window for consumers. Use when the user says
  "/migrate", "deprecate X", "schema change", "breaking change", "version bump",
  "upgrade <lib>", or changes a shared contract. Edits code (change-discipline applies).
---

# namht-migrate — safe migration & deprecation

Change a shared thing (API, DB schema, event contract, library) **without breaking consumers**. The
default is **backward-compatible, staged, reversible** — never a big-bang breaking change.

## Inputs & grounding
- **What's changing** and whether it's **breaking**: API endpoint/field, DB table/column
  (Flyway/Liquibase), **event/message schema** (SQS/Kafka), library version, config key.
- **Consumers / blast radius** — who depends on it. Use the KB + **Event/Contract Catalog**
  (`17-async-events.md`, `system-map/`) for cross-service consumers, and **grep callers** in-repo.
  A change is only "safe" once every consumer is accounted for.

## Strategy (pick the safest that fits)
- **Expand → migrate → contract** (default): (1) ADD the new (column/field/endpoint/event version)
  keeping the old, (2) dual-write / backfill / migrate consumers, (3) remove the old **only after**
  the deprecation window and zero usage.
- **Versioned contracts**: `/v2` endpoint or an event `schemaVersion`; consumers tolerate **old + new**
  (handles producer/consumer **version skew** in async systems).
- **DB (Flyway/Liquibase)**: additive migrations first (new nullable column / new table), backfill,
  switch reads/writes, drop old in a **later** migration. Never rename/drop in the same step as the switch.
- **Deprecation path**: mark deprecated (annotation/comment/doc) → emit a warning/metric on old usage →
  grace period → remove. Announce to consumers.

## Method
1. **Map impact** — list every consumer (cross-service via the Event/Contract Catalog + in-repo callers).
   Classify breaking vs compatible.
2. **Design the staged plan** — ordered steps, what ships when, the **rollback** for each step, data
   backfill if needed, and the deprecation window. Show it, get an OK.
3. **Execute step-by-step** with change-discipline (minimal diff, verify build/tests each step, rollback
   if red). Write real migration scripts (Flyway `V__`/Liquibase changelog) — additive first.
4. **Verify** old consumers still work (regression — hand to `/namht-qa`) before contracting.

## Output (dual-audience; save + report)
Chat summary + save `spec-kit-sessions/migrate/<change>-<date>.md`: impacted consumers, the staged
plan (with rollback per step), migration scripts, and the deprecation timeline.

## Rules
- **Backward-compatible first** — never break a consumer without a deprecation window + migration path.
- **Reversible steps** — each step has an explicit rollback; destructive/irreversible steps (drop
  column, delete data) require **explicit confirmation** and a backup/backfill.
- **DB migrations are additive-then-cleanup**, never destructive-in-one-step; confirm before running any migration.
- Cross-service: assume **version skew** — producers and consumers run different versions during rollout.
- Change-discipline (scope-lock, minimal diff, verify+rollback, never touch secrets, confirm outward/destructive).
