# vendor/ — pinned third-party libraries

These minified bundles are inlined into generated HTML so reports render **offline** (no CDN call).
They are large and unreadable, which makes a malicious edit easy to miss in review — so their hashes
are pinned in `SHA256SUMS` and verified by `tests/run.sh`.

| File | Upstream | Version |
|---|---|---|
| `mermaid.min.js` | https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js | 10.9.1 |
| `cytoscape.min.js` | https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.2/cytoscape.min.js | 3.30.2 |

## Verify
```bash
cd vendor && shasum -a 256 -c SHA256SUMS
```

## Updating a library
1. Download the new bundle from the upstream URL above (note the new version).
2. `cd vendor && shasum -a 256 *.min.js > SHA256SUMS`
3. Update the version in the table, and commit the bundle + SHA256SUMS + this table **together** —
   a hash change with no version bump in the same commit is the signal a reviewer looks for.
