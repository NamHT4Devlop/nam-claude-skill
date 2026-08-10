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
@page{size:A4;margin:14mm 12mm;background:#0f1420}
@media print{
  /* Dark page (#0f1420). print-color-adjust:exact stops the browser dropping backgrounds when printing.
     Set PDF_LIGHT=1 to keep the document's own colours instead — see html-to-pdf.sh. */
  html,body{background:#0f1420!important;color:#e6e9ef!important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1,h2,h3,h4,h5,h6{color:#f2f4f8!important}
  p,li,td,th,span,div,em,strong,blockquote{color:inherit}
  a{color:#9bb0ff!important}
  hr{border-color:#2a3040!important}
  code,kbd,samp{background:#1b2130!important;color:#c9d2ff!important}
  pre{background:#0b1020!important;color:#e2e8f0!important;border:1px solid #2a3040}
  pre code{background:none!important;color:inherit!important}
  table{border:1px solid #2a3040}
  th{background:#4f46e5!important;color:#fff!important}
  td{background:#151b29!important;color:#e6e9ef!important;border-color:#2a3040!important}
  /* Diagrams and raster images keep a light panel: Mermaid bakes its colours into the SVG at render
     time, so a dark panel would swallow its strokes and labels. */
  .mermaid,figure,img{background:#fff!important}
  .mermaid{border-color:#cbd5e1!important;padding:8px}
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

// Already injected (e.g. HTML this kit generated, or a second pass) → copy through untouched.
if (html.includes(MARKER)) { fs.writeFileSync(outFile, html); process.exit(0); }

// PDF_LIGHT=1 → keep the page/layout rules but drop the dark palette (e.g. when printing on paper).
const LIGHT = process.env.PDF_LIGHT === '1';
if (LIGHT) {
  const light = CSS
    .replace(/@page\{[^}]*\}/, '@page{size:A4;margin:14mm 12mm}')
    .replace(/html,body\{[^}]*\}/, 'html,body{background:#fff!important;color:#111!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}')
    .replace(/^\s*(h1,h2,h3,h4,h5,h6|a|hr|code,kbd,samp|pre|pre code|table|th|td)\{[^}]*\}\n/gm, '');
  fs.writeFileSync(outFile, insert(html, light));
  process.exit(0);
}

// Insert as late as possible so it wins over the document's own styles.
// Use lastIndexOf: a big inlined bundle (e.g. mermaid) can contain "</body>"/"</head>" as string
// literals, and hitting one of those would corrupt the script it sits in.
function insert(doc, css) {
  let at = doc.lastIndexOf('</body>');
  if (at < 0) at = doc.lastIndexOf('</html>');
  return at >= 0 ? doc.slice(0, at) + css + '\n' + doc.slice(at) : doc + css;
}

fs.writeFileSync(outFile, insert(html, CSS));
