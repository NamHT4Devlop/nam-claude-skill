---
description: Map the codebase as a dependency graph (imports/DI/calls/inheritance) enriched with business meaning → Mermaid
argument-hint: "[optional: sub-path / module to focus]"
---

Use the **namht-map** skill to build a dependency graph of the codebase from real edges
(imports, dependency injection, method calls, inheritance), enrich nodes with business
meaning from the `knowledge-base/`, and render a Mermaid `flowchart`. Call out the biggest
hubs (blast radius), coupling hot-spots, and dependency cycles.

Scope (optional sub-path/module): $ARGUMENTS
