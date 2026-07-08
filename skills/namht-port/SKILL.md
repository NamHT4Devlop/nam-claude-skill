---
name: namht-port
description: >-
  Port a service (or a chosen set of endpoints) from one language/stack to another while
  PRESERVING its contract and business behavior — e.g. Ruby on Rails + GraphQL → Java Spring
  Boot. Works endpoint-by-endpoint (strangler): freeze the contract, extract the business
  behavior from the source, capture golden/characterization tests of the real responses,
  re-implement on the target stack, and verify byte-for-byte parity before cutover. Use when the
  user says "/port", "migrate to another language", "rewrite in <language>", "Rails to Spring",
  "port these resolvers/APIs", or is moving a service between stacks. Edits code — change
  discipline applies.
---

# namht-port — behavior-preserving cross-stack port (contract-first, parity-verified)

Distinct from `/namht-migrate` (which evolves a contract **in place**, same codebase). This is a
**rewrite onto a different stack that must behave identically** — the clients must not notice. The
whole discipline exists to answer one question per endpoint: *"does the new implementation return
exactly what the old one did?"*

**Default target profile (this project):** Java **Spring Boot** · **MyBatis** (SQL-first) · **Flyway**
· **Apache Camel** · **AWS SQS** · **MySQL**, sharing the **same database** as the source. GraphQL on
the Java side via **Spring for GraphQL** (or Netflix DGS if the user prefers). Confirm at step 0.

## Ground rules
- **The contract is frozen.** Port the **GraphQL schema 1:1** and the chosen REST contracts exactly —
  same types, fields, nullability, enums, pagination, status codes, JSON shape. **Diff proves it.**
- **Behavior parity is the acceptance bar.** An endpoint is "done" only when **golden tests** (real
  recorded responses of the source) pass against the new implementation — happy, edge, error and
  auth-denied cases alike.
- **The source is the spec.** Business rules come from the Ruby (models, services, callbacks,
  validations, scopes, concerns) + the KB — **never invented**. Cite the Ruby file/line.
- **Incremental & reversible (strangler).** One endpoint at a time; run old and new side by side;
  cut over per endpoint; keep parity tests as the regression gate. **Never big-bang.**
- **Shared DB by default — no data migration.** MyBatis maps the existing MySQL schema; both sides
  read/write the same tables during transition. Replicate any DB-side effect the Ruby did (timestamps,
  counter caches, `touch`, `dependent:`) or data will drift while both run.
- **Minimal, conventional, no drive-by refactors** (same change discipline as `/namht-build`). The
  human deploys and controls cutover — you don't.

## Step 0 — Scope & discovery
Confirm before porting (ask what's missing; don't assume):
- **Source** repo + stack (Rails version, `graphql-ruby`, REST framework, auth: Devise/JWT/Pundit…).
- **Target** stack (default profile above) + GraphQL library + build (Gradle/Maven).
- **Scope set** — the endpoints to port: **ALL GraphQL resolvers** + the **specific 3–5 REST APIs**
  (get the exact list; everything else is explicitly OUT of scope).
- **DB** — shared (default) vs new schema. **Async** — are there SQS producers/consumers, Camel-style
  flows, or background jobs (Sidekiq/ActiveJob) among the ported endpoints? If yes, they port too
  (match channel names + message schema so the Java side is drop-in on the same queues).
- **Cutover** — strangler (default) vs another plan.
Write a short **Scope & Parity Plan** (in-scope endpoints, out-of-scope, target profile, DB & async
decisions, cutover) and confirm.

## Step 1 — Ground the source in its business behavior
Run (or reuse) `/namht-scan` on the Rails repo → the KB captures business rules, flows, auth and the
Event/Contract Catalog (`17-async-events`) for SQS/Camel. This is the shared truth the port is checked
against. No KB → scan first; grounding a rewrite on grep alone will miss implicit rules.

## Step 2 — Freeze the contract (contract-first)
- **GraphQL:** export the source **schema SDL** (e.g. dump `graphql-ruby`'s schema). Recreate it on the
  Java side (Spring for GraphQL schema files / DGS), then **diff the two SDLs** — they must be identical
  (types, fields, nullability, enums, input types, interfaces/unions, directives, Relay
  connections/pagination). Map GraphQL types → Java records/DTOs.
- **REST (3–5):** capture each endpoint's exact contract — path, method, params, headers, status codes,
  and response JSON shape — as an OpenAPI snapshot or fixtures. Freeze it.

## Step 3 — Per-endpoint loop (repeat for every in-scope endpoint)
Do these **independently per resolver/API** so each can ship and cut over on its own:
1. **Behavior spec.** From the Ruby resolver/controller + its models/services/callbacks/validations/
   scopes/concerns, write: inputs, outputs, **business rules**, **authorization** (who may call it),
   edge cases, **error responses**, and **side effects** (DB writes, SQS publishes, emails, touches).
   Cite Ruby files/lines; ground rules in the KB. Make Rails' *implicit* behavior **explicit**.
2. **Golden / characterization tests.** Record the **real source responses** as the parity oracle:
   for GraphQL, representative queries/mutations + variables → captured JSON (including the `errors`
   array); for REST, request→response snapshots. Cover happy + boundary + invalid-input + auth-denied.
3. **Implement on the target.** Write the Java: a GraphQL resolver (`@QueryMapping`/`@MutationMapping`/
   `@SchemaMapping`) or REST controller; a **service** carrying the ported business rules; a **MyBatis
   mapper** for data against the **same MySQL** (reuse the SQL semantics the ActiveRecord produced —
   scopes/joins/ordering); **Flyway** only if a genuinely new column is required (prefer none while the
   DB is shared); a **Camel route / SQS publish** matching the source's channel + message schema when
   the endpoint emits one. Minimal, matches conventions.
4. **Verify parity.** Run the golden tests against the Java endpoint — output must **match the recorded
   source responses** (modulo diffs you explicitly document and the user accepts, e.g. volatile
   timestamps). Fix until green. Handle **N+1** with a **BatchLoader/dataloader**. Confirm **auth parity**
   (same allow/deny) and **error parity** (same GraphQL error shape / REST error body + status).
5. **Record in the Parity Matrix:** `endpoint · contract identical? · golden tests pass? · business
   rules covered? · side effects matched? · notes`.

## Step 4 — Cross-cutting parity (verify once, across all ported endpoints)
- **Auth:** Devise/JWT/Pundit/CanCan → **Spring Security** (authn + method-level authz) — same tokens,
  claims, roles, and allow/deny outcomes.
- **Errors:** identical GraphQL `errors` structure / REST error body + HTTP status per case.
- **Pagination:** Relay connections / cursor semantics reproduced exactly.
- **N+1:** dataloaders/BatchLoader where `graphql-batch`/includes existed.
- **Data layer (shared MySQL):** watch the Rails→SQL gotchas — default scopes, `dependent:`,
  `counter_cache`, `touch`, enum-as-integer, STI, serialized/JSON columns, timezone handling,
  `created_at/updated_at` written in Ruby. Reproduce every DB-side effect so both sides stay consistent.
- **Async (if in scope):** SQS producers/consumers and Camel routes match the Event/Contract Catalog —
  same queue/topic names, message schema, FIFO/DLQ/idempotency — so the Java service is interchangeable
  with Rails on the same queues.

## Step 5 — Cutover guidance + report
- **Strangler cutover:** run both services against the shared DB; route each GraphQL operation / REST
  endpoint to Spring one at a time (behind a gateway/proxy or feature flag); keep the golden tests as
  the gate; roll back per endpoint if parity breaks. Because the DB is shared, both sides operate on the
  same data — a true side-by-side.
- **Report (dual-audience):** save to `spec-kit-sessions/port/<service>-<date>.md` and render HTML —
  the Scope & Parity Plan, the **Parity Matrix**, per-endpoint specs, cross-cutting results, open risks,
  and the cutover checklist. Then `/namht-scan` the new Java repo to seed its own KB. Remind the user
  they own deploy and cutover.

## Rails → Spring (this project) mapping cheat-sheet
`ActiveRecord` → **MyBatis mapper on the same MySQL** (SQL-first; not JPA) · scopes / complex queries →
mapper SQL (reuse the generated SQL semantics) · migrations → **Flyway** (only if adding) · `graphql-ruby`
→ **Spring for GraphQL** / DGS · `graphql-batch` / dataloader → **BatchLoader** (N+1) · Devise/JWT/Pundit
→ **Spring Security** · Sidekiq/ActiveJob → **SQS `@SqsListener`** / **Camel** · Rails validations →
Bean Validation + service checks · callbacks (`before_save`/`after_commit`…) → explicit service/domain
logic · serializers → response DTO mapping.

## Rules
- Contract identical (proven by an SDL/contract diff); behavior parity proven by golden tests — those
  are the two gates. No endpoint ships without both green.
- Port **only the scoped set** (all GraphQL + the named REST APIs); list anything out of scope.
- Never invent business rules — cite the Ruby. Never big-bang; never migrate data unless explicitly
  asked. Edits code → change discipline (minimal, in-scope, reversible). You don't deploy or cut over.
