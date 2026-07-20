---
name: namht-rails-to-spring
description: >-
  Port a service (or a chosen set of endpoints) from one language/stack to another while
  PRESERVING its contract and business behavior — e.g. Ruby on Rails + GraphQL → Java Spring
  Boot. Contract-first and parity-verified: freeze the contract, extract the business behavior
  from the source with parallel multi-lens agents, capture golden/shadow tests of the real
  responses, re-implement on the target stack, and prove byte-for-byte parity with an INDEPENDENT
  reviewer before cutover — endpoint by endpoint (strangler). Use when the user says "/port",
  "migrate to another language", "rewrite in <language>", "Rails to Spring", "port these
  resolvers/APIs". Edits code — change discipline applies.
---

# namht-rails-to-spring — behavior-preserving cross-stack port (parity-verified, multi-agent)

Distinct from `/namht-migrate` (which evolves a contract **in place**, same codebase). This is a
**rewrite onto a different stack that must behave identically** — clients must not notice. Every
endpoint answers one question: *"does the new implementation return exactly what the old one did,
with the same side effects?"*

**The oracle is executable, not opinion.** Correctness is decided by **golden/shadow tests** — real
recorded source responses that the new code must reproduce. **Agents assist** (multi-lens extraction
to not miss rules; an independent reviewer to catch divergence) but **tests decide**. Never let
"the agents agreed" stand in for a passing parity test.

**Default target profile (this project):** Spring Boot · **MyBatis** (SQL-first, not JPA) · Flyway ·
Camel · SQS · MySQL, sharing the **same database** as the source. GraphQL on Java via **Spring for
GraphQL** (or Netflix DGS). Confirm at step 0.

## Ground rules
- **Contract frozen.** Port the GraphQL schema 1:1 and the chosen REST contracts exactly; a **diff
  proves** it (types, nullability, enums, pagination, status codes, JSON shape).
- **Behavior parity is the acceptance bar.** An endpoint is done only when its **golden/shadow tests
  pass** — happy, edge, error, and auth-denied — AND its **side effects** match.
- **Author ≠ reviewer.** Whoever writes the Java does NOT sign off parity. A separate, adversarial
  reviewer (agent) must try to find a divergence and fail it.
- **The source is the spec.** Business rules come from the Ruby (models, services, callbacks,
  validations, scopes, concerns) + its tests + the KB — **never invented**. Cite the Ruby file/line.
- **Incremental & reversible (strangler); reads before writes.** One endpoint at a time; run old and
  new side by side; **cut over read-only endpoints first, write/side-effect endpoints last**; keep
  parity tests as the regression gate; roll back per endpoint. Never big-bang.
- **Shared DB → side-effect parity is a HARD gate.** Both sides write the same MySQL; if the Java
  misses a Rails DB-side effect (timestamps, `counter_cache`, `touch`, `dependent:`, callbacks that
  write other rows) data silently drifts. Reproduce every write, or don't cut that endpoint over.
- **Reuse what the TARGET already has — MANDATORY.** The Spring side is not a blank page. Before
  writing a new service, **MyBatis mapper**, DTO/record, validator, exception handler, Camel route,
  SQS publisher or util, search the target project for one that already does it and **reuse or extend
  it**, matching its conventions. Create new ONLY when nothing fits, and record why in the **Reuse
  Report** (`| Capability needed | Existing target candidate (real path) | reuse / extend / new | Why |`)
  alongside the Parity Matrix. **Never add a dependency** the target already covers without the user's
  OK. This keeps the port idiomatic Java rather than a transliteration of Ruby — and stops N copies of
  the same mapper appearing as endpoints are ported one by one.
- Minimal, conventional, no drive-by refactors. The human deploys and controls cutover.

## Agent roster — where to fan out (and where NOT to)
Spawn sub-agents (`Task`) in parallel at two stages; keep code-writing single-threaded per endpoint.
- **Extraction (per endpoint, parallel lenses)** — different agents catch different rules:
  1. **Resolver/controller logic** (`namht-codebase-analyzer`) — orchestration, params, branching.
  2. **Model & data rules** — callbacks, validations, **default scopes**, associations, `dependent:`,
     enums, STI, serialized columns.
  3. **Tests-as-spec** — read the Ruby request/model specs & VCR cassettes; they encode intended
     behavior and edge cases.
  4. **Side-effects & flows** (`namht-business-flow-tracer`) — DB writes to OTHER tables, SQS
     publishes, Camel routes, emails, `touch`/counter caches.
  Merge into one **behavior-spec**, then run a **completeness critic** agent: *"what business rule,
  edge case, or side effect in the Ruby is NOT yet in this spec?"* Loop until it finds nothing new.
- **Blast radius** (`namht-impact-detector`) — who consumes this endpoint, so parity is enforced
  where it actually matters.
- **Verification (per endpoint, parallel, INDEPENDENT of the author)** — an adversarial panel:
  `namht-business-consistency-reviewer` (rule parity vs source/KB), `namht-security-reviewer` (auth /
  IDOR / role allow-deny parity), `namht-performance-reviewer` (N+1, query-count parity vs the Ruby),
  plus a **parity auditor** that reads the Ruby and the Java side by side and lists every behavioral
  difference, plus a **reuse check** — did this endpoint add a service/mapper/DTO/util the target already
  had? An endpoint passes only if the panel finds no unresolved divergence, no avoidable duplication,
  AND the tests are green.
- **Scale to risk, not vanity.** Fan out on hard/high-risk endpoints; for a trivial read, one extractor
  + the tests may be enough. More agents cost tokens — spend them where a miss is expensive.

## Step 0 — Scope & discovery
Confirm (ask what's missing): source stack (Rails, `graphql-ruby`, auth: Devise/JWT/Pundit/CanCan) ·
target profile · **the exact endpoint set** (ALL GraphQL resolvers + the specific 3–5 REST APIs;
everything else OUT of scope) · DB (shared default) · async in scope (SQS/Camel/jobs?) · cutover
(strangler default) · **the parity oracle available** (can the source run locally / is there a staging
env / are there request specs or VCR cassettes to replay?). Write a short **Scope & Parity Plan** and
confirm before porting.

## Step 1 — Ground the source
Run/reuse `/namht-scan` on the Rails repo → KB of business rules, flows, auth, and the Event/Contract
Catalog (SQS/Camel). No KB → scan first; grounding a rewrite on grep alone misses implicit rules.

## Step 2 — Freeze the contract (contract-first)
- **GraphQL:** export the source SDL, recreate it on Java, and **diff the two SDLs — must be
  identical** (types, fields, nullability, enums, inputs, interfaces/unions, directives, custom
  scalars, Relay connections). Map types → Java records/DTOs.
- **REST (3–5):** capture each contract (path, method, params, headers, status codes, JSON shape) as
  an OpenAPI/snapshot and freeze it.

## Step 3 — Parity oracle (build this BEFORE writing Java)
Prefer the strongest oracle you can get:
1. **Shadow/replay (best):** send the **same request to both** the running Rails and the new Spring
   endpoint and **diff canonicalized responses**. Generate cases by replaying **Rails request specs /
   VCR cassettes** and representative real queries (happy · boundary · invalid · auth-denied · empty ·
   large). Capture the response AND the side effects (rows written, SQS messages).
2. **Recorded golden fixtures:** if you can't run both live, record real Rails responses once and
   assert Spring reproduces them.
3. **No runnable source:** say so — parity is weaker; lean harder on the extraction spec + reviewer
   panel, and mark those endpoints higher-risk.
**Normalize before diffing** (or you'll chase false diffs): canonical JSON key order; normalize
timestamps/UUIDs/volatile ids; decimal scale (Ruby `BigDecimal` ↔ Java `BigDecimal`); timezone/format;
GraphQL error masking. Keep an explicit **allowed-diff list** the user signs off — anything else is a
real failure.

**Bundled harness — don't rebuild it.** `references/shadow-parity.cjs` (Node ≥18, no deps) does exactly
this: fill a `cases.json` (copy `references/cases.example.json`). Resolve this skill's `references/`
dir first (call it `$SKILL_DIR`): `${CLAUDE_PLUGIN_ROOT}/skills/namht-rails-to-spring/references` if
`CLAUDE_PLUGIN_ROOT` is set, else the `references/` folder next to this SKILL.md, else
`$HOME/.claude/skills/namht-rails-to-spring/references`. Then run
`node "$SKILL_DIR/shadow-parity.cjs" cases.json --source <rails-url>
--target <spring-url> [--graphql-path /graphql] [--source-token … --target-token …]`. For tokens,
prefer the `SOURCE_TOKEN` / `TARGET_TOKEN` env vars (they win over the flags; argv leaks into
`ps`/shell history/CI logs). It sends each
case to both, canonicalizes (sorts keys, redacts `ignore` paths like `**.updatedAt`, sorts
`sortArraysAt` arrays), diffs, prints per-field failures, and **exits non-zero if any case diverges** —
use it as the per-endpoint gate and in CI. Grow `cases.json` per endpoint (happy · boundary · invalid ·
auth-denied · empty · large); it IS the parity oracle.

## Step 4 — Per-endpoint loop (all GraphQL resolvers + the named REST APIs)
Independently per endpoint, so each ships and cuts over alone:
1. **Behavior-spec** via the extraction fan-out + completeness critic (above). Make Rails' *implicit*
   behavior explicit; cite Ruby lines.
2. **Golden/shadow cases** from step 3 for this endpoint — including side-effect assertions.
3. **Implement on target — reuse first.** Search the target project and fill the **Reuse Report** before
   writing anything: if an existing service, MyBatis mapper, DTO, validator or util already covers a
   piece, extend it instead of adding a parallel one. Then build what's genuinely missing: GraphQL resolver (`@QueryMapping`/`@MutationMapping`/`@SchemaMapping`) or
   REST controller; a service carrying the ported rules; a **MyBatis mapper** on the same MySQL
   (reuse the SQL semantics ActiveRecord produced — scopes/joins/order); Flyway only for a genuinely
   new column (avoid while DB is shared); a Camel route / SQS publish matching the source's channel +
   message schema. Minimal, matches conventions.
4. **Verify parity** — run the oracle; output must match (modulo the allowed-diff list). Then the
   **independent reviewer panel** must find no unresolved divergence (rules, auth, N+1, side effects).
   Fix until both gates are green. Use a **BatchLoader/dataloader** for N+1.
5. **Parity Matrix row:** `endpoint · contract identical? · oracle green? · reviewer panel clear? ·
   query-count parity? · side effects matched? · risk tier · notes`.

## Step 5 — Cross-cutting parity (verify once, across all ported endpoints)
Auth (→ Spring Security: same tokens/claims/roles, same allow-deny) · error format (GraphQL `errors`
array & masking / REST body + status) · pagination (Relay cursors reproduced) · N+1 (dataloaders) ·
**GraphQL specifics** (nullability, custom scalars, enum coercion, input defaults, interface/union
`__typename`, directives) · **shared-MySQL gotchas** (default scopes, `counter_cache`, `touch`, STI,
enum-as-int, serialized/JSON columns, timezone, `created_at/updated_at` written in Ruby) · async
(SQS/Camel channel names + message schema + FIFO/DLQ/idempotency match the Event/Contract Catalog).

## Step 6 — Cutover + completeness gate + report
- **Strangler cutover:** run both on the shared DB; route per endpoint behind a gateway/flag;
  **reads first, writes last**; keep the parity tests as the gate; roll back per endpoint. Because the
  DB is shared, do a **reconciliation check** on write endpoints (sample rows both would write and
  diff) before trusting dual-run.
- **Completeness gate (a final critic):** confirm **every** scoped endpoint has contract-diff clean +
  oracle green + reviewer panel clear; **log anything deferred** — no silent drops. Report coverage:
  N GraphQL resolvers + M REST APIs, X verified, Y deferred (why).
- **Report (dual-audience):** save to `spec-kit-sessions/port/<service>-<date>.md` + render HTML — the
  Scope & Parity Plan, the **Parity Matrix**, per-endpoint specs, cross-cutting results, risk tiers,
  open risks, cutover checklist. Then `/namht-scan` the new Java repo to seed its KB. The human owns
  deploy and cutover.

## Risk tiering (drives how much rigor each endpoint gets)
Score each endpoint by: source **test coverage** (low → higher risk), **business complexity**, and
whether it **writes / has side effects** (write endpoints are riskiest on a shared DB). High-risk →
more golden/shadow cases, the full reviewer panel, and an explicit human sign-off before cutover.

## Rails → Spring (this project) mapping cheat-sheet
`ActiveRecord` → **MyBatis mapper on the same MySQL** (SQL-first) · scopes/complex queries → mapper SQL
(reuse the generated semantics) · migrations → **Flyway** (only if adding) · `graphql-ruby` → **Spring
for GraphQL** / DGS · `graphql-batch`/dataloader → **BatchLoader** · Devise/JWT/Pundit/CanCan → **Spring
Security** (authn + method authz) · Sidekiq/ActiveJob → **SQS `@SqsListener`** / **Camel** · validations
→ Bean Validation + service checks · callbacks → explicit service/domain logic · serializers → response
DTO mapping.

## Rules
- Two gates per endpoint, both green: **contract identical** (SDL/contract diff) + **behavior parity**
  (oracle) — and the **independent reviewer** signs off. No endpoint ships otherwise.
- **Author ≠ reviewer.** Tests are the oracle; agents assist but never override a failing test.
- Port **only the scoped set**; never invent rules (cite the Ruby); never migrate data unless asked;
  reproduce every DB side effect; reads-before-writes on cutover; never big-bang. You don't deploy.
