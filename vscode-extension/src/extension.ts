import * as vscode from 'vscode';
import { spawn, ChildProcess, execFile } from 'child_process';

// Every namht-* skill is exposed in the UI. The webview may request nothing
// else — the host rejects any command not on this list.
const ALLOWED = new Set([
  'namht-scan', 'namht-rescan', 'namht-ask', 'namht-map', 'namht-system-map', 'namht-document',
  'namht-discover', 'namht-plan', 'namht-plan-review',
  'namht-build', 'namht-fix-bug', 'namht-migrate', 'namht-simplify', 'namht-perf', 'namht-observe',
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
    })
  );
}
export function deactivate() {}

class SpecKitViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private procs = new Map<string, ChildProcess>();   // runId → process
  private sessions = new Map<string, string>();       // runId → claude session_id

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')] };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage((m: any) => {
      switch (m?.type) {
        case 'check': this.checkClaude(); this.post({ type: 'history', items: this.history() }); break;
        case 'run': this.start(m); break;
        case 'followup': this.followup(String(m.runId), String(m.text || ''), String(m.sessionId || '')); break;
        case 'cancel': this.cancel(String(m.runId)); break;
        case 'openReport': this.openReport(String(m.path || '')); break;
        case 'clearHistory': this.ctx.workspaceState.update(HIST_KEY, []); this.post({ type: 'history', items: [] }); break;
      }
    });
  }

  private post(m: unknown) { this.view?.webview.postMessage(m); }
  private cfg() {
    const c = vscode.workspace.getConfiguration('namhtSpecUi');
    return { claudePath: c.get<string>('claudePath', 'claude'), extraArgs: c.get<string[]>('extraArgs', ['--permission-mode', 'acceptEdits']) };
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
    if (!ALLOWED.has(command)) { this.post({ type: 'log', runId, text: `[blocked: "${command}" is not allowed]` }); return; }
    const cwd = this.cwd();
    if (!cwd) { this.post({ type: 'log', runId, text: '[open a project folder first — skills read that project]' }); this.post({ type: 'done', runId, code: 1 }); return; }
    const prompt = `/${command} ${String(m.args || '')}`.trim();
    this.histUpsert({ runId, command, title: m.title || command, values: m.values || {}, when: Date.now(), status: 'running' });
    this.spawnClaude(runId, ['-p', prompt], cwd, `▶ ${prompt}\n(cwd: ${cwd})\n\n`);
  }

  private followup(runId: string, text: string, sessionId?: string) {
    if (!text.trim()) return;
    const cwd = this.cwd(); if (!cwd) return;
    // Prefer the id passed from the webview (survives reload — Claude persists sessions on disk),
    // else the in-memory map, else continue the most recent session.
    const sid = (sessionId && sessionId.trim()) ? sessionId.trim() : this.sessions.get(runId);
    if (sid) this.sessions.set(runId, sid);
    const resume = sid ? ['--resume', sid] : ['--continue'];
    this.spawnClaude(runId, ['-p', text, ...resume], cwd, `\n\n────────\n💬 ${text}\n\n`);
  }

  private spawnClaude(runId: string, baseArgs: string[], cwd: string, header: string) {
    if (this.procs.has(runId)) { this.post({ type: 'log', runId, text: '[this run is still busy — wait for it or cancel]' }); return; }
    const { claudePath, extraArgs } = this.cfg();
    const cliArgs = [...baseArgs, '--output-format', 'stream-json', '--verbose', ...extraArgs];
    this.post({ type: 'running', runId });
    this.post({ type: 'log', runId, text: header });

    let seen = '', finalText = '', lineBuf = '';
    const emit = (t: string) => { seen += t + '\n'; this.post({ type: 'log', runId, text: t }); };
    const feed = (line: string) => { const r = this.handleLine(runId, line, emit); if (r !== undefined) finalText = r; };

    let proc: ChildProcess;
    try { proc = spawn(claudePath, cliArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { this.post({ type: 'log', runId, text: `[failed to start Claude: ${String(e)}]` }); this.post({ type: 'done', runId, code: 1 }); return; }
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
      if (finalText) this.post({ type: 'result', runId, text: finalText });
      const report = this.findReport(seen + '\n' + finalText, cwd);
      this.post({ type: 'done', runId, code: code ?? 0, report });
      this.histPatch(runId, { status: code === 0 ? 'done' : 'error', result: finalText.slice(0, 24000), report });
    });
  }

  private handleLine(runId: string, line: string, emit: (t: string) => void): string | undefined {
    const s = line.trim(); if (!s) return undefined;
    let ev: any; try { ev = JSON.parse(s); } catch { emit(s); return undefined; }
    if (ev.type === 'system' && ev.subtype === 'init') {
      if (ev.session_id) { this.sessions.set(runId, ev.session_id); this.histPatch(runId, { sessionId: ev.session_id }); this.post({ type: 'session', runId, sessionId: ev.session_id }); }
      emit(`▸ session started · model ${ev.model || '?'} · ${(ev.tools?.length || 0)} tools available`); return undefined;
    }
    if (ev.type === 'assistant' && ev.message?.content) {
      for (const c of ev.message.content) {
        if (c.type === 'text' && c.text?.trim()) emit(c.text.trim());
        else if (c.type === 'tool_use') emit(`🔧 ${c.name}${this.shortInput(c.input)}`);
      }
      return undefined;
    }
    if (ev.type === 'user' && ev.message?.content) {
      for (const c of ev.message.content) if (c.type === 'tool_result') emit(`   ↳ ${c.is_error ? 'error' : 'ok'}${this.resultLen(c.content)}`);
      return undefined;
    }
    if (ev.type === 'result') return typeof ev.result === 'string' ? ev.result : undefined;
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

  private cancel(runId: string) {
    const p = this.procs.get(runId);
    if (p) { p.kill('SIGTERM'); this.procs.delete(runId); this.post({ type: 'log', runId, text: '\n[cancelled]' }); this.post({ type: 'done', runId, code: 130 }); this.histPatch(runId, { status: 'cancelled' }); }
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
