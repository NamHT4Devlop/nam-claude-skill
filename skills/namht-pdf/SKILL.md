---
name: namht-pdf
description: >-
  Export a report to PDF — take a Markdown or HTML file (e.g. a Spec Kit
  report/doc under spec-kit-sessions/, or any .md) and produce a PDF, rendering
  Markdown + Mermaid first if needed. Use when the user says "/pdf", "export to
  PDF", "make a PDF", "save this as PDF", "PDF the report/doc".
---

# namht-pdf — export a report/doc to PDF

Turn a Markdown or HTML report into a shareable PDF.

## Steps
0. Resolve this skill's `references/` dir first (call it `$SKILL_DIR`): `${CLAUDE_PLUGIN_ROOT}/skills/namht-pdf/references`
   if `CLAUDE_PLUGIN_ROOT` is set, else the `references/` folder next to this SKILL.md, else `$HOME/.claude/skills/namht-pdf/references`.
1. **Resolve the input.** If given a `.md`, first render it to a self-contained HTML with the
   bundled renderer (Mermaid drawn):
   `node "$SKILL_DIR/render-html.cjs" <in.md> <tmp.html> "<title>"`
   If given an `.html`, use it directly — including a hand-written or third-party one: the converter
   injects the print stylesheet into a **temp copy** (the user's file is never modified), so any HTML
   gets the same page-break/clipping protection. Opt out with `PDF_NO_PRINT_FIX=1`.
2. **Convert to PDF** (best-effort, no network):
   `bash "$SKILL_DIR/html-to-pdf.sh" <in.html> <out.pdf>`
   It prints the PDF path on success.
3. **Open it** (`open` / `xdg-open` / `start`) and give the user the path.

## Fidelity — what keeps the PDF from breaking
- **Headless Chrome is required for Mermaid.** Diagrams are drawn by JavaScript at view time, so the
  script tries Chrome/Chromium/Edge/Brave FIRST. `wkhtmltopdf` (old QtWebKit, no modern JS/CSS) is a
  last resort only and **warns** that diagrams will be missing — if the user's PDF has raw
  ```mermaid``` text instead of a picture, they converted with wkhtmltopdf or a non-JS tool.
- The bundled print stylesheet keeps a **diagram, table, code block or quote whole on one page**
  (`break-inside: avoid`), repeats table headers, prevents a heading stranded at a page foot, and
  **scales an oversized diagram down to fit a page** instead of letting it span several. Paper has
  no scrollbars, so wide content wraps/shrinks rather than being clipped.
- Chrome's default URL/date/page stamps are turned off (`--no-pdf-header-footer`).
- Complex diagrams need render time: raise it with `PDF_VIRTUAL_TIME_BUDGET=30000` (ms) if a
  diagram comes out blank.

## If no converter is available
The script prints `NO_PDF_TOOL` when neither headless Chrome/Chromium/Edge nor `wkhtmltopdf` is
found. In that case: keep the HTML and tell the user to **open it in a browser → Print → Save as
PDF** (one step, and it renders Mermaid correctly), or install Chrome. Don't fail silently.

## Notes
- 100% local — no upload/network. Output beside the source (or under `spec-kit-sessions/`); both are
  gitignored so nothing lands in a repo.
- Works great on the outputs of `/namht-document`, `/namht-qa`, `/namht-security-audit`,
  `/namht-plan`, `/namht-retro`, etc.
