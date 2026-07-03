// @ts-nocheck
const vscode = acquireVsCodeApi();

const CATS = [
  { key: 'understand', name: 'Understand', icon: '📖' },
  { key: 'plan', name: 'Plan', icon: '🗂️' },
  { key: 'build', name: 'Build & Fix', icon: '🛠️' },
  { key: 'review', name: 'Review & QA', icon: '🔍' },
  { key: 'ops', name: 'Ops & Docs', icon: '📊' },
];

// tf = { name, label, type:'text'|'textarea', ph, optional }
const A = (cmd, cat, icon, title, desc, fields, build, edits) => ({ cmd, cat, icon, title, desc, fields, build, edits });
const one = (name, label, ph, type = 'textarea', optional = false) => ({ name, label, ph, type, optional });

const ACTIONS = [
  // Understand
  A('namht-scan', 'understand', '🧠', 'Scan → Knowledge Base', 'Generate the project Knowledge Base (run once).', [], () => ''),
  A('namht-rescan', 'understand', '♻️', 'Rescan (update KB)', 'Refresh the KB after code changes.', [], () => ''),
  A('namht-ask', 'understand', '❓', 'Ask the codebase', 'Plain-language answer + diagram + detail.', [one('q', 'Your question', 'How does the payment flow work?')], v => v.q),
  A('namht-map', 'understand', '🕸️', 'Dependency map', 'Interactive HTML code graph (opens in browser).', [one('scope', 'Scope (optional)', 'e.g. src/', 'text', true)], v => v.scope || ''),
  A('namht-system-map', 'understand', '🗺️', 'System map', 'Cross-service map — open the workspace root.', [], () => ''),
  A('namht-document', 'understand', '📄', 'Document a feature', 'Business↔code doc anyone can follow.', [one('topic', 'Feature / module / entity', 'Orders module', 'text')], v => v.topic),
  // Plan
  A('namht-discover', 'plan', '💡', 'Sharpen an idea', 'Turn a fuzzy idea into a crisp brief.', [one('idea', 'The idea / problem', 'I want to build…')], v => v.idea),
  A('namht-plan', 'plan', '📋', 'Plan an epic', 'Epic → features → user stories → sprint plan.', [one('title', 'Epic title', 'Recurring invoices', 'text'), one('desc', 'Description (what & why)', 'Describe the epic…')], v => `${v.title}\n\n${v.desc}`),
  A('namht-plan-review', 'plan', '🔎', 'Review a plan', 'Multi-lens critique + verdict.', [one('plan', 'The plan / user stories', 'Paste the plan…')], v => v.plan),
  // Build & Fix (edit code)
  A('namht-build', 'build', '🏗️', 'Build a feature', '13-step pipeline: plan → code → review → test.', [one('req', 'Requirement', 'Add a forgot-password flow via email OTP')], v => v.req, true),
  A('namht-fix-bug', 'build', '🐛', 'Fix a bug', 'Root-cause → regression test → minimal fix.', [one('err', 'Error / stack trace / symptom', 'Paste the error or describe it…')], v => v.err, true),
  A('namht-migrate', 'build', '🔀', 'Migration / deprecation', 'Safe API/DB/event/lib change with rollback.', [one('change', "What's changing", 'Add nullable dueDate column to tasks')], v => v.change, true),
  A('namht-simplify', 'build', '✨', 'Simplify code', 'Behavior-preserving cleanup; tests stay green.', [one('target', 'File / function (optional)', 'src/foo.ts', 'text', true)], v => v.target || '', true),
  A('namht-perf', 'build', '⚡', 'Optimize performance', 'Measure-first; prove before/after.', [one('area', 'Slow area / endpoint / query', 'GET /orders is slow')], v => v.area, true),
  A('namht-observe', 'build', '📡', 'Add observability', 'Structured logs + trace IDs + metrics.', [one('area', 'Service / flow to instrument', 'payments service')], v => v.area, true),
  // Review & QA
  A('namht-review', 'review', '🔍', 'Review code / PR', 'Two-phase review vs the KB.', [one('target', 'File / PR# (blank = current branch)', 'e.g. #123 or src/foo.ts', 'text', true)], v => v.target || ''),
  A('namht-qa', 'review', '✅', 'QA test cases', 'User story → new + regression cases.', [one('story', 'User story + acceptance criteria', 'As a…, I want…, so that…')], v => v.story),
  A('namht-qa-integration', 'review', '🌐', 'Run E2E QA', 'Drive a running app in a browser (needs a URL).', [one('url', 'App URL', 'http://localhost:3000', 'text')], v => v.url),
  A('namht-security-audit', 'review', '🛡️', 'Security audit', 'Whole-repo OWASP + STRIDE sweep.', [one('scope', 'Scope (optional)', 'e.g. auth module', 'text', true)], v => v.scope || ''),
  A('namht-design-review', 'review', '🎨', 'Design / a11y review', 'UI/UX + accessibility (URL or components).', [one('target', 'URL or path', 'http://localhost:3000', 'text')], v => v.target),
  A('namht-pr', 'review', '🔀', 'Prepare / review PR', 'Draft a PR desc, or review a PR#.', [one('pr', 'PR# to review (blank = prepare from branch)', 'e.g. 123', 'text', true)], v => (v.pr ? `review ${v.pr}` : '')),
  // Ops & Docs
  A('namht-splunk-report', 'ops', '🚨', 'Splunk error digest', 'Per-app errors → table → Slack.', [one('args', 'index / env / app / window / Slack URL (blank = it asks)', 'index=app_logs cai_enviroment=prod cai_app=payments 24h')], v => v.args || ''),
  A('namht-retro', 'ops', '🔄', 'Retrospective', 'What shipped + action items from git history.', [one('window', 'Time window', '7d', 'text')], v => v.window || ''),
  A('namht-pdf', 'ops', '📑', 'Export to PDF', 'Turn a report/doc into a PDF.', [one('file', 'File to export (.md/.html)', 'spec-kit-sessions/…/report.md', 'text')], v => v.file),
  A('namht-skillify', 'ops', '🧩', 'Create a new skill', 'Scaffold a new namht-* skill (for devs).', [one('spec', 'Name + purpose', 'changelog — generate a release changelog from git')], v => v.spec),
];

// ---------- safe mini-markdown (escape first, then structure) ----------
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inl(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(md) {
  const L = esc(md).split('\n'); let out = ''; let i = 0; let lb = [];
  const flush = () => { if (lb.length) { out += '<ul>' + lb.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>'; lb = []; } };
  while (i < L.length) {
    const ln = L[i];
    if (/^```/.test(ln)) { flush(); i++; let b = ''; while (i < L.length && !/^```/.test(L[i])) { b += L[i] + '\n'; i++; } i++; out += '<pre class="cb"><code>' + b + '</code></pre>'; continue; }
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < L.length && /^\s*\|[-:\s|]+\|\s*$/.test(L[i + 1])) {
      flush();
      const hd = ln.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      i += 2; const rows = [];
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { rows.push(L[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i++; }
      out += '<table><thead><tr>' + hd.map(c => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      continue;
    }
    const h = ln.match(/^(#{1,4})\s+(.*)/); if (h) { flush(); out += `<h${h[1].length}>` + inl(h[2]) + `</h${h[1].length}>`; i++; continue; }
    const li = ln.match(/^\s*[-*]\s+(.*)/); if (li) { lb.push(li[1]); i++; continue; }
    if (/^\s*$/.test(ln)) { flush(); i++; continue; }
    flush(); out += '<p>' + inl(ln) + '</p>'; i++;
  }
  flush(); return out;
}

// ---------- views ----------
const app = document.getElementById('app');
let statusMsg = 'Checking Claude Code…', statusOk = null, filter = '';

function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

function renderHome() {
  app.innerHTML = '';
  const head = el('div', 'head');
  head.appendChild(el('div', 'brand', '⬡ Spec Kit'));
  const st = el('div', 'status ' + (statusOk === false ? 'bad' : statusOk ? 'ok' : ''), statusMsg);
  head.appendChild(st);
  app.appendChild(head);

  const search = el('input', 'search'); search.type = 'text'; search.placeholder = 'Search actions…'; search.value = filter;
  search.oninput = () => { filter = search.value.toLowerCase(); renderGrids(gridWrap); search.focus(); };
  app.appendChild(search);

  const gridWrap = el('div'); app.appendChild(gridWrap);
  renderGrids(gridWrap);
}
function renderGrids(wrap) {
  wrap.innerHTML = '';
  CATS.forEach(cat => {
    const items = ACTIONS.filter(a => a.cat === cat.key &&
      (!filter || (a.title + ' ' + a.desc + ' ' + a.cmd).toLowerCase().includes(filter)));
    if (!items.length) return;
    wrap.appendChild(el('div', 'cat', cat.icon + '  ' + cat.name));
    const grid = el('div', 'grid');
    items.forEach(a => {
      const card = el('button', 'card');
      const top = el('div', 'card-top');
      top.appendChild(el('span', 'card-ic', a.icon));
      if (a.edits) top.appendChild(el('span', 'tag', 'edits code'));
      card.appendChild(top);
      card.appendChild(el('div', 'card-t', a.title));
      card.appendChild(el('div', 'card-d', a.desc));
      card.onclick = () => renderForm(a);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  });
}

function renderForm(a) {
  app.innerHTML = '';
  const back = el('button', 'link', '← Back'); back.onclick = renderHome; app.appendChild(back);
  app.appendChild(el('h2', null, a.icon + '  ' + a.title));
  app.appendChild(el('p', 'muted', a.desc));
  if (a.edits) app.appendChild(el('div', 'warn', '⚠ This changes code. It runs with auto-approve; review the diff in Source Control afterwards. The git-guard still blocks dangerous git.'));
  const inputs = {};
  a.fields.forEach(f => {
    app.appendChild(el('label', 'flabel', f.label));
    const inp = f.type === 'textarea' ? el('textarea', 'field') : el('input', 'field');
    if (f.type !== 'textarea') inp.type = 'text';
    inp.placeholder = f.ph || ''; inputs[f.name] = inp; app.appendChild(inp);
  });
  const run = el('button', 'primary', '▶  Run');
  run.onclick = () => {
    const vals = {}; Object.keys(inputs).forEach(k => vals[k] = inputs[k].value.trim());
    const missing = a.fields.some(f => !f.optional && !vals[f.name]);
    if (missing) { run.textContent = 'Fill the required field'; setTimeout(() => run.textContent = '▶  Run', 1200); return; }
    renderRun(a); vscode.postMessage({ type: 'run', command: a.cmd, args: (a.build(vals) || '').trim() });
  };
  app.appendChild(run);
  if (a.fields[0]) a.fields[0] && setTimeout(() => inputs[a.fields[0].name].focus(), 30);
}

let raw = '', logEl, resEl, doneEl, curReport;
function renderRun(a) {
  app.innerHTML = ''; raw = ''; curReport = null;
  app.appendChild(el('h2', null, a.icon + '  ' + a.title));
  const bar = el('div', 'runbar');
  const cancel = el('button', 'ghost', 'Cancel'); cancel.onclick = () => vscode.postMessage({ type: 'cancel' }); bar.appendChild(cancel);
  const toggle = el('button', 'ghost', 'Raw'); toggle.onclick = () => { const r = resEl.style.display !== 'none'; resEl.style.display = r ? 'none' : 'block'; logEl.style.display = r ? 'block' : 'none'; toggle.textContent = r ? 'Rendered' : 'Raw'; }; bar.appendChild(toggle);
  doneEl = el('span', 'runstate', '● running…'); bar.appendChild(doneEl);
  app.appendChild(bar);
  resEl = el('div', 'result'); app.appendChild(resEl);
  logEl = el('pre', 'output'); logEl.style.display = 'none'; app.appendChild(logEl);
  const home = el('button', 'link', '← Back to actions'); home.onclick = renderHome; app.appendChild(home);
}

window.addEventListener('message', ev => {
  const m = ev.data;
  if (m.type === 'status') { statusOk = m.ok; statusMsg = m.msg; if (!logEl || !document.querySelector('.result')) renderHome(); }
  else if (m.type === 'output' && logEl) { raw += m.chunk; logEl.textContent = raw; resEl.innerHTML = mdToHtml(raw); resEl.scrollTop = resEl.scrollHeight; }
  else if (m.type === 'done' && doneEl) {
    doneEl.className = 'runstate ' + (m.code === 0 ? 'ok' : 'bad');
    doneEl.textContent = m.code === 0 ? '● done' : '● exited (' + m.code + ')';
    resEl.innerHTML = mdToHtml(raw);
    if (m.report) { const b = el('button', 'primary', '📄  Open full report'); b.onclick = () => vscode.postMessage({ type: 'openReport', path: m.report }); doneEl.parentElement.appendChild(b); }
  }
});

vscode.postMessage({ type: 'check' });
renderHome();
