---
name: namht-observe
description: >-
  Add or improve observability in code — structured logging, correlation/trace
  IDs, metrics, and rich error context — so tools like Splunk/ELK/Datadog can
  actually answer questions. Aligns log fields with the project's conventions and
  the backend's schema. Use when the user says "/observe", "add logging",
  "instrument this", "add metrics/tracing", "structured logs", or wants a service
  to be queryable/monitorable. Edits code (change-discipline applies).
---

# namht-observe — instrument code for real observability

Make a service **answerable**: when something breaks, the logs/metrics should let you find *what,
where, and why* fast. Pairs directly with `/namht-splunk-report` — instrument with the right fields
here, query them there.

## Inputs & grounding
- The **code/flow to instrument** (a service, endpoint, consumer, job). Ground in the KB
  (`10-core-flows`, `03-entry-points`, `14-integrations`, `12-conventions`) + read the real code.
- The **observability backend** (Splunk / ELK / Datadog / Prometheus / OpenTelemetry) and its
  **field schema** — match it. E.g. if Splunk queries use `cai_app` / `cai_enviroment`, emit those exact fields.
- Existing logging conventions (log library, levels, format) — follow them; don't introduce a new style.

## What to add (at the right points, not everywhere)
1. **Structured logs** (key=value or JSON, not free-text) at: request/message **entry**, key
   **decisions/branches**, **external calls** (DB/HTTP/queue) with outcome+latency, **errors**, and
   **exit/result**. Consistent field schema across the service.
2. **Correlation / trace IDs** — generate at the edge, **propagate** through the whole flow and
   **across services**: HTTP headers (`X-Request-Id`/W3C `traceparent`) and **SQS/queue message
   attributes**. One request → one traceable id end-to-end.
3. **Error context** — on exceptions log: error **type/class**, message, stack, and the correlating
   IDs + inputs (masked). This is what lets `/namht-splunk-report` group errors by signature.
4. **Metrics** where they matter — counters (requests, errors by type), timers/latency on key ops
   and external calls, queue depth/consumer lag for async. Name them consistently.
5. **Levels done right** — ERROR = needs attention, WARN = recoverable, INFO = business milestones,
   DEBUG = detail. No noise at INFO; no swallowed exceptions.

## Method
1. **Audit** current instrumentation: what's logged, at what level, structured or not, gaps, noise,
   and any **secrets/PII leaking** into logs (flag immediately).
2. Propose an **instrumentation plan** (fields schema + where to add what) — show it, get an OK.
3. Apply with **change-discipline** (scope-locked, minimal diff, match conventions, verify build/tests,
   rollback if red) — see `namht-build`. One area at a time.
4. State which **new fields/metrics become queryable** (so the user can build Splunk/dashboard queries).

## Output (dual-audience; save + report)
Chat summary + save `spec-kit-sessions/observe/<area>-<date>.md`: the field schema, what was added
where, and example queries the new instrumentation enables.

## Rules
- **Never log secrets or PII** (tokens, passwords, full PANs, emails unless required+masked). Mask/redact.
- **Match the backend's field names** exactly (so existing queries/dashboards keep working).
- **Signal over noise** — instrument decisions/errors/boundaries, not every line. Right level, right cardinality.
- Behavior-preserving: logging/metrics must not change business logic or throw.
- Change-discipline (scope-lock, minimal diff, verify+rollback, never touch secrets, confirm outward actions).
