---
name: namht-scan
description: >-
  Generate a deep, business-aware Knowledge Base for a codebase by analyzing it
  into 16 structured docs (structure, tech stack, entry points, business domain,
  domain model, modules, architecture, database, auth, core flows, API,
  conventions, business rules, integrations, errors, architecture patterns) plus
  a review-skills.md and per-module docs. Use when the user asks to "scan",
  "/scan", "generate KB", "build a knowledge base", or onboard onto a new repo.
---

# Spec Scan — generate the Knowledge Base

A native port of Auto Spec Kit's `/scan`. Produce a `knowledge-base/` folder that
captures **why the code exists and what problem it solves**, not just its structure.
This KB is the grounding for every other Spec Kit command.

> If the user already has a `knowledge-base/` (e.g. generated previously by the VS Code
> extension), prefer `/namht-rescan` to update it. Only do a full scan for a new repo
> or an explicit fresh rebuild.

## Inputs & setup
- **Confirm the git branch first — this is what gets scanned.** The scan reads the **working tree on
  disk**, so it captures the **currently checked-out branch plus any uncommitted changes**; it does
  NOT switch branches. Run `git rev-parse --abbrev-ref HEAD` (branch) and `git status --short`
  (uncommitted), then tell the user: *"I'll scan branch `<X>` as it is on disk (N uncommitted
  changes) — OK?"* If they want a different branch, ask them to `git checkout <branch>` first (never
  switch on their behalf if that could discard uncommitted work). Not a git repo → just scan the
  folder and say so.
- **Map structure with Glob/Grep/Read.** Use Glob/Grep to map the file tree, symbols and imports
  quickly, then read real source for *business intent* — the skeleton tells you where, the KB
  documents the why.
- **Secret safety.** Never read, quote, or write the contents of `.env*`, key/cert files
  (`*.pem`, `*.key`, `*.p12`), or credential files into the KB. Document that a secret exists and
  where, never its value. (The bundled analyzer only parses recognized source extensions, so
  raw secret files are skipped by default — keep it that way.)
- Confirm the target repo (default: cwd). Detect the stack first (language, framework,
  DB, build tool) by reading `package.json` / `pom.xml` / `build.gradle` / `go.mod` /
  `Gemfile` / `requirements.txt` / `*.csproj`, etc. Tailor analysis hints to the stack
  (Spring annotations, MyBatis mapper XML, Camel routes, Flyway/Liquibase migrations,
  JPA/Hibernate, Kafka/SQS, Rails ActiveRecord, Prisma, …).
- **Async messaging & integrations — extract DEEPLY (critical for microservices).** Record the
  **direction** and the **wire contract**, not just that a channel exists:
  - **SQS/SNS**: queue/topic names; **producers** (`SendMessage`/`PublishCommand`, Spring `@SqsListener`
    targets, Camel `to("aws2-sqs:…")`, Rails Shoryuken/Sidekiq workers + `aws-sdk`, Node `sqs-consumer` /
    `@aws-sdk/client-sqs`) vs **consumers**; FIFO vs standard; **DLQ**/redrive; visibility/retry; the
    **message schema** (fields) and any **idempotency key**.
  - **Apache Camel**: each route's `from(...)`/`to(...)` endpoints + EIPs — these ARE integration edges.
  - **HTTP/gRPC**: outbound base URLs/clients (who this service calls) vs inbound routes.
  - **DB**: engine (MySQL/Postgres), owned schema, **Flyway/Liquibase** migration history; flag any table
    touched by more than one service (shared-DB anti-pattern).
  Capture producer↔consumer by **exact channel name** so `/namht-system-map` can stitch services.
- If docs exist (README, `docs/`, `.github/`), ask whether to use them as context or do a
  **source-only** scan (recommended when docs may be stale).
- Output dir: `knowledge-base/` (configurable).

## What to produce
Generate the **16 section docs** specified in `references/kb-steps.md` (read it now). Each
file is `knowledge-base/NN-name.md`. Obey the golden rules: always cite real file paths +
function/class names; never write generic filler — if no evidence, write `(not found in
codebase)`; analyze at business depth; prioritize **tests > services > controllers > models**.

The five **deep** docs deserve the most effort — analyze them from three angles and
synthesize (use parallel `Task` sub-agents when the repo is large):
- `04-business-domain.md`, `05-domain-model.md`, `10-core-flows.md`,
  `13-business-rules.md`, `16-architecture-patterns.md`.

Angles to split across sub-agents (then merge, deduplicate, keep every cited item):
- **Service/Controller analyzer** — orchestration logic, routes, middleware; the business purpose of each method.
- **Test/Validation analyzer** — tests reveal intended business scenarios; validators reveal enforced constraints. Treat tests as specifications.
- **Model/Schema analyzer** — entities, state machines, DB constraints, relationships, migration history (business evolution).

## Auxiliary outputs (also required)
1. **`review-skills.md`** — start from the bundled universal checklist
   (`references/review-skills-universal.md` in this skill) and append a **Section 14 —
   Project-Specific Rules**: project naming conventions, mandatory patterns, banned anti-patterns, and the
   business rules every new feature must respect — **each with a real code citation**.
   This file is injected into every code review, so make it accurate.
2. **`modules/<module>.md` + `modules/_index.md`** — for larger projects, deep per-module
   docs: exhaustive (numbered) business flows, business rules with severity, entities,
   API/entry points, and dependencies. Process modules with a concurrency limit; for very
   large modules, analyze in chunks then merge (deduplicate, preserve every flow/rule).
3. **`_coverage-report.md`** — files discovered vs analyzed; note that all files are also
   covered by the global section docs.
4. **`17-async-events.md` (only if the service uses messaging/events)** — a per-service **Event/Contract
   Catalog**: one row per channel — `channel (queue/topic/event) · role (produce/consume) · message schema ·
   trigger · FIFO? · DLQ? · idempotency key` — plus Camel routes and outbound HTTP/gRPC targets. This is the
   language-agnostic surface `/namht-system-map`, `/namht-qa`, and `/namht-build` use for cross-service impact.

## Architecture invariants doc (16) is special
`16-architecture-patterns.md` is the **guardrail** consumed by `/namht-build` and
`/namht-review`. Make Section 6 ("Architecture Invariants — DO NOT BREAK") a numbered,
enforceable checklist with `[CRITICAL]`/`[MAJOR]` severities.

## Finish
Report: number of section docs, module docs, and coverage %. Point the user to the most
valuable files (04, 05, 10, 13, review-skills) and suggest running `/namht-build` next.
Be efficient with reads on huge repos — sample representative files per layer rather than
reading everything; note in `_coverage-report.md` what was sampled vs exhaustive.
