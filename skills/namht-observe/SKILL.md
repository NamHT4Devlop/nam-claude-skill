---
name: namht-observe
description: >-
  Make a service answerable in production — add structured logging, a correlation
  ID that flows across HTTP and SQS, the four golden signals as metrics, and error
  context rich enough to group by. Emits fields that match the team's Splunk schema
  so queries and dashboards actually work. Use when the user says "/observe", "add
  logging", "instrument this", "add metrics/tracing", "structured logs", or wants a
  service to be queryable/monitorable. Edits code — change-discipline applies.
---

# namht-observe — instrument a service so it can be debugged from the outside

When something breaks at 3am you don't have the code in front of you — you have logs, metrics and a
trace ID. This skill puts those in place so a service can be diagnosed **without** re-reading its
source. It is the producer side of `/namht-splunk-report`: instrument the right fields here, query
them there.

## Ground it first
- Read the target flow in the KB (`03-entry-points`, `10-core-flows`, `14-integrations`,
  `12-conventions`) and the real code. Follow the **existing** logging library/format — never
  introduce a second logging style.
- Learn the **downstream schema** and emit its exact field names. If the team's Splunk uses
  `cai_app` / `cai_enviroment`, those are the field keys you write — not `app` / `env`.

## The instrumentation model (what "good" looks like)
**One correlation ID, end to end.** Generate it at the edge (HTTP filter / first consumer), carry it
through every log line, and **propagate it across service hops**:
- HTTP: read/set `X-Request-Id` (or W3C `traceparent`); pass it on outbound calls.
- **SQS/async:** put it in the message's `MessageAttributes` on send; the consumer reads it back and
  re-establishes it before doing any work. This is the piece most teams miss — without it, a request
  becomes untraceable the moment it crosses a queue.

**Structured events, not prose.** Log key=value / JSON at meaningful boundaries only: request/message
**entry**, each **external call** (DB / HTTP / queue) with outcome + duration, notable **decisions**,
**errors**, and the **result**. A consistent field set per service (service, env, correlation id,
operation, outcome, duration_ms, plus the error fields below).

**Error context you can aggregate.** On failure log: exception **class**, message, stack, the
correlation ID, and the (masked) inputs that triggered it. Stable `error_type` field → lets
`/namht-splunk-report` collapse thousands of messages into a handful of error signatures.

**The four golden signals as metrics.** Latency, traffic (throughput), errors (by type), saturation
(pool/queue depth, consumer lag for SQS). Prefer one standard (OpenTelemetry) so it's uniform across
the polyglot fleet.

## Stack notes (match what the service already uses)
- **Java / Spring:** SLF4J + Logback with **MDC** for the correlation ID (set in a servlet filter /
  Camel processor / `@SqsListener`); JSON via `logstash-logback-encoder`; Micrometer for metrics.
- **Ruby on Rails:** tagged logging / Lograge or `semantic_logger` for structured lines; set the
  correlation tag in middleware and in the Shoryuken/Sidekiq worker.
- **Node:** `pino`/`winston` structured JSON; carry the id via `AsyncLocalStorage`; set it in the
  Express middleware and the `sqs-consumer` handler.
- **Apache Camel:** instrument routes at `from`/`to`; propagate the id via exchange headers → SQS attributes.

## Method
1. **Audit** current instrumentation: structured or prose, levels, gaps, noise, and any
   **secret/PII leakage** into logs (flag and fix immediately).
2. Propose a small **field schema + instrumentation plan** (what fields, where, which metrics). Show it, get an OK.
3. Apply with change-discipline (scope-locked, minimal diff, match conventions, verify build/tests, rollback if red).
4. Report the **new queryable fields/metrics** + 2–3 example Splunk queries the instrumentation unlocks.

## Output (dual-audience; save + report)
Chat summary + `spec-kit-sessions/observe/<area>-<date>.md`: the field schema, what changed where,
and example queries/dashboards it enables.

## Rules
- **Never log secrets or PII** (tokens, passwords, full PANs, raw emails) — mask/redact at the log call.
- **Match the downstream field names exactly** so existing queries/dashboards keep working.
- **Signal over noise** — instrument boundaries/decisions/errors, right level, sane cardinality (no unbounded label values).
- Logging/metrics are **side-effect-free**: they must never alter business logic or throw.
- **Prove it fires — instrumentation without an assertion is a hope.** Add at least one test per
  instrumented boundary: (a) an entry→exit test asserting the log line carries the correlation id and
  the required schema fields; (b) for async, a produce→consume test asserting the id survives the SQS
  `MessageAttributes` hop and is re-established by the consumer; (c) a redaction test asserting a
  payload containing a secret/PII field is emitted **masked**. A correlation id that dies at a queue
  hop or a mask that doesn't mask fails silently and only surfaces at 3am. Also confirm existing
  log-parsing tests/dashboards still match any field name you changed.
- **Safety net — before the first edit.** `git status --porcelain` (ask the user to commit/stash first)
  and save `git diff HEAD > <session>/00-pre-change.patch`. To undo use ONLY `git stash push -u` or
  `git apply -R <your diff>` — the git-guard denies `git restore`, `git checkout .`/`--`,
  `git reset --hard`, `git clean -f`.
- Change-discipline: minimal diff, verify + rollback, confirm outward actions, never touch secrets.
