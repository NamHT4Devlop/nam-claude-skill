import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams, execFile } from 'child_process';

// Only these read-safe, non-dev skills are exposed in the UI. The webview may
// request nothing else — the host rejects any command not on this list.
const ALLOWED = new Set([
  'namht-ask',
  'namht-discover',
  'namht-plan',
  'namht-plan-review',
  'namht-qa',
  'namht-retro',
  'namht-document',
  'namht-system-map',
  'namht-splunk-report',
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
  private proc?: ChildProcessWithoutNullStreams;

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

    this.post({ type: 'running', command });
    this.post({ type: 'output', chunk: `▶ ${prompt}\n\n` });

    let buffer = '';
    try {
      this.proc = spawn(claudePath, ['-p', prompt, ...extraArgs], { cwd });
    } catch (e) {
      this.post({ type: 'output', chunk: `\n[failed to start Claude: ${String(e)}]\n` });
      this.post({ type: 'done', code: 1 });
      return;
    }

    this.proc.stdout.on('data', (d) => {
      const t = d.toString();
      buffer += t;
      this.post({ type: 'output', chunk: t });
    });
    this.proc.stderr.on('data', (d) => this.post({ type: 'output', chunk: d.toString() }));
    this.proc.on('error', (e) => {
      this.post({ type: 'output', chunk: `\n[error: ${e.message}]\n` });
    });
    this.proc.on('close', (code) => {
      this.proc = undefined;
      const report = this.findReport(buffer, cwd);
      this.post({ type: 'done', code: code ?? 0, report });
    });
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
