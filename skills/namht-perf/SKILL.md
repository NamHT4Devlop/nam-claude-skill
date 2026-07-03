---
name: namht-perf
description: >-
  Find and fix performance problems with a MEASURE-first discipline — N+1
  queries, missing indexes, full scans, over-fetching, blocking/sequential calls,
  hot loops, missing caching or pagination, chatty service calls — proving the
  win with before/after numbers. Use when the user says "/perf", "optimize
  performance", "this is slow", "N+1", "reduce latency", or "high memory/CPU".
  Edits code (change-discipline applies).
---

# namht-perf — measure-first performance optimization

Make it faster **based on evidence**, not hunches. The rule: **measure → find the real bottleneck →
fix the biggest one → re-measure to prove it**. Premature/blind optimization is banned.

## Inputs & grounding
- The **slow area** (endpoint, query, job, page) and, if available, **profiling/APM data**, query
  plans, or timings. Ground in the KB (`10-core-flows`, `08-database-schema`, `16-architecture-patterns`).
- If there's no measurement yet, **get one first** — timing/logs/`EXPLAIN`/profiler/APM (tie to
  `/namht-observe` + `/namht-splunk-report` for real latency/error data). Don't guess the hotspot.

## What to look for (by category)
- **Database**: **N+1 queries** (loop issuing queries), **missing index** / full scan (`EXPLAIN`),
  over-fetching (`SELECT *` / no projection), unbounded result sets, chatty transactions.
- **App/CPU**: hot loops, repeated work, unnecessary allocations/serialization, sync work that could be cached.
- **I/O & services**: **blocking/sequential** external calls that could run in **parallel/async**;
  chatty cross-service calls (batch them); no timeout/retry tuning.
- **Missing caching** (safe, with correct invalidation) and **missing pagination** on large lists.
- **Async/queues**: consumer throughput, batch size, backpressure.

## Method
1. **Measure the baseline** — the actual bottleneck + a number (latency/queries/allocs). Cite it.
2. **Fix the biggest lever first** — propose the change + expected impact; apply with change-discipline.
3. **Re-measure** — prove the improvement with before/after numbers. If no measurable win, revert.
4. Repeat only while the gain justifies the complexity added.

## Output (dual-audience; save + report)
Chat + save `spec-kit-sessions/perf/<area>-<date>.md`: the bottleneck, the fix, and **before/after
numbers** (the evidence). Note any trade-offs (memory vs speed, cache staleness).

## Rules
- **Measure before AND after** — every claimed win needs numbers. No micro-optimizing without data.
- **Correctness first** — never trade correctness for speed; watch **cache invalidation**, race
  conditions, and changed ordering/semantics. Behavior stays correct.
- **Biggest bottleneck first** — don't scatter tiny optimizations; one meaningful lever at a time.
- Respect architecture + conventions; don't add caching/complexity that isn't paid for by the measured gain.
- Change-discipline (scope-lock, minimal diff, verify+rollback, never touch secrets, confirm outward actions).
