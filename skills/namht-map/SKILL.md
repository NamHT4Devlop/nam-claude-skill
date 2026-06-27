---
name: namht-map
description: >-
  Map a codebase as a dependency graph — modules/files as nodes and real edges
  (imports, dependency injection, method calls, inheritance) — then enrich it
  with business meaning from the Knowledge Base and render it as a Mermaid
  diagram, highlighting core modules, coupling hot-spots, and cycles. Use when
  the user asks to "/map", "map the codebase", "show the dependency graph", or
  "visualize architecture".
---

# Spec Map — dependency graph of the codebase

A native port of Auto Spec Kit's `/map` (the original renders an interactive webview; here
we produce a Mermaid diagram + a written analysis, which renders anywhere).

## Procedure
1. **Scope.** Map the whole repo or a sub-tree the user names. Discover modules/files with
   Glob.
2. **Build real edges** with static analysis (Grep for import/require/`using`/`@Autowired`/
   constructor injection, `extends`/`implements`, and cross-module function calls). Prefer
   structural truth over guesses. Collapse to module-level nodes when the file count is large
   so the graph stays readable.
3. **Enrich with business meaning** from `knowledge-base/` (especially `06-modules.md`,
   `01-project-structure.md`, `16-architecture-patterns.md`): label each node with the
   business domain it represents, mark CORE business modules vs infrastructure/util.
4. **Analyze**: identify the most-depended-on modules (high in-degree = high blast radius),
   coupling hot-spots, layering violations (e.g. controller → DB directly), and **dependency
   cycles** (call these out explicitly — they're refactor targets).

## Output
- A **`flowchart`** Mermaid diagram (valid ```mermaid block) with short plain labels; group
  by layer/domain with subgraphs; visually distinguish core vs supporting nodes; mark cycles.
- A short written summary: node/edge counts, top hubs by in-degree, cycles found, and the
  layer/dependency rules from the KB that are honored vs violated.
- Optionally save to `spec-kit-sessions/maps/<scope>-<date>.md`.

If `knowledge-base/` is absent, still produce the structural graph but note that business
enrichment is limited (suggest `/namht-scan`). Keep the diagram legible — if there are too
many nodes, map at module granularity and offer to drill into a chosen module.
