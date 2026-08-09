#!/usr/bin/env node
/**
 * print-fix.cjs — inject a print stylesheet into ANY HTML before converting it to PDF.
 *
 * HTML produced by this kit already carries these rules; a hand-written or third-party HTML does
 * not, so without this its diagrams split across pages and wide content is clipped (paper has no
 * scrollbars). Reads <in.html>, writes <out.html>. Idempotent: does nothing if the marker is present.
 *
 * Usage: node print-fix.cjs <in.html> <out.html>
 */
'use strict';
const fs = require('fs');
const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('usage: print-fix.cjs <in.html> <out.html>'); process.exit(2); }

const MARKER = 'namht-print-css';
const CSS = `
<style id="${MARKER}">
/* Injected by namht-pdf so the PDF keeps its layout. */
@page{size:A4;margin:14mm 12mm}
@media print{
  html,body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  /* a diagram, table, code block, image or quote must never be split across pages */
  .mermaid,table,pre,blockquote,figure,img,svg{break-inside:avoid!important;page-break-inside:avoid!important}
  tr,li{break-inside:avoid;page-break-inside:avoid}
  thead{display:table-header-group}
  h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}
  /* overflow is CUT on paper — shrink or wrap instead of clipping */
  .mermaid,pre,table,div{overflow:visible!important}
  pre{white-space:pre-wrap!important;word-break:break-word}
  /* keep every diagram/image inside the page box; scale an oversized one down to fit one page */
  .mermaid svg,figure svg,img{width:auto!important;height:auto!important;max-width:100%!important;max-height:170mm!important}
  /* hide obvious on-screen chrome that has no meaning on paper */
  .toolbar,.no-print,nav.toc{display:none!important}
}
</style>`;

let html;
try { html = fs.readFileSync(inFile, 'utf8'); }
catch (e) { console.error(`cannot read ${inFile}: ${e.message}`); process.exit(1); }

if (html.includes(MARKER)) { fs.writeFileSync(outFile, html); process.exit(0); }

// Insert as late as possible so it wins over the document's own styles.
// Use lastIndexOf: a big inlined bundle (e.g. mermaid) can contain "</body>"/"</head>" as string
// literals, and hitting one of those would corrupt the script it sits in.
let at = html.lastIndexOf('</body>');
if (at < 0) at = html.lastIndexOf('</html>');
const out = at >= 0 ? html.slice(0, at) + CSS + '\n' + html.slice(at) : html + CSS;
fs.writeFileSync(outFile, out);
