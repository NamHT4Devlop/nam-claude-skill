// @ts-nocheck
const vscode = acquireVsCodeApi();

// The non-technical actions surfaced to PM/SM. Each builds an args string that
// the host runs as `claude -p "/<cmd> <args>"`. Only these commands are allowed.
const ACTIONS = [
  { cmd: 'namht-ask', icon: '❓', title: 'Ask the codebase', desc: 'Plain-language answer + diagram + detail.',
    fields: [{ name: 'q', label: 'Your question', type: 'textarea', ph: 'How does the payment flow work?' }],
    build: v => v.q },
  { cmd: 'namht-discover', icon: '💡', title: 'Sharpen an idea', desc: 'Turn a fuzzy idea into a crisp brief.',
    fields: [{ name: 'idea', label: 'The idea / problem', type: 'textarea', ph: 'I want to build…' }],
    build: v => v.idea },
  { cmd: 'namht-plan', icon: '🗂️', title: 'Plan an epic', desc: 'Epic → features → user stories → sprint plan.',
    fields: [{ name: 'title', label: 'Epic title', type: 'text', ph: 'Recurring invoices' },
             { name: 'desc', label: 'Description (what & why)', type: 'textarea', ph: 'Describe the epic…' }],
    build: v => `${v.title}\n\n${v.desc}` },
  { cmd: 'namht-plan-review', icon: '🔍', title: 'Review a plan', desc: 'Multi-lens critique + verdict.',
    fields: [{ name: 'plan', label: 'The plan / user stories', type: 'textarea', ph: 'Paste the plan…' }],
    build: v => v.plan },
  { cmd: 'namht-qa', icon: '✅', title: 'QA test cases', desc: 'User story → new + regression test cases.',
    fields: [{ name: 'story', label: 'User story + acceptance criteria', type: 'textarea', ph: 'As a…, I want…, so that…' }],
    build: v => v.story },
  { cmd: 'namht-document', icon: '📄', title: 'Document a feature', desc: 'Business↔code doc anyone can follow.',
    fields: [{ name: 'topic', label: 'Feature / module / entity', type: 'text', ph: 'Orders module' }],
    build: v => v.topic },
  { cmd: 'namht-retro', icon: '🔄', title: 'Retrospective', desc: 'What shipped + action items from git history.',
    fields: [{ name: 'window', label: 'Time window', type: 'text', ph: '7d' }],
    build: v => v.window || '' },
  { cmd: 'namht-system-map', icon: '🗺️', title: 'System map', desc: 'Cross-service map (open the workspace root).',
    fields: [], build: () => '' },
  { cmd: 'namht-splunk-report', icon: '🚨', title: 'Splunk error digest', desc: 'Per-app errors → table → Slack.',
    fields: [{ name: 'args', label: 'index / env / app / window / Slack URL (blank = it will ask)', type: 'textarea', ph: 'index=app_logs cai_enviroment=prod cai_app=payments 24h' }],
    build: v => v.args || '' },
];

const app = document.getElementById('app');
let statusMsg = 'Checking Claude Code…';
let statusOk = null;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function renderHome() {
  app.innerHTML = '';
  const status = el('div', 'status ' + (statusOk === false ? 'bad' : statusOk ? 'ok' : ''), statusMsg);
  app.appendChild(status);
  app.appendChild(el('p', 'lead', 'Pick what you want to do:'));
  const grid = el('div', 'grid');
  ACTIONS.forEach(a => {
    const card = el('button', 'card');
    card.appendChild(el('div', 'card-ic', a.icon));
    card.appendChild(el('div', 'card-t', a.title));
    card.appendChild(el('div', 'card-d', a.desc));
    card.onclick = () => renderForm(a);
    grid.appendChild(card);
  });
  app.appendChild(grid);
}

function renderForm(a) {
  app.innerHTML = '';
  const back = el('button', 'link', '← Back');
  back.onclick = renderHome;
  app.appendChild(back);
  app.appendChild(el('h2', null, a.icon + '  ' + a.title));
  app.appendChild(el('p', 'muted', a.desc));
  const inputs = {};
  a.fields.forEach(f => {
    app.appendChild(el('label', 'flabel', f.label));
    const inp = f.type === 'textarea' ? el('textarea') : el('input');
    if (f.type !== 'textarea') inp.type = 'text';
    inp.placeholder = f.ph || '';
    inp.className = 'field';
    inputs[f.name] = inp;
    app.appendChild(inp);
  });
  const run = el('button', 'primary', 'Run');
  run.onclick = () => {
    const vals = {}; Object.keys(inputs).forEach(k => vals[k] = inputs[k].value.trim());
    const args = (a.build(vals) || '').trim();
    renderRun(a);
    vscode.postMessage({ type: 'run', command: a.cmd, args });
  };
  app.appendChild(run);
}

let outEl, doneBar;
function renderRun(a) {
  app.innerHTML = '';
  app.appendChild(el('h2', null, a.icon + '  ' + a.title));
  const bar = el('div', 'runbar');
  const cancel = el('button', 'ghost', 'Cancel');
  cancel.onclick = () => vscode.postMessage({ type: 'cancel' });
  bar.appendChild(cancel);
  doneBar = el('span', 'runstate', 'running…');
  bar.appendChild(doneBar);
  app.appendChild(bar);
  outEl = el('pre', 'output');
  app.appendChild(outEl);
  const home = el('button', 'link', '← Back to actions');
  home.onclick = renderHome;
  app.appendChild(home);
}

window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (m.type === 'status') { statusOk = m.ok; statusMsg = m.msg; if (!outEl) renderHome(); }
  else if (m.type === 'output' && outEl) { outEl.textContent += m.chunk; outEl.scrollTop = outEl.scrollHeight; }
  else if (m.type === 'done' && doneBar) {
    doneBar.textContent = m.code === 0 ? 'done ✓' : 'exited (' + m.code + ')';
    if (m.report) {
      const open = el('button', 'primary', 'Open report');
      open.onclick = () => vscode.postMessage({ type: 'openReport', path: m.report });
      doneBar.parentElement.appendChild(open);
    }
  }
});

vscode.postMessage({ type: 'check' });
renderHome();
