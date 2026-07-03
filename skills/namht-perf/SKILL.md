---
name: namht-perf
description: >-
  Make it faster on evidence, not hunches — measure the baseline, fix the single
  biggest bottleneck, re-measure to prove the win. Targets N+1 queries, missing
  indexes and full scans, over-fetching, blocking/sequential calls, chatty
  service hops, and missing caching or pagination. Use when the user says
  "/perf", "optimize performance", "this is slow", "N+1", "reduce latency", or
  "high memory/CPU". Edits code — change-discipline applies.
---

# namht-perf — measure first, optimize the bottleneck, prove it

Blind optimization wastes effort and adds complexity for nothing. The loop is strict: **measure →
find the dominant cost → fix that one thing → measure again.** A change that isn't shown to help by
numbers gets reverted. (Amdahl's law: only the dominant cost matters — shaving a 2% path is noise.)

## Get a number first (don't guess the hotspot)
Ground in the KB (`10-core-flows`, `08-database-schema`) and get real data before changing code:
- **DB:** `EXPLAIN` / `EXPLAIN ANALYZE` (MySQL & Postgres) on the suspect query; row counts; index usage.
- **Java:** async-profiler / JFR flame graphs; Micrometer timers; Hibernate SQL log for N+1.
- **Rails:** `rack-mini-profiler`, the **bullet** gem for N+1, `pg_hero`/`EXPLAIN` for slow SQL.
- **Node:** `clinic.js` / `--prof`; DB driver timing.
- Or pull real latency/slow-query data from `/namht-observe` metrics + `/namht-splunk-report`.

## The usual dominant costs (and the fix)
- **N+1 queries** (a query per row in a loop) → eager-load: JPA fetch-join / `@EntityGraph`, Rails
  `includes`, a Node dataloader/batch. Usually the single biggest backend win.
- **Missing / wrong index or full scan** (`EXPLAIN` shows a seq scan on a big table) → add a targeted
  or **composite/covering** index matching the query's filter+sort; mind cardinality and write cost.
- **Over-fetching** — `SELECT *`, no projection, unbounded result sets → select only needed columns; **paginate**.
- **Blocking / sequential I/O** that could be **parallel** → `CompletableFuture.allOf` / `Promise.all`
  / concurrent consumers; batch chatty cross-service calls into one.
- **Repeated work** → cache **only** where it's safe and you can invalidate correctly (a stale cache
  is a correctness bug, not a speedup).
- **Async/SQS throughput** → consumer concurrency, batch size, visibility/backpressure tuning.

## Method
1. **Baseline** — the real bottleneck + a number (latency / query count / rows / allocations). Cite it.
2. **Fix the biggest lever first** — propose the change + expected impact; apply with change-discipline.
3. **Re-measure** — before/after numbers. No measurable win → revert (don't keep speculative complexity).
4. Continue only while the next gain justifies the complexity it adds.

## Output (dual-audience; save + report)
Chat + `spec-kit-sessions/perf/<area>-<date>.md`: the bottleneck, the fix, and **before/after numbers**
(the evidence), plus any trade-off (memory vs speed, cache staleness).

## Rules
- **Measure before AND after** — every claimed win needs numbers; no micro-optimizing without data.
- **Correctness is not negotiable for speed** — watch cache invalidation, race conditions, and any
  change to ordering/semantics. Behavior stays correct.
- **Biggest bottleneck first** — one meaningful lever at a time, not a scatter of tiny tweaks.
- Don't add caching/indexes/complexity that the measured gain doesn't pay for; respect the architecture.
- Change-discipline: scope-lock, minimal diff, verify + rollback, never touch secrets, confirm outward actions.
