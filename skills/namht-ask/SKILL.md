---
name: namht-ask
description: >-
  Answer natural-language questions about a codebase grounded ONLY in its
  Knowledge Base (knowledge-base/ + modules/), for a mixed business+technical
  audience: a plain-language explanation, a fitting Mermaid diagram, and the
  precise technical detail with real file/field/endpoint citations. Use when the
  user asks "/ask", "how does X work", "which module handles Y", "where is Z
  implemented", or any Q&A about the project.
---

# Spec Ask — grounded codebase Q&A

A native port of Auto Spec Kit's `/ask`. Answer using **only** the project's Knowledge Base;
never invent files, APIs, fields, or behavior.

## Procedure
1. **Select relevant KB context.** Map the question to topics and load just those
   `knowledge-base/` docs (don't dump the whole KB). If the question names a module/feature,
   load the matching `knowledge-base/modules/<module>.md` first — those deep docs are the
   richest context. Fall back to reading the actual source only if the KB lacks the answer
   (and say so).
2. **Detect vagueness.** If the question is broad/under-specified, first state your
   interpretation + assumptions, answer the most likely intent, then ask 2–3 clarifying
   questions.

## Answer structure (always, in this order)
```
## In plain language
For a non-technical reader (BA / product / business): what it is, why it matters, how it
behaves — everyday business terms, no jargon, analogy if helpful.

## Diagram
A Mermaid diagram that fits the question — flowchart for a flow, erDiagram for data/fields,
sequenceDiagram for an interaction. Use a valid ```mermaid block, short plain labels. If a
diagram truly doesn't apply, write "(no diagram needed)".

## Technical detail
The precise answer, citing concrete names from the KB: files, modules, endpoints, entities,
fields, functions.
```

## Rules
- Ground every claim in the KB. If it doesn't contain the answer, say so explicitly.
- When mapping business ↔ code, name the exact field / file / function.
- If `knowledge-base/` is missing entirely, tell the user to run `/namht-scan` first;
  you can still answer from direct code reading but flag the lower confidence.

Keep answers conversational in chat. Optionally offer to save a richer write-up via
`/namht-document` for a specific feature/entity.
