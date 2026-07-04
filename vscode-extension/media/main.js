// @ts-nocheck
const vscode = acquireVsCodeApi();

const CATS = [
  { key: 'understand', name: 'Understand', icon: '📖' },
  { key: 'plan', name: 'Plan', icon: '🗂️' },
  { key: 'build', name: 'Build & Fix', icon: '🛠️' },
  { key: 'review', name: 'Review & QA', icon: '🔍' },
  { key: 'ops', name: 'Ops & Docs', icon: '📊' },
];
const A = (cmd, cat, icon, title, desc, fields, build, edits) => ({ cmd, cat, icon, title, desc, fields, build, edits });
const one = (name, label, ph, type = 'textarea', optional = false) => ({ name, label, ph, type, optional });

const ACTIONS = [
  A('namht-scan', 'understand', '🧠', 'Scan → Knowledge Base', 'Generate the project Knowledge Base (run once).', [], () => ''),
  A('namht-rescan', 'understand', '♻️', 'Rescan (update KB)', 'Refresh the KB after code changes.', [], () => ''),
  A('namht-ask', 'understand', '❓', 'Ask the codebase', 'Plain-language answer + diagram + detail.', [one('q', 'Your question', 'How does the payment flow work?')], v => v.q),
  A('namht-map', 'understand', '🕸️', 'Dependency map', 'Interactive HTML code graph (opens in browser).', [one('scope', 'Scope (optional)', 'e.g. src/', 'text', true)], v => v.scope || ''),
  A('namht-system-map', 'understand', '🗺️', 'System map', 'Cross-service map — open the workspace root.', [], () => ''),
  A('namht-document', 'understand', '📄', 'Document a feature', 'Business↔code doc anyone can follow.', [one('topic', 'Feature / module / entity', 'Orders module', 'text')], v => v.topic),
  A('namht-discover', 'plan', '💡', 'Sharpen an idea', 'Turn a fuzzy idea into a crisp brief.', [one('idea', 'The idea / problem', 'I want to build…')], v => v.idea),
  A('namht-plan', 'plan', '📋', 'Plan an epic', 'Epic → features → user stories → sprint plan.', [one('title', 'Epic title', 'Recurring invoices', 'text'), one('desc', 'Description (what & why)', 'Describe the epic…')], v => `${v.title}\n\n${v.desc}`),
  A('namht-plan-review', 'plan', '🔎', 'Review a plan', 'Multi-lens critique + verdict.', [one('plan', 'The plan / user stories', 'Paste the plan…')], v => v.plan),
  A('namht-build', 'build', '🏗️', 'Build a feature', '13-step pipeline: plan → code → review → test.', [one('req', 'Requirement', 'Add a forgot-password flow via email OTP')], v => v.req, true),
  A('namht-fix-bug', 'build', '🐛', 'Fix a bug', 'Root-cause → regression test → minimal fix.', [one('err', 'Error / stack trace / symptom', 'Paste the error or describe it…')], v => v.err, true),
  A('namht-migrate', 'build', '🔀', 'Migration / deprecation', 'Safe API/DB/event/lib change with rollback.', [one('change', "What's changing", 'Add nullable dueDate column to tasks')], v => v.change, true),
  A('namht-simplify', 'build', '✨', 'Simplify code', 'Behavior-preserving cleanup; tests stay green.', [one('target', 'File / function (optional)', 'src/foo.ts', 'text', true)], v => v.target || '', true),
  A('namht-perf', 'build', '⚡', 'Optimize performance', 'Measure-first; prove before/after.', [one('area', 'Slow area / endpoint / query', 'GET /orders is slow')], v => v.area, true),
  A('namht-observe', 'build', '📡', 'Add observability', 'Structured logs + trace IDs + metrics.', [one('area', 'Service / flow to instrument', 'payments service')], v => v.area, true),
  A('namht-review', 'review', '🔍', 'Review code / PR', 'Two-phase review vs the KB.', [one('target', 'File / PR# (blank = current branch)', 'e.g. #123 or src/foo.ts', 'text', true)], v => v.target || ''),
  A('namht-qa', 'review', '✅', 'QA test cases', 'User story → new + regression cases.', [one('story', 'User story + acceptance criteria', 'As a…, I want…, so that…')], v => v.story),
  A('namht-qa-integration', 'review', '🌐', 'Run E2E QA', 'Drive a running app in a browser (needs a URL).', [one('url', 'App URL', 'http://localhost:3000', 'text')], v => v.url),
  A('namht-security-audit', 'review', '🛡️', 'Security audit', 'Whole-repo OWASP + STRIDE sweep.', [one('scope', 'Scope (optional)', 'e.g. auth module', 'text', true)], v => v.scope || ''),
  A('namht-design-review', 'review', '🎨', 'Design / a11y review', 'UI/UX + accessibility (URL or components).', [one('target', 'URL or path', 'http://localhost:3000', 'text')], v => v.target),
  A('namht-pr', 'review', '🔀', 'Prepare / review PR', 'Draft a PR desc, or review a PR#.', [one('pr', 'PR# to review (blank = prepare from branch)', 'e.g. 123', 'text', true)], v => (v.pr ? `review ${v.pr}` : '')),
  A('namht-splunk-report', 'ops', '🚨', 'Splunk error digest', 'Per-app errors → table → Slack.', [one('args', 'index / env / app / window / Slack URL (blank = it asks)', 'index=app_logs cai_enviroment=prod cai_app=payments 24h')], v => v.args || ''),
  A('namht-retro', 'ops', '🔄', 'Retrospective', 'What shipped + action items from git history.', [one('window', 'Time window', '7d', 'text')], v => v.window || ''),
  A('namht-pdf', 'ops', '📑', 'Export to PDF', 'Turn a report/doc into a PDF.', [one('file', 'File to export (.md/.html)', 'spec-kit-sessions/…/report.md', 'text')], v => v.file),
  A('namht-skillify', 'ops', '🧩', 'Create a new skill', 'Scaffold a new namht-* skill (for devs).', [one('spec', 'Name + purpose', 'changelog — generate a release changelog from git')], v => v.spec),
];
const byCmd = c => ACTIONS.find(a => a.cmd === c);

// ---------- safe mini-markdown ----------
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inl(s) { return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>'); }
function mdToHtml(md) {
  const L = esc(md || '').split('\n'); let out = ''; let i = 0; let lb = [];
  const flush = () => { if (lb.length) { out += '<ul>' + lb.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>'; lb = []; } };
  while (i < L.length) {
    const ln = L[i];
    if (/^```/.test(ln)) { flush(); i++; let b = ''; while (i < L.length && !/^```/.test(L[i])) { b += L[i] + '\n'; i++; } i++; out += '<pre class="cb"><code>' + b + '</code></pre>'; continue; }
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < L.length && /^\s*\|[-:\s|]+\|\s*$/.test(L[i + 1])) {
      flush(); const hd = ln.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()); i += 2; const rows = [];
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { rows.push(L[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i++; }
      out += '<table><thead><tr>' + hd.map(c => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'; continue;
    }
    const h = ln.match(/^(#{1,4})\s+(.*)/); if (h) { flush(); out += `<h${h[1].length}>` + inl(h[2]) + `</h${h[1].length}>`; i++; continue; }
    const li = ln.match(/^\s*[-*]\s+(.*)/); if (li) { lb.push(li[1]); i++; continue; }
    if (/^\s*$/.test(ln)) { flush(); i++; continue; }
    flush(); out += '<p>' + inl(ln) + '</p>'; i++;
  }
  flush(); return out;
}

// ---------- state ----------
const app = document.getElementById('app');
const rid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let statusMsg = 'Checking Claude Code…', statusOk = null, filter = '';
let history = [];                 // from host (persisted)
const runs = {};                  // runId → { cmd, title, values, status, log, result, sessionId, report }
let cur = { view: 'home', runId: null };
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const ago = ms => { const s = Math.max(1, Math.round((Date.now() - ms) / 1000)); if (s < 60) return s + 's'; if (s < 3600) return Math.round(s / 60) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; };
const dot = st => st === 'running' ? '🟡' : st === 'done' ? '🟢' : st === 'cancelled' ? '⚪' : '🔴';

function nav() {
  const bar = el('div', 'nav');
  const home = el('button', 'navbtn' + (cur.view === 'home' ? ' active' : ''), '⌂ Home'); home.onclick = renderHome; bar.appendChild(home);
  const running = Object.values(runs).filter(r => r.status === 'running').length;
  if (running) { const b = el('span', 'badge', running + ' running'); bar.appendChild(b); }
  return bar;
}

// ---------- home ----------
function renderHome() {
  cur = { view: 'home', runId: null };
  app.innerHTML = '';
  app.appendChild(nav());
  const head = el('div', 'head');
  head.appendChild(el('div', 'brand', '⬡ Spec Kit'));
  head.appendChild(el('div', 'status ' + (statusOk === false ? 'bad' : statusOk ? 'ok' : ''), statusMsg));
  app.appendChild(head);
  // recent & running
  if (history.length) {
    const rc = el('div', 'recent');
    const rh = el('div', 'recent-h'); rh.appendChild(el('span', null, 'Recent & running'));
    const clr = el('button', 'link', 'clear'); clr.onclick = () => vscode.postMessage({ type: 'clearHistory' }); rh.appendChild(clr);
    rc.appendChild(rh);
    history.slice(0, 8).forEach(it => {
      const a = byCmd(it.command); const row = el('button', 'hrow');
      row.appendChild(el('span', 'hic', (a ? a.icon : '•')));
      const mid = el('span', 'hmid'); mid.appendChild(el('span', 'ht', it.title || it.command)); mid.appendChild(el('span', 'hmeta', dot(it.status) + ' ' + it.status + ' · ' + ago(it.when))); row.appendChild(mid);
      row.onclick = () => reopen(it); rc.appendChild(row);
    });
    app.appendChild(rc);
  }
  const search = el('input', 'search'); search.type = 'text'; search.placeholder = 'Search actions…'; search.value = filter;
  search.oninput = () => { filter = search.value.toLowerCase(); renderGrids(gw); search.focus(); };
  app.appendChild(search);
  const gw = el('div'); app.appendChild(gw); renderGrids(gw);
}
function renderGrids(wrap) {
  wrap.innerHTML = '';
  CATS.forEach(cat => {
    const items = ACTIONS.filter(a => a.cat === cat.key && (!filter || (a.title + ' ' + a.desc + ' ' + a.cmd).toLowerCase().includes(filter)));
    if (!items.length) return;
    wrap.appendChild(el('div', 'cat', cat.icon + '  ' + cat.name));
    const grid = el('div', 'grid');
    items.forEach(a => {
      const card = el('button', 'card'); const top = el('div', 'card-top');
      top.appendChild(el('span', 'card-ic', a.icon)); if (a.edits) top.appendChild(el('span', 'tag', 'edits code')); card.appendChild(top);
      card.appendChild(el('div', 'card-t', a.title)); card.appendChild(el('div', 'card-d', a.desc));
      card.onclick = () => renderForm(a); grid.appendChild(card);
    });
    wrap.appendChild(grid);
  });
}
function reopen(it) {
  // Rebuild the run from persisted history if it's not live in this session. The
  // sessionId survives reloads (Claude persists sessions on disk) → follow-up resumes it.
  if (!runs[it.runId]) {
    runs[it.runId] = { cmd: it.command, title: it.title || it.command, values: it.values || {},
      status: it.status || 'done', log: '', result: it.result || '', sessionId: it.sessionId || null, report: it.report || null };
  }
  openRun(it.runId);
}

// ---------- form ----------
function renderForm(a, values) {
  cur = { view: 'form', runId: null };
  app.innerHTML = ''; app.appendChild(nav());
  app.appendChild(el('h2', null, a.icon + '  ' + a.title));
  app.appendChild(el('p', 'muted', a.desc));
  if (a.edits) app.appendChild(el('div', 'warn', '⚠ This changes code (auto-approve). Review the diff in Source Control afterwards; git-guard still blocks dangerous git.'));
  const inputs = {};
  a.fields.forEach(f => {
    app.appendChild(el('label', 'flabel', f.label));
    const inp = f.type === 'textarea' ? el('textarea', 'field') : el('input', 'field'); if (f.type !== 'textarea') inp.type = 'text';
    inp.placeholder = f.ph || ''; if (values && values[f.name] != null) inp.value = values[f.name]; inputs[f.name] = inp; app.appendChild(inp);
  });
  const run = el('button', 'primary', '▶  Run');
  run.onclick = () => {
    const vals = {}; Object.keys(inputs).forEach(k => vals[k] = inputs[k].value.trim());
    if (a.fields.some(f => !f.optional && !vals[f.name])) { run.textContent = 'Fill the required field'; setTimeout(() => run.textContent = '▶  Run', 1200); return; }
    const id = rid();
    runs[id] = { cmd: a.cmd, title: a.title, values: vals, status: 'running', log: '', result: '', sessionId: null, report: null };
    vscode.postMessage({ type: 'run', runId: id, command: a.cmd, args: (a.build(vals) || '').trim(), title: a.title, values: vals });
    openRun(id);
  };
  app.appendChild(run);
  if (a.fields[0]) setTimeout(() => inputs[a.fields[0].name].focus(), 30);
}

// ---------- run view (per runId; survives navigation) ----------
let logEl, resEl, doneEl, toggleBtn, followRow;
function showView(which) { const act = which === 'activity'; logEl.style.display = act ? 'block' : 'none'; resEl.style.display = act ? 'none' : 'block'; toggleBtn.textContent = act ? 'Result' : 'Activity'; }
function openRun(id) {
  cur = { view: 'run', runId: id }; const r = runs[id]; if (!r) return renderHome();
  app.innerHTML = ''; app.appendChild(nav());
  const a = byCmd(r.cmd);
  app.appendChild(el('h2', null, (a ? a.icon + '  ' : '') + r.title));
  const bar = el('div', 'runbar');
  const cancel = el('button', 'ghost', 'Cancel'); cancel.onclick = () => vscode.postMessage({ type: 'cancel', runId: id }); bar.appendChild(cancel);
  toggleBtn = el('button', 'ghost', 'Result'); toggleBtn.onclick = () => showView(logEl.style.display === 'none' ? 'activity' : 'result'); bar.appendChild(toggleBtn);
  if (a) { const fb = el('button', 'ghost', '↻ Form'); fb.onclick = () => renderForm(a, r.values); bar.appendChild(fb); }
  doneEl = el('span', 'runstate ' + (r.status === 'running' ? '' : (r.status === 'done' ? 'ok' : 'bad')), '● ' + r.status); bar.appendChild(doneEl);
  if (r.report) addReportBtn(r.report);
  app.appendChild(bar);
  resEl = el('div', 'result'); resEl.innerHTML = mdToHtml(r.result); app.appendChild(resEl);
  logEl = el('pre', 'output'); logEl.textContent = r.log; app.appendChild(logEl);
  showView(r.result ? 'result' : 'activity');
  // follow-up (continue the same session as a chat)
  followRow = el('div', 'follow');
  const fi = el('textarea', 'field'); fi.placeholder = 'Ask a follow-up in this session…'; fi.rows = 2; followRow.appendChild(fi);
  const send = el('button', 'primary', 'Send'); send.disabled = r.status === 'running';
  send.onclick = () => { const t = fi.value.trim(); if (!t) return; fi.value = ''; runs[id].status = 'running'; if (doneEl) { doneEl.className = 'runstate'; doneEl.textContent = '● running…'; } vscode.postMessage({ type: 'followup', runId: id, text: t, sessionId: runs[id].sessionId }); showView('activity'); };
  followRow.appendChild(send);
  app.appendChild(followRow);
}
function addReportBtn(path) { if (!doneEl) return; const b = el('button', 'primary small', '📄 Report'); b.onclick = () => vscode.postMessage({ type: 'openReport', path }); doneEl.parentElement.appendChild(b); }

// ---------- messages ----------
window.addEventListener('message', ev => {
  const m = ev.data; const id = m.runId;
  if (m.type === 'status') { statusOk = m.ok; statusMsg = m.msg; if (cur.view === 'home') renderHome(); return; }
  if (m.type === 'history') { history = m.items || []; if (cur.view === 'home') renderHome(); return; }
  if (!id || !runs[id]) { if (id && m.type !== 'status') runs[id] = { cmd: '', title: id, values: {}, status: 'running', log: '', result: '', sessionId: null, report: null }; }
  const r = runs[id]; if (!r) return;
  if (m.type === 'running') { r.status = 'running'; }
  else if (m.type === 'log') { r.log += m.text + '\n'; if (cur.runId === id && logEl) { logEl.textContent = r.log; logEl.scrollTop = logEl.scrollHeight; } }
  else if (m.type === 'session') { r.sessionId = m.sessionId; }
  else if (m.type === 'result') { r.result = m.text; if (cur.runId === id && resEl) resEl.innerHTML = mdToHtml(r.result); }
  else if (m.type === 'done') {
    r.status = m.code === 0 ? 'done' : (m.code === 130 ? 'cancelled' : 'error'); if (m.report) r.report = m.report;
    if (cur.runId === id) {
      if (doneEl) { doneEl.className = 'runstate ' + (m.code === 0 ? 'ok' : 'bad'); doneEl.textContent = '● ' + r.status; }
      if (r.result && resEl) { resEl.innerHTML = mdToHtml(r.result); showView('result'); }
      if (r.report) addReportBtn(r.report);
      if (followRow) { const s = followRow.querySelector('button'); if (s) s.disabled = false; }
    }
  }
});

vscode.postMessage({ type: 'check' });
renderHome();
