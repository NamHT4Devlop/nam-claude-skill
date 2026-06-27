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
- Confirm the target repo (default: cwd). Detect the stack first (language, framework,
  DB, build tool) by reading `package.json` / `pom.xml` / `build.gradle` / `go.mod` /
  `Gemfile` / `requirements.txt` / `*.csproj`, etc. Tailor analysis hints to the stack
  (Spring annotations, MyBatis mapper XML, Camel routes, Flyway/Liquibase migrations,
  JPA/Hibernate, Kafka/SQS, Rails ActiveRecord, Prisma, …).
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

## Architecture invariants doc (16) is special
`16-architecture-patterns.md` is the **guardrail** consumed by `/namht-build` and
`/namht-review`. Make Section 6 ("Architecture Invariants — DO NOT BREAK") a numbered,
enforceable checklist with `[CRITICAL]`/`[MAJOR]` severities.

## Finish
Report: number of section docs, module docs, and coverage %. Point the user to the most
valuable files (04, 05, 10, 13, review-skills) and suggest running `/namht-build` next.
Be efficient with reads on huge repos — sample representative files per layer rather than
reading everything; note in `_coverage-report.md` what was sampled vs exhaustive.
