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

export function activate(context: vscode.ExtensionContext) {
  const provider = new SpecKitViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('namhtSpec.view', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

export function deactivate() {}

class SpecKitViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private proc?: ChildProcess;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      switch (msg?.type) {
        case 'check':
          this.checkClaude();
          break;
        case 'run':
          this.run(String(msg.command || ''), String(msg.args || ''));
          break;
        case 'cancel':
          this.cancel();
          break;
        case 'openReport':
          this.openReport(String(msg.path || ''));
          break;
      }
    });
  }

  private post(m: unknown) {
    this.view?.webview.postMessage(m);
  }

  private cfg() {
    const c = vscode.workspace.getConfiguration('namhtSpecUi');
    return {
      claudePath: c.get<string>('claudePath', 'claude'),
      extraArgs: c.get<string[]>('extraArgs', ['--permission-mode', 'acceptEdits']),
    };
  }

  private cwd(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private checkClaude() {
    const { claudePath } = this.cfg();
    execFile(claudePath, ['--version'], (err, stdout) => {
      if (err) {
        this.post({ type: 'status', ok: false, msg: `Claude Code CLI not found ("${claudePath}"). Install it and sign in, or set namhtSpecUi.claudePath.` });
      } else {
        this.post({ type: 'status', ok: true, msg: `Claude Code ready (${String(stdout).trim()})` });
      }
    });
  }

  private run(command: string, args: string) {
    if (this.proc) {
      this.post({ type: 'output', chunk: '\n[a run is already in progress — cancel it first]\n' });
      return;
    }
    if (!ALLOWED.has(command)) {
      this.post({ type: 'output', chunk: `\n[blocked: "${command}" is not an allowed action]\n` });
      return;
    }
    const cwd = this.cwd();
    if (!cwd) {
      this.post({ type: 'output', chunk: '\n[open a project folder first — skills read that project]\n' });
      this.post({ type: 'done', code: 1 });
      return;
    }
    const prompt = `/${command} ${args}`.trim();
    const { claudePath, extraArgs } = this.cfg();
    // Stream the agent's steps (tool calls, narration) live, like a terminal.
    const cliArgs = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...extraArgs];

    this.post({ type: 'running', command });
    this.post({ type: 'output', chunk: `▶ ${prompt}\n(cwd: ${cwd})\n\n` });

    let seen = '';          // accumulated readable text (for report detection)
    let finalText = '';
    let lineBuf = '';
    const emit = (t: string) => { seen += t + '\n'; this.post({ type: 'output', chunk: t + '\n' }); };
    const feed = (line: string) => { finalText = this.handleLine(line, emit) ?? finalText; };

    try {
      // stdin 'ignore' → no "waiting for stdin" delay/warning.
      this.proc = spawn(claudePath, cliArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      this.post({ type: 'output', chunk: `\n[failed to start Claude: ${String(e)}]\n` });
      this.post({ type: 'done', code: 1 });
      return;
    }

    this.proc.stdout?.on('data', (d: Buffer) => {
      lineBuf += d.toString();
      let nl: number;
      while ((nl = lineBuf.indexOf('\n')) >= 0) { const l = lineBuf.slice(0, nl); lineBuf = lineBuf.slice(nl + 1); feed(l); }
    });
    this.proc.stderr?.on('data', (d: Buffer) => this.post({ type: 'output', chunk: d.toString() }));
    this.proc.on('error', (e) => this.post({ type: 'output', chunk: `\n[error: ${e.message}]\n` }));
    this.proc.on('close', (code) => {
      if (lineBuf.trim()) feed(lineBuf);
      this.proc = undefined;
      if (finalText) this.post({ type: 'result', text: finalText });
      const report = this.findReport(seen + '\n' + finalText, cwd);
      this.post({ type: 'done', code: code ?? 0, report });
    });
  }

  // Parse one stream-json line into a readable activity line. Returns the final
  // result text when the terminal 'result' event arrives, else undefined.
  private handleLine(line: string, emit: (t: string) => void): string | undefined {
    const s = line.trim();
    if (!s) return undefined;
    let ev: any;
    try { ev = JSON.parse(s); } catch { emit(s); return undefined; } // non-JSON (e.g. a warning) → show raw
    if (ev.type === 'system' && ev.subtype === 'init') {
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
      for (const c of ev.message.content) {
        if (c.type === 'tool_result') emit(`   ↳ ${c.is_error ? 'error' : 'ok'}${this.resultLen(c.content)}`);
      }
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

  private cancel() {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = undefined;
      this.post({ type: 'output', chunk: '\n[cancelled]\n' });
      this.post({ type: 'done', code: 130 });
    }
  }

  // Skills save + print a report path under spec-kit-sessions/ — surface it so
  // the user can open the nicely-rendered HTML.
  private findReport(out: string, cwd: string): string | undefined {
    const m = out.match(/[\w./~-]*spec-kit-sessions[\w./-]+\.(?:html|md)/);
    if (!m) return undefined;
    let p = m[0];
    if (!p.startsWith('/')) p = require('path').resolve(cwd, p);
    return p;
  }

  private openReport(p: string) {
    if (!p) return;
    const uri = vscode.Uri.file(p);
    if (p.endsWith('.html')) vscode.env.openExternal(uri);
    else vscode.commands.executeCommand('markdown.showPreview', uri);
  }

  private getHtml(webview: vscode.Webview): string {
    const uri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', f));
    const nonce = String(Date.now()) + Math.random().toString(36).slice(2);
    const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link href="${uri('main.css')}" rel="stylesheet">
</head><body>
<div id="app"></div>
<script nonce="${nonce}" src="${uri('main.js')}"></script>
</body></html>`;
  }
}
