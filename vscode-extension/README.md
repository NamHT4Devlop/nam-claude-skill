# Spec Kit UI — VS Code extension (for PM / SM)

A **point-and-click** panel over the safe, read-oriented `namht-*` skills, so non-technical roles
(Product Managers, Scrum Masters) can use them **without typing slash commands or opening a terminal**.
It runs the **Claude Code CLI** under the hood — no API key of its own.

## What it exposes (read-safe skills only)
Ask · Sharpen an idea (Discover) · Plan an epic · Review a plan · QA test cases · Document a feature ·
Retrospective · System map · Splunk error digest.

> Developer skills that change code (`build`, `fix-bug`, `review`, `security-audit`, `migrate`,
> `observe`, `perf`, `simplify`) are **intentionally not exposed** here — those belong in the full
> Claude Code panel used by developers.

## Prerequisites
1. **Claude Code CLI** installed and signed in (`claude --version` works). The extension shells out to it.
2. The **`namht-*` skills installed** on the machine (`scripts/personal-install.sh` from this repo →
   symlinked into `~/.claude`). The CLI picks them up automatically.
3. **Open the target project folder** in VS Code — skills read *that* project's `knowledge-base/`.

## Run it (development)
```bash
cd vscode-extension
npm install
npm run compile
```
Then open this `vscode-extension/` folder in VS Code and press **F5** (Run → Start Debugging). A second
VS Code window opens with the extension loaded — click the **Spec Kit** icon in the Activity Bar.

## Package + install (share with PM/SM)
```bash
npm run compile
npx @vscode/vsce package        # produces namht-spec-ui-0.1.0.vsix
```
Send the `.vsix`; each person installs via **Extensions ▸ … ▸ Install from VSIX**. (They still need the
Claude Code CLI + the skills installed on their machine.)

## How it works
```
webview (cards + form)  --run{command,args}-->  extension host
                                                   └─ spawn: claude -p "/<command> <args>"  (cwd = project)
                                                   └─ stream stdout back to the webview
                                                   └─ detect the saved spec-kit-sessions report → "Open report"
```
- **Only whitelisted commands run** — the host rejects anything not in `ALLOWED` (see `src/extension.ts`).
- The **git-guard hook** and Claude Code's permission system still apply underneath.

## Settings
- `namhtSpecUi.claudePath` — path to the `claude` CLI (default `claude`).
- `namhtSpecUi.extraArgs` — extra args for `claude -p` (default `--permission-mode acceptEdits`, which
  auto-approves the report files skills save; tighten with `--allowedTools` if you prefer).

## Extend it
Add an action in `media/main.js` (`ACTIONS`) **and** add its command to `ALLOWED` in `src/extension.ts`.

## Localization
The UI is **English** (this repo is English-only at the source level). To present it to Vietnamese
PM/SM, translate the `title`/`desc`/`label` strings in `media/main.js` — they are the only user-facing text.
