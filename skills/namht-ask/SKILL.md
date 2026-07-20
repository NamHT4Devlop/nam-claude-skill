---
name: namht-ask
description: >-
  Answer natural-language questions about a codebase grounded in the Knowledge
  Base (business meaning) and real source (technical detail) — never invented —
  for a mixed business+technical audience: a plain-language explanation, a
  fitting Mermaid diagram, and the precise technical detail with real
  file/field/endpoint citations. Use when the
  user asks "/ask", "how does X work", "which module handles Y", "where is Z
  implemented", or any Q&A about the project.
---

# Spec Ask — grounded codebase Q&A

A native port of Auto Spec Kit's `/ask`. Answer grounded in the Knowledge Base (business meaning)
and real source (technical detail) — never invent files, APIs, fields, or behavior.

## Procedure
0. **Check the Q&A journal first (cross-session memory).** If
   `spec-kit-sessions/answers/_journal.md` exists, read it — it is a one-line-per-question index of
   every past answer in this repo. Use it to: (a) answer *"what did I ask before / what did we
   conclude about X?"* directly from the journal; (b) when today's question was already answered,
   **say so**, link the saved answer file, reuse its conclusion, and only re-derive what changed
   since. It's a small index — reading it costs little and makes new sessions remember old ones.
1. **Ground code answers in real source.** When the question is about *how code works / where
   something is*, use Grep/Glob/Read to ground the **Technical detail** section in real files; the
   KB supplies business meaning.
2. **Select relevant KB context.** Map the question to topics and load just those
   `knowledge-base/` docs (don't dump the whole KB). If the question names a module/feature,
   load the matching `knowledge-base/modules/<module>.md` first — those deep docs are the
   richest context. Fall back to reading the actual source only if the KB lacks the answer
   (and say so).
3. **Detect vagueness.** If the question is broad/under-specified, first state your
   interpretation + assumptions, answer the most likely intent, then ask 2–3 clarifying
   questions.

## Answer structure (always, in this order) — dual audience
Write so a **non-technical reader (founder / PM / ops) AND an engineer both get full value from
the same answer.** Layer it plain → precise: never assume tech background in the top sections,
never lose precision at the bottom, and define every unavoidable term.
```
## TL;DR (one line — for everyone)
One jargon-free sentence that answers the question. Add a short analogy if it helps.

## In plain language (business / non-tech)
What it is, why it matters, how it behaves — everyday business terms. NO unexplained jargon:
the first time a technical word is unavoidable, define it inline in parentheses. A non-technical
reader must fully understand this section on its own.

## Diagram
A Mermaid diagram that fits the question — flowchart for a flow, erDiagram for data/fields,
sequenceDiagram for an interaction. Use a valid ```mermaid block, short plain labels. If a
diagram truly doesn't apply, write "(no diagram needed)".

## Technical detail (engineers)
The precise answer, citing concrete names from the KB: files, modules, endpoints,
entities, fields, functions. Full accuracy here — don't dumb it down.

## In plain words (glossary)
Any technical term used above → a one-line everyday definition. Omit the section if there were none.
```

## Rules
- **Same facts, two depths.** The plain sections and the technical section must not contradict —
  one is a simpler view of the other, not a different answer.
- Ground every claim in the KB. If it doesn't contain the answer, say so explicitly.
- When mapping business ↔ code, name the exact field / file / function.
- If `knowledge-base/` is missing entirely, tell the user to run `/namht-scan` first;
  you can still answer from direct code reading but flag the lower confidence.

## Output — answer in chat, THEN save an HTML file
1. **Answer in chat first** using the full dual-audience structure above (this is the primary output).
2. **Save the same content** to `spec-kit-sessions/answers/<slug>-<date>.md` (slug from the question).
3. **Render a self-contained HTML** (styled, with the Mermaid diagram drawn) using the bundled renderer.
   Resolve this skill's `references/` dir first (call it `$SKILL_DIR`): `${CLAUDE_PLUGIN_ROOT}/skills/namht-ask/references`
   if `CLAUDE_PLUGIN_ROOT` is set, else the `references/` folder next to this SKILL.md, else `$HOME/.claude/skills/namht-ask/references`.
   ```bash
   node "$SKILL_DIR/render-html.cjs" \
     "<repo>/spec-kit-sessions/answers/<slug>-<date>.md" \
     "<repo>/spec-kit-sessions/answers/<slug>-<date>.html" "<question>"
   ```
   (It prints the HTML path. Requires Node — if absent, keep the chat + `.md` and say HTML was skipped.)
4. **Open it**: macOS `open "<path>"` · Linux `xdg-open` · Windows `start "" "<path>"`. Give the user the path.
5. **Append ONE line to the Q&A journal** `spec-kit-sessions/answers/_journal.md` (create it with the
   header below if missing). This is the cross-session memory step — never skip it:
   ```markdown
   # Q&A Journal — one line per answered question (newest last)
   | Date | Question | Conclusion (one line) | Detail file |
   |---|---|---|---|
   | 2026-07-05 | how does the KPI flow work | 2 endpoints, no cache; levelOf() duplicated in 3 places | kpi-flow-2026-07-05.md |
   ```
   Keep the conclusion to ONE plain sentence (the TL;DR, compressed); `Detail file` is the `.md` you
   just saved (filename only). If the journal grows past ~200 rows, note that consolidation is due —
   don't delete rows silently.

Output lands under `spec-kit-sessions/` (gitignored) — no footprint in the repo.
