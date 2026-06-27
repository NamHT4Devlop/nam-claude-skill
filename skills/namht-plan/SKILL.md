---
name: namht-plan
description: >-
  Act as a Product Owner / Business Analyst — turn an Epic (title + description)
  into Features → per-feature Impact Analysis (old flow ↔ new flow) → a
  stakeholder Confirmation Checklist → User Stories with Given/When/Then
  acceptance criteria and story points → a Sprint Plan, grounded in the
  Knowledge Base. Use when the user asks to "/plan", "plan user stories", "break
  down this epic", or wants PO/BA artifacts.
---

# Spec Plan — Epic → user stories (PO/BA)

A native port of Auto Spec Kit's `/plan`. You are a senior BA + Product Owner. Understand
INTENT before solution. Ground everything in the repo's `knowledge-base/`; discover HIDDEN
requirements (implicit rules, side effects) from it.

## Input
Ask for (or accept) the **Epic Title** and **Epic Description** (problem, goals, constraints).
That's all you need — derive the features yourself.

## 7-step pipeline
1. **KB Deep Investigation** — from the KB, gather: related entities (existing + new),
   applicable business rules (validation, authorization, state-machine, calculation,
   time-based, invariants), affected flows, integrations, and affected modules. Cite KB sources.
2. **Auto Feature Discovery** — split the Epic into **3–8 features**, ordered by dependency;
   include cross-cutting features (auth, audit, migration) when needed. For each: id, title,
   description, scope (in/out), affected entities, affected flows, complexity (Low/Med/High).
3. **Impact Analysis per feature** — for each feature: EXISTING flow (before) → NEW flow
   (after, step by step) → DELTA / breaking changes (data model, API, state machines,
   permissions, integrations) → migration / backward compatibility → dependencies.
4. **Confirmation Checklist** — categorize open questions: 🔴 MUST CONFIRM BEFORE DEV
   (blocking), 🟡 SHOULD CLARIFY EARLY, 🔵 ASSUMPTIONS MADE (validate later), ⚪ OUT OF SCOPE.
   Each item: clear question/assumption, context, who to ask (PO/Tech Lead/Designer/Security),
   related feature.
5. **User Story Generation** — per feature, ≥3 stories. Each story: id (`US-F1-001`), title,
   role, action, benefit, priority (P1/P2/P3), story points (1/2/3/5/8/13), sprint, ≥3
   acceptance criteria in **Given/When/Then** (happy + error + edge), definition of done,
   impactNotes (BEFORE vs AFTER flow), technical notes, API endpoints, dependencies. Include
   an auth story if the feature is access-restricted, and error-handling for critical flows.
6. **Sprint Planning** — assign sprints respecting dependencies; ~35 points/sprint capacity;
   P1 stories in early sprints; Sprint 1 must deliver MVP value. Note total points and
   estimated sprints (points ÷ 35).
7. **Output** — write artifacts under `spec-kit-sessions/`:
   - `user-stories-<epic>-<date>.md` (and/or JSON) — the full backlog with a sprint board.
   - `impact-analysis-<epic>-<date>.md`
   - `confirmation-<epic>-<date>.md`
   Summarize: total stories, total points, estimated sprints, and the count of 🔴 must-confirm items.

Acceptance criteria must be specific and measurable (not vague). Every story should be
independent, valuable, testable, and fit one sprint.
