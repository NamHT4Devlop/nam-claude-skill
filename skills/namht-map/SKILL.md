---
name: namht-map
description: >-
  Generate an INTERACTIVE HTML dependency graph of a codebase (Cytoscape.js) —
  nodes are files/classes/routes, edges are real imports, dependency injection,
  inheritance (extends/implements) and method calls, colored by architecture
  layer, with zoom/pan, click-to-highlight-neighbors, search, layer filters and
  hub highlighting. Opens in the browser. Use when the user asks to "/map", "map
  the codebase", "show the dependency graph", "code graph", or "visualize architecture".
---

# namht-map — interactive code graph (HTML)

Produces a **single self-contained interactive HTML file** (Cytoscape.js) — NOT a Markdown/
Mermaid dump. It runs a bundled, dependency-free multi-language static analyzer
(`references/graph-builder.js`, pure Node `fs`/`path`) supporting TS/JS, Python, Java/Kotlin,
Go, Ruby, C#, PHP and Rust, then injects the graph into `references/viewer-template.html`.

## How to run it
1. **Pick the root.** Default = the current project (cwd). If the user named a sub-path/module,
   use that folder as the root (the analyzer scans the folder you point it at). Optional `mode`:
   `all` (default — files+classes+routes+KB), `files` (lighter, import graph only), `classes`,
   `routes`, `domain` (KB only).
2. **Run the bundled generator with Node** (Node ≥18; v20+ ideal). Resolve this skill's
   `references/` dir first (call it `$SKILL_DIR`): `${CLAUDE_PLUGIN_ROOT}/skills/namht-map/references`
   if `CLAUDE_PLUGIN_ROOT` is set, else the `references/` folder next to this SKILL.md, else
   `$HOME/.claude/skills/namht-map/references`:
   ```bash
   node "$SKILL_DIR/build-map.cjs" "<PROJECT_ROOT>" "" all
   ```
   - Arg 1 = project root (absolute path preferred). Arg 2 = `""` lets it default the output to
     `<root>/spec-kit-sessions/maps/<name>-<date>.html` (gitignored). Arg 3 = mode.
   - The script prints the **output HTML path on stdout** (stats on stderr). Capture it.
   - If `node` isn't found, tell the user Node.js is required for the interactive graph.
3. **Open the file** for the user:
   - macOS: `open "<path>"` · Linux: `xdg-open "<path>"` · Windows: `start "" "<path>"`.
4. **Give a short written summary** alongside the file: from the stderr stats (or by reading the
   generated graph) report node/edge counts, the **top hubs** (highest-degree nodes = biggest
   blast radius), the architecture layers present, and any obvious coupling concern. Tell the
   user that clicking a node in the viewer shows its "Used by / Depends on".

## What the viewer gives the user
- Zoom/pan; **click a node** → highlights neighbors + a details panel (file, type, layer,
  degree, used-by, depends-on, methods, fields); **double-click** → focus/zoom.
- **Search** box, **layer filter** (click legend rows to toggle), **Highlight hubs** button,
  **Fit** and **Re-layout**. Edges are directional; `extends` (red), `implements` (dashed),
  `injects` (green) are visually distinct.

## Notes
- Knowledge Base enrichment is automatic: in `all`/`domain` mode the analyzer also pulls
  `knowledge-base/*.md` as domain nodes, so the KB shows beside the code when present.
- Large repos: if a graph exceeds ~1800 nodes the generator auto-switches to `files` mode for
  readability; you can also pass `files` explicitly, or point it at a sub-module to drill in.
- **Offline by default when vendored.** If the repo has `vendor/cytoscape.min.js`, the generator
  **inlines** it so the HTML is fully self-contained — zero external network calls (enterprise /
  air-gapped safe). Without `vendor/`, it falls back to a Cytoscape CDN link (needs internet).
  Either way your graph data is embedded inline — no code leaves the machine.
- Output lives under `spec-kit-sessions/maps/` which is gitignored, so nothing lands in a commit.
- If the user instead wants a graph the AGENT can query (an agent-queryable index) rather than a human
  visual, that's a different tool — say so rather than forcing this viewer to do it.
