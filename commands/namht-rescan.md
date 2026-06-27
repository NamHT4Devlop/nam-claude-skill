---
description: Update the existing Knowledge Base incrementally from recent code changes (git-diff aware)
argument-hint: "[optional: base ref, e.g. main or a commit]"
---

Use the **namht-rescan** skill to incrementally update the existing `knowledge-base/`:
find changed source files (via git), map them to the affected KB docs, and refresh only
those — preserving unrelated content. If there is no existing KB, fall back to `/namht-scan`.

Base ref to diff against (optional): $ARGUMENTS
