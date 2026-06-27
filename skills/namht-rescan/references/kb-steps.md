# Knowledge Base — Section Specs (16 docs)

> Ported from Auto Spec Kit's `KB_STEPS`. Each section becomes one file under
> `<repo>/knowledge-base/`. Every prompt is designed to reason about **business
> intent** from code, not just describe technical structure.
>
> **Golden rules for every section:**
> 1. ALWAYS cite real file paths + function/class/variable names as evidence.
> 2. NEVER write generic statements — if no evidence is found, write `(not found in codebase)`.
> 3. Analyze at BUSINESS DEPTH — explain *what user problem* each feature solves.
> 4. Priority of evidence: **test files > service layer > controller > model**.
> 5. Magic numbers → explain their business meaning.
> 6. Treat XML/`.properties`/YAML/SQL migrations as first-class business context.

Sections **04, 05, 10, 13, 16** are the highest-value "deep analysis" docs — spend
the most effort there and, when possible, analyze them with parallel sub-agents
(service layer / tests+validators / models+schema) then synthesize.

---

## 01 — `01-project-structure.md` — Project Structure & Ownership Map
Analyze the project structure. Always cite actual paths.
1. **Project Type & Scale** — monolith / monorepo / microservices / hybrid? Evidence. How many deployable units (name + path)? What stage (MVP / scale-up / enterprise legacy)?
2. **Folder Structure with Business Meaning** — directory tree 2–3 levels; for each folder: technical function AND the business domain it represents.
3. **Dependency Direction** — which module depends on which (text diagram of coupling).
4. **Critical vs Supporting Code** — which dirs hold CORE business logic vs infra/utility.
5. **Technical Debt Indicators** — signs of tech debt visible from structure.

## 02 — `02-tech-stack.md` — Tech Stack & Architecture Decisions
1. **Stack Summary Table** — `| Layer | Technology | Version | Role |`.
2. **Architecture Decision Inferences** — for each important tech choice, WHY it was selected.
3. **Version Risks** — old/deprecated dependencies.
4. **Testing Stack** — framework, coverage, mocking (check package.json, pom.xml, build.gradle, Gemfile, go.mod, etc.).
5. **Build & Deploy Pipeline** — build tool, Dockerfile, CI/CD, scripts, plugin configs.

## 03 — `03-entry-points.md` — Entry Points & Runtime Behavior
1. **Application Startup Sequence** — from main file to "ready".
2. **All Entry Points** — every way external parties can trigger code.
3. **Environment Configuration** — all env vars, properties/yml, profiles, `.env`, config classes.
4. **Health & Observability** — health endpoints, actuator, metrics, tracing, logging config.
5. **Local Setup (step-by-step)** — prerequisites, DB, migrations, seed data, run commands.

## 04 — `04-business-domain.md` — Business Domain & User Stories ★DEEP
Answer as a Business Analyst reading the ENTIRE codebase.
1. **Product Brief**  2. **User Roles & Capabilities Matrix**  3. **Top 10 Core Features (ranked by business importance)**  4. **User Journey (main flow)**  5. **Business Constraints Evident in Code**.

## 05 — `05-domain-model.md` — Domain Model & Entity Lifecycle ★DEEP
Check ALL sources: JPA `@Entity`, Prisma schema, TypeORM, Django models, ActiveRecord, MyBatis mapper XML (resultMap/resultType), SQL `CREATE TABLE`, Proto messages.
1. **Entity Catalog**  2. **State Machines**  3. **Entity Relationships** (ORM + MyBatis XML joins)  4. **Aggregate Boundaries**  5. **Data Lifecycle**.

## 06 — `06-modules.md` — Module Map & Feature Boundaries
1. **Module Overview Table**  2. **Module Deep-Dive**  3. **Cross-Module Communication**  4. **Feature Flags / Toggles**  5. **Module Maturity Assessment**.

## 07 — `07-architecture-diagram.md` — System Architecture & Data Flow
1. **High-Level Architecture Diagram**  2. **Request Journey (end-to-end)**  3. **Async / Background Processing**  4. **External Service Integration**  5. **Failure Points & Resilience**.

## 08 — `08-database-schema.md` — Database Schema & Query Patterns
1. **Schema Overview** (JPA, Prisma, TypeORM, Django, ActiveRecord, SQL migrations, MyBatis resultMaps).
2. **Full ERD**  3. **Critical Business Columns**  4. **Index Strategy**  5. **Data Integrity & Constraints** (DB-level + ORM validation: `@NotNull/@Size`, Prisma `@unique`, Rails `validates`).
6. **Migration History** — Flyway `V*.sql`, Liquibase, Prisma, Rails `db/migrate`, Alembic — what business decision drove each change?

## 09 — `09-auth-security.md` — Auth, Security & Permission Model
1. **Authentication Mechanism**  2. **Authorization Model**  3. **Permission Matrix**  4. **Auth Flow Sequence Diagrams**  5. **Security Hardening**.

## 10 — `10-core-flows.md` — Core Business Flows (End-to-End) ★DEEP — MOST IMPORTANT
Identify and diagram ALL important core flows (min 3, max 7). For each flow, trace through EVERY layer (entry → service → domain → data → response), with state transitions and error/rollback paths.

## 11 — `11-api-docs.md` — API Reference
**API Overview** · **Endpoints by Module** · **Rate Limits & Special Behaviors**. List ALL endpoints.

## 12 — `12-conventions.md` — Coding Conventions & Patterns
Every rule MUST have a real code example.
1. Naming  2. Folder & File Organization  3. Architecture Layers & Rules  4. Error Handling Pattern  5. Async/Await Pattern  6. Testing Conventions  7. Logging Convention  8. "The Rules" — quick reference card.

## 13 — `13-business-rules.md` — Business Rules & Invariants ★DEEP — MOST IMPORTANT
Document ALL business rules implemented in code.
1. Validation Rules  2. Business State Rules (state-machine)  3. Business Calculation Rules  4. Access-Control Business Rules  5. Time-Based Rules  6. Business Invariants  7. **Under-Enforced Business Rules (Risk)**.

## 14 — `14-integrations.md` — Integration Map & External Dependencies
1. **Integration Map** — all external systems (REST, SOAP, SQS/Kafka/RabbitMQ, AWS/GCP/Azure, payment, email/SMS, Elasticsearch, Redis).
2. **Integration Details** — protocol, auth, retry, circuit breaker, timeout, error handling.
3. **Internal Service Communication** — REST, gRPC, queues, Camel routes, event bus, shared DB.
4. **Event-Driven Integration** — Kafka topics, SQS queues, SNS, RabbitMQ exchanges, domain events — producers, consumers, schemas.
5. **Integration Risks & Single Points of Failure**.

## 15 — `15-error-scenarios.md` — Error Scenarios & Operational Runbook
1. Error Response Taxonomy  2. Critical Error Scenarios (business impact)  3. Data Consistency Risks  4. Graceful Degradation  5. Operational Runbook (common issues)  6. Logging & Observability.

## 16 — `16-architecture-patterns.md` — Architecture & Design Patterns ★DEEP — GUARDRAILS
Document the ACTUAL architecture so future changes follow it and DO NOT break the design. Cite real files/classes. A large repo often mixes MULTIPLE patterns — capture each + WHERE it applies.
1. **Architectural Style(s)** — Layered / Hexagonal / Clean / DDD / CQRS / Event-Driven / Pipeline (Camel) / MVC / Modular Monolith / Microservices — per module + evidence.
2. **Design Patterns Catalog** — every recurring pattern with a real example (file + class) and WHEN to use it here.
3. **Layer & Dependency Rules (allowed vs forbidden)** — make them explicit & enforceable; cite where honored.
4. **Module Boundaries & Communication** — how modules talk (call / port / event / queue / shared DB); what crossing is allowed.
5. **Extension Recipes** — "Add a REST endpoint", "Add an entity + persistence", "Add an async consumer" — step-by-step, citing an existing example to copy.
6. **Architecture Invariants — DO NOT BREAK** — a numbered checklist of hard rules new code MUST satisfy (layering, naming, transaction boundaries, where validation lives, idempotency for consumers…). Mark `[CRITICAL]`/`[MAJOR]`. **This list is used to review every generated change.**

---

## Auxiliary outputs (also written by Scan)
- `review-skills.md` — the universal review checklist (see `review-skills-universal.md`) with a **Section 14 — Project-Specific Rules** appended (naming, mandatory patterns, banned anti-patterns, business rules every new feature must respect — each with a code citation).
- `modules/<module>.md` + `modules/_index.md` — deep per-module docs for large projects (exhaustive flows + rules + entities + API + dependencies).
- `_coverage-report.md` — which files were analyzed vs covered by global scan only.
