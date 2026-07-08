import * as vscode from 'vscode';
import { spawn, ChildProcess, execFile } from 'child_process';

// Every namht-* skill is exposed in the UI. The webview may request nothing
// else — the host rejects any command not on this list.
const ALLOWED = new Set([
  'namht-scan', 'namht-rescan', 'namht-ask', 'namht-map', 'namht-system-map', 'namht-document',
  'namht-discover', 'namht-plan', 'namht-plan-review', 'namht-user-story',
  'namht-build', 'namht-fix-bug', 'namht-migrate', 'namht-simplify', 'namht-perf', 'namht-observe', 'namht-rails-to-spring',
  'namht-review', 'namht-qa', 'namht-qa-integration', 'namht-security-audit', 'namht-design-review', 'namht-pr',
  'namht-splunk-report', 'namht-retro', 'namht-pdf', 'namht-skillify',
]);
const HIST_KEY = 'namhtSpecUi.history';
const HIST_MAX = 40;

export function activate(context: vscode.ExtensionContext) {
  const provider = new SpecKitViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('namhtSpec.view', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('namhtSpec.openApp', () => provider.openApp())
  );
}
export function deactivate() {}

class SpecKitViewProvider implements vscode.WebviewViewProvider {
  private webviews = new Set<vscode.Webview>();       // sidebar view + any app panels — kept in sync
  private procs = new Map<string, ChildProcess>();   // runId → process
  private sessions = new Map<string, string>();       // runId → claude session_id
  private state = new Map<string, any>();             // runId → live state (log/result/status) — survives webview recreation

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView) { this.wire(view.webview); }

  // Open the full app experience in the editor area (wide two-pane layout).
  openApp() {
    const panel = vscode.window.createWebviewPanel(
      'namhtSpecApp', 'Spec Kit', vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')] }
    );
    panel.iconPath = vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'icon-color.svg');
    this.wire(panel.webview);
    panel.onDidDispose(() => this.webviews.delete(panel.webview));
  }

  private wire(webview: vscode.Webview) {
    webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')] };
    webview.html = this.getHtml(webview);
    webview.onDidReceiveMessage((m: any) => this.handleMessage(m));
    this.webviews.add(webview);
  }

  private handleMessage(m: any) {
    switch (m?.type) {
      case 'check': this.checkClaude(); this.post({ type: 'config', defaultModel: this.cfg().model }); this.post({ type: 'history', items: this.history() }); this.post({ type: 'restore', runs: Array.from(this.state.values()) }); break;
      case 'run': this.start(m); break;
      case 'followup': this.followup(String(m.runId), String(m.text || ''), String(m.sessionId || ''), m.model); break;
      case 'cancel': this.cancel(String(m.runId)); break;
      case 'openReport': this.openReport(String(m.path || '')); break;
      case 'interactive': this.interactive(m); break;
      case 'open': this.openFile(String(m.path || '')); break;
      case 'clearHistory': this.ctx.workspaceState.update(HIST_KEY, []); this.post({ type: 'history', items: [] }); break;
    }
  }

  private post(m: unknown) { for (const w of this.webviews) w.postMessage(m); }
  private cfg() {
    const c = vscode.workspace.getConfiguration('namhtSpecUi');
    return { claudePath: c.get<string>('claudePath', 'claude'), extraArgs: c.get<string[]>('extraArgs', ['--permission-mode', 'acceptEdits']), usdToVnd: c.get<number>('usdToVnd', 26000), model: c.get<string>('model', 'sonnet') };
  }
  private cwd(): string | undefined { return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath; }

  private checkClaude() {
    const { claudePath } = this.cfg();
    execFile(claudePath, ['--version'], (err, stdout) => {
      this.post(err
        ? { type: 'status', ok: false, msg: `Claude Code CLI not found ("${claudePath}"). Install it and sign in, or set namhtSpecUi.claudePath.` }
        : { type: 'status', ok: true, msg: `Claude Code ready (${String(stdout).trim()})` });
    });
  }

  // ---- history (persisted per workspace so it survives reloads) ----
  private history(): any[] { return this.ctx.workspaceState.get<any[]>(HIST_KEY, []); }
  private histUpsert(item: any) {
    const h = this.history().filter(x => x.runId !== item.runId);
    h.unshift(item);
    this.ctx.workspaceState.update(HIST_KEY, h.slice(0, HIST_MAX));
    this.post({ type: 'history', items: this.history() });
  }
  private histPatch(runId: string, patch: any) {
    const h = this.history(); const it = h.find(x => x.runId === runId);
    if (it) { Object.assign(it, patch); this.ctx.workspaceState.update(HIST_KEY, h); this.post({ type: 'history', items: h }); }
  }

  // ---- runs ----
  private start(m: any) {
    const runId = String(m.runId); const command = String(m.command || '');
    const isChat = command === '__chat';   // free chat: raw prompt, no skill, whitelist bypassed
    if (!isChat && !ALLOWED.has(command)) { this.post({ type: 'log', runId, text: `[blocked: "${command}" is not allowed]` }); return; }
    const cwd = this.cwd() || (isChat ? require('os').homedir() : undefined);
    if (!cwd) { this.post({ type: 'log', runId, text: '[open a project folder first — skills read that project]' }); this.post({ type: 'done', runId, code: 1 }); return; }
    const prompt = isChat ? String(m.args || '').trim() : `/${command} ${String(m.args || '')}`.trim();
    if (isChat && !prompt) { this.post({ type: 'log', runId, text: '[type a question first]' }); this.post({ type: 'done', runId, code: 1 }); return; }
    const model = (m.model !== undefined && m.model !== null) ? String(m.model) : this.cfg().model;
    this.histUpsert({ runId, command, title: m.title || command, values: m.values || {}, when: Date.now(), status: 'running', model });
    this.state.set(runId, { runId, command, title: String(m.title || command), log: '', result: '', status: 'running', sessionId: null, report: null, when: Date.now(), model });
    this.spawnClaude(runId, ['-p', prompt], cwd, `${isChat ? '💬' : '▶'} ${prompt}\n(cwd: ${cwd})\n\n`);
  }

  private followup(runId: string, text: string, sessionId?: string, model?: string) {
    if (!text.trim()) return;
    const cwd = this.cwd(); if (!cwd) return;
    // A follow-up may pick a DIFFERENT model — the resumed session keeps its full context on disk,
    // so switching model mid-session still "knows" what it was doing.
    if (model !== undefined && model !== null) { const st = this.state.get(runId); if (st) st.model = String(model); }
    // Prefer the id passed from the webview (survives reload — Claude persists sessions on disk),
    // else the in-memory map, else continue the most recent session.
    const sid = (sessionId && sessionId.trim()) ? sessionId.trim() : this.sessions.get(runId);
    if (sid) this.sessions.set(runId, sid);
    const resume = sid ? ['--resume', sid] : ['--continue'];
    this.spawnClaude(runId, ['-p', text, ...resume], cwd, `\n\n────────\n💬 ${text}\n\n`);
  }

  private spawnClaude(runId: string, baseArgs: string[], cwd: string, header: string) {
    if (this.procs.has(runId)) { this.post({ type: 'log', runId, text: '[this run is still busy — wait for it or cancel]' }); return; }
    const { claudePath, extraArgs, model: cfgModel } = this.cfg();
    let st = this.state.get(runId);
    if (!st) { st = { runId, command: '', title: runId, log: '', result: '', status: 'running', sessionId: null, report: null, when: Date.now(), model: cfgModel }; this.state.set(runId, st); }
    const model = (st.model !== undefined && st.model !== null) ? st.model : cfgModel;
    const cliArgs = [...baseArgs, '--output-format', 'stream-json', '--verbose', ...(model ? ['--model', model] : []), ...extraArgs];
    st.status = 'running'; st.log += header;
    this.post({ type: 'running', runId, model });
    this.post({ type: 'log', runId, text: header });

    let seen = '', finalText = '', lineBuf = '';
    const emit = (t: string) => { seen += t + '\n'; st.log += t + '\n'; this.post({ type: 'log', runId, text: t }); };
    const feed = (line: string) => { const r = this.handleLine(runId, line, emit); if (r !== undefined) finalText = r; };

    let proc: ChildProcess;
    try { proc = spawn(claudePath, cliArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { st.status = 'error'; this.post({ type: 'log', runId, text: `[failed to start Claude: ${String(e)}]` }); this.post({ type: 'done', runId, code: 1 }); return; }
    this.procs.set(runId, proc);

    proc.stdout?.on('data', (d: Buffer) => {
      lineBuf += d.toString(); let nl: number;
      while ((nl = lineBuf.indexOf('\n')) >= 0) { const l = lineBuf.slice(0, nl); lineBuf = lineBuf.slice(nl + 1); feed(l); }
    });
    proc.stderr?.on('data', (d: Buffer) => this.post({ type: 'log', runId, text: d.toString() }));
    proc.on('error', (e) => this.post({ type: 'log', runId, text: `[error: ${e.message}]` }));
    proc.on('close', (code) => {
      if (lineBuf.trim()) feed(lineBuf);
      this.procs.delete(runId);
      st.status = code === 0 ? 'done' : (code === 130 ? 'cancelled' : 'error');
      st.sessionId = this.sessions.get(runId) || st.sessionId;
      if (finalText) { st.result = finalText; this.post({ type: 'result', runId, text: finalText }); }
      const report = this.findReport(seen + '\n' + finalText, cwd); st.report = report;
      this.post({ type: 'done', runId, code: code ?? 0, report });
      this.histPatch(runId, { status: st.status, result: finalText.slice(0, 24000), report, cost: st.cost || 0, tokens: st.usage, log: (st.log || '').slice(-40000) });
    });
  }

  private handleLine(runId: string, line: string, emit: (t: string) => void): string | undefined {
    const s = line.trim(); if (!s) return undefined;
    let ev: any; try { ev = JSON.parse(s); } catch { emit(s); return undefined; }
    if (ev.type === 'system' && ev.subtype === 'init') {
      if (ev.session_id) { this.sessions.set(runId, ev.session_id); const st = this.state.get(runId); if (st) st.sessionId = ev.session_id; this.histPatch(runId, { sessionId: ev.session_id }); this.post({ type: 'session', runId, sessionId: ev.session_id }); }
      emit(`▸ session started · model ${ev.model || '?'} · ${(ev.tools?.length || 0)} tools available`); return undefined;
    }
    if (ev.type === 'assistant' && ev.message?.content) {
      for (const c of ev.message.content) {
        if (c.type === 'text' && c.text?.trim()) { emit(c.text.trim()); this.trackSteps(runId, c.text); }
        else if (c.type === 'tool_use') { emit(`🔧 ${c.name}${this.shortInput(c.input)}`); this.trackFile(runId, c.name, c.input); }
      }
      return undefined;
    }
    if (ev.type === 'user' && ev.message?.content) {
      for (const c of ev.message.content) if (c.type === 'tool_result') emit(`   ↳ ${c.is_error ? 'error' : 'ok'}${this.resultLen(c.content)}`);
      return undefined;
    }
    if (ev.type === 'result') {
      const u = ev.usage || {};
      const usage = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheCreate: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0 };
      const cost = typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : 0;
      const st = this.state.get(runId);
      if (st) {
        st.usage = st.usage || { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
        st.usage.input += usage.input; st.usage.output += usage.output; st.usage.cacheCreate += usage.cacheCreate; st.usage.cacheRead += usage.cacheRead;
        st.cost = (st.cost || 0) + cost;
      }
      const totalCost = st ? st.cost : cost;
      const rate = this.cfg().usdToVnd || 0;
      const vnd = rate ? Math.round(totalCost * rate) : 0;
      if (st) st.vnd = vnd;
      this.post({ type: 'usage', runId, cost, usage, totalCost, totalUsage: st?.usage || usage, vnd });
      return typeof ev.result === 'string' ? ev.result : undefined;
    }
    return undefined;
  }

  private shortInput(input: any): string {
    if (!input || typeof input !== 'object') return '';
    const pick = input.file_path || input.command || input.pattern || input.description || input.path || input.query || input.url || input.prompt;
    if (!pick) return '';
    const t = String(pick).replace(/\s+/g, ' ').trim();
    return `  ${t.length > 90 ? t.slice(0, 90) + '…' : t}`;
  }
  private resultLen(content: any): string {
    try { const s = typeof content === 'string' ? content : JSON.stringify(content); return s.length ? ` (${s.length} chars)` : ''; } catch { return ''; }
  }

  // ---- live-run insight: which files are being edited + which step the pipeline reached ----
  private trackFile(runId: string, name: string, input: any) {
    if (!input || typeof input !== 'object') return;
    if (!['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(name)) return;
    const path = input.file_path || input.notebook_path; if (!path) return;
    const st = this.state.get(runId); if (!st) return;
    st.files = st.files || [];
    let e = st.files.find((f: any) => f.path === path);
    if (!e) { e = { path, tool: name, edits: [], count: 0 }; st.files.push(e); }
    const clip = (v: any) => { const s = String(v ?? ''); return s.length > 1200 ? s.slice(0, 1200) + '\n… (truncated)' : s; };
    const add = (o: any, n: any) => { e.edits.push({ old: clip(o), new: clip(n) }); e.count++; };
    if (name === 'Edit') add(input.old_string, input.new_string);
    else if (name === 'MultiEdit' && Array.isArray(input.edits)) input.edits.forEach((x: any) => add(x.old_string, x.new_string));
    else if (name === 'Write') { e.tool = 'Write'; add('', input.content); }
    else if (name === 'NotebookEdit') add('', input.new_source);
    if (e.edits.length > 40) e.edits = e.edits.slice(-40);
    this.post({ type: 'file', runId, entry: e });
  }

  private trackSteps(runId: string, text: string) {
    const st = this.state.get(runId); if (!st) return;
    st.steps = st.steps || [];
    const re = /(?:^|\n)\s*#{0,4}\s*Step\s+(\d+)\b[ \t]*(?:[—:\-–][ \t]*(.+))?/gi;
    let m: RegExpExecArray | null, changed = false;
    while ((m = re.exec(text))) {
      const n = parseInt(m[1], 10); if (isNaN(n)) continue;
      const label = (m[2] || '').split('\n')[0].replace(/[*#`]/g, '').trim().slice(0, 44);
      const ex = st.steps.find((s: any) => s.n === n);
      if (ex) { if (label && !ex.label) { ex.label = label; changed = true; } }
      else { st.steps.push({ n, label }); changed = true; }
    }
    if (changed) { st.steps.sort((a: any, b: any) => a.n - b.n); this.post({ type: 'steps', runId, steps: st.steps }); }
  }

  // ---- interactive handoff: run the same skill in a terminal so a dev reviews each diff / approves-rejects ----
  private interactive(m: any) {
    const command = String(m.command || ''); if (!ALLOWED.has(command)) return;
    const cwd = this.cwd(); if (!cwd) { vscode.window.showWarningMessage('Open a project folder first — skills read that project.'); return; }
    const { claudePath, model: cfgModel } = this.cfg();
    const model = (m.model !== undefined && m.model !== null) ? String(m.model) : cfgModel;
    const prompt = `/${command} ${String(m.args || '')}`.replace(/\s*\n\s*/g, ' ').trim();
    const q = (s: string) => `'` + s.replace(/'/g, `'\\''`) + `'`;
    const line = `${claudePath}${model ? ' --model ' + model : ''} ${q(prompt)}`;
    const term = vscode.window.createTerminal({ cwd, name: `Claude ⚡ ${String(m.title || command)}` });
    term.show(true);
    term.sendText(line, true);
  }

  private openFile(p: string) {
    if (!p) return;
    if (!p.startsWith('/')) { const cwd = this.cwd(); if (cwd) p = require('path').resolve(cwd, p); }
    vscode.window.showTextDocument(vscode.Uri.file(p), { preview: true })
      .then(undefined, (err) => vscode.window.showWarningMessage(`Cannot open ${p}: ${err}`));
  }

  private cancel(runId: string) {
    const p = this.procs.get(runId);
    if (p) { p.kill('SIGTERM'); this.procs.delete(runId); const st = this.state.get(runId); if (st) st.status = 'cancelled'; this.post({ type: 'log', runId, text: '\n[cancelled]' }); this.post({ type: 'done', runId, code: 130 }); this.histPatch(runId, { status: 'cancelled' }); }
  }

  private findReport(out: string, cwd: string): string | undefined {
    const m = out.match(/[\w./~-]*spec-kit-sessions[\w./-]+\.(?:html|md)/);
    if (!m) return undefined;
    let p = m[0]; if (!p.startsWith('/')) p = require('path').resolve(cwd, p);
    return p;
  }
  private openReport(p: string) {
    if (!p) return; const uri = vscode.Uri.file(p);
    if (p.endsWith('.html')) vscode.env.openExternal(uri); else vscode.commands.executeCommand('markdown.showPreview', uri);
  }

  private getHtml(webview: vscode.Webview): string {
    const uri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'media', f));
    const nonce = String(Date.now()) + Math.random().toString(36).slice(2);
    const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<link href="${uri('main.css')}" rel="stylesheet"></head><body>
<div id="app"></div><script nonce="${nonce}" src="${uri('main.js')}"></script></body></html>`;
  }
}
