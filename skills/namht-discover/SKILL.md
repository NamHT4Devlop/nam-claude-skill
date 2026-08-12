---
name: namht-discover
description: >-
  Product/requirement discovery BEFORE planning — interrogate a fuzzy idea with
  forcing questions (who has the pain, a concrete real example, the smallest
  valuable version, what's explicitly out, the success metric, what existing
  flow/data it touches), push back on weak framing, and output a SHARPENED
  problem statement + scope + success criteria ready for /namht-plan. Use when the
  user says "/discover", "office hours", "I want to build…", or brings a vague idea.
---

# namht-discover — sharpen the problem before any plan/code

Stop a vague idea from becoming the wrong build.
Interrogate first, then restate a crisp problem. Conversational — output is a sharpened brief, not code.

## Forcing questions (ask the ones still unanswered; 1–2 at a time, not a wall)
1. **Who exactly** has this pain — a specific person/role, not "users"?
2. **A real example** that happened (not hypothetical): walk me through the last time it hurt.
3. **Smallest valuable version** — what's the thinnest slice that's still worth shipping?
4. **Explicitly NOT** doing — what's out of scope (so we don't gold-plate)?
5. **Success metric** — how do we KNOW it worked (a number/behavior change), not "users like it"?
6. **Existing surface** — which current flow/entity/endpoint does it touch? (check KB
   `10-core-flows`/`13-business-rules`) — reuse vs new.

## Push back (don't just take the framing)
If the stated "solution" hides a different real problem, say so and reframe ("you said X app, but you
described Y"). Challenge scope creep, premature solutions, and unmeasurable goals. Be direct but brief.

## Output — Sharpened brief (chat; offer to save to `namht-sessions/discovery/<slug>-<date>.md`)
```
## In plain words            ← the real problem in 2–3 jargon-free sentences
## Who & the pain            ← the specific user + the concrete example
## Smallest valuable slice   ← the thin first version
## Scope                     ← In / Out (explicit)
## Success metric            ← measurable signal it worked
## Touches (existing)        ← flows/entities/endpoints affected (KB), reuse vs new
## Open questions            ← what still needs a decision (who decides)
```

## Rules
- Don't design the solution yet — sharpen the problem. Hand the brief to **`/namht-plan`** next.
- Ground "touches" in the KB (don't invent existing flows). If no KB, say so.
- Keep it short and high-signal; never produce a 30-question survey.
