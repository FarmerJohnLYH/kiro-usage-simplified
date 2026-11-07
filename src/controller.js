const { fetchUsage, classifyError, normalizeSettings, formatUsage, severity } = require('./usage');

const INSTALL_URL = 'https://kiro.dev/docs/getting-started/installation/';

function createController(vscode, dependencies = {}) {
  const fetch = dependencies.fetchUsage || fetchUsage;
  const schedule = dependencies.setTimeout || setTimeout;
  const unschedule = dependencies.clearTimeout || clearTimeout;
  const now = dependencies.now || (() => new Date());
  const item = vscode.window.createStatusBarItem('kiro-usage', vscode.StatusBarAlignment.Right, -1000);
  item.name = 'Kiro Usage';
  item.command = 'kiro-usage.refresh';
  const output = vscode.window.createOutputChannel('Kiro Usage');
  const subscriptions = [item, output];
  let disposed = false;
  let started = false;
  let timer;
  let pending;
  let manualPending;
  let lastSuccess;
  let lastError;
  let lastLoggedCode;
  let settings;

  function readSettings() {
    const config = vscode.workspace.getConfiguration('kiro-usage');
    // Executable selection is user/machine-controlled, never supplied by a workspace.
    const cli = config.inspect('cliPath');
    return normalizeSettings({
      cliPath: cli?.globalValue ?? cli?.defaultValue,
      refreshIntervalSeconds: config.get('refreshIntervalSeconds', 60),
      timeoutSeconds: config.get('timeoutSeconds', 30),
    });
  }

  function show(text, tooltip, background) {
    item.text = text;
    item.tooltip = tooltip;
    item.backgroundColor = background ? new vscode.ThemeColor(background) : undefined;
    item.accessibilityInformation = { label: `Kiro Usage: ${text.replace(/\$\([^)]*\)/g, '').trim()}` };
    item.show();
  }

  function renderSuccess(usage) {
    const level = severity(usage.percent);
    const dot = { low: '🟢', medium: '🟡', high: '🔴', unknown: '⚪' }[level];
    show(`${dot} ${formatUsage(usage)}`, `Kiro credit usage\nUpdated: ${lastSuccess.at.toLocaleString()}\nClick to refresh`, level === 'high' ? 'statusBarItem.errorBackground' : undefined);
  }

  function renderError(error) {
    const previous = lastSuccess ? `\nLast successful update: ${lastSuccess.at.toLocaleString()}\nPrevious usage: ${formatUsage(lastSuccess.usage)} (stale)` : '';
    const text = lastSuccess ? `$(warning) ${formatUsage(lastSuccess.usage)} (stale)` : `$(warning) Kiro: ${error.label}`;
    show(text, `${error.label}\n${error.message}${previous}\nClick to retry; use Kiro Usage: Open Settings to configure.`, 'statusBarItem.warningBackground');
    if (lastLoggedCode !== error.code) {
      output.appendLine(`[${now().toISOString()}] ${error.code}: ${error.message}`);
      lastLoggedCode = error.code;
    }
  }

  function clearTimer() {
    if (timer !== undefined) unschedule(timer);
    timer = undefined;
  }

  function scheduleNext() {
    clearTimer();
    if (!disposed && settings.refreshIntervalSeconds > 0) {
      timer = schedule(() => { timer = undefined; void refresh(); }, settings.refreshIntervalSeconds * 1000);
    }
  }

  function refresh() {
    if (disposed) return Promise.resolve();
    if (pending) return pending.promise;
    clearTimer();
    if (!vscode.workspace.isTrusted) {
      show('$(lock) Kiro: Workspace untrusted', 'Trust this workspace before running Kiro CLI.');
      return Promise.resolve();
    }
    const request = { abort: new AbortController() };
    const requestSettings = settings;
    pending = request;
    if (!lastSuccess && !lastError) show('Kiro', 'Kiro credit usage\nClick to refresh');
    request.promise = Promise.resolve().then(() => fetch(requestSettings, request.abort.signal)).then(usage => {
      if (disposed || pending !== request) return;
      lastSuccess = { usage, at: now() };
      lastError = undefined;
      if (lastLoggedCode) output.appendLine(`[${now().toISOString()}] Usage refresh recovered.`);
      lastLoggedCode = undefined;
      renderSuccess(usage);
    }, error => {
      if (disposed || pending !== request) return;
      lastError = classifyError(error);
      renderError(lastError);
    }).finally(() => {
      if (pending === request) {
        pending = undefined;
        if (!disposed) scheduleNext();
      }
    });
    return request.promise;
  }

  async function runManualRefresh() {
    await refresh();
    if (disposed || !lastError) return;
    const action = await vscode.window.showWarningMessage(`Kiro Usage: ${lastError.label}. ${lastError.message}`, 'Open Settings', 'Installation Guide');
    if (disposed) return;
    if (action === 'Open Settings') await vscode.commands.executeCommand('workbench.action.openSettings', 'kiro-usage');
    if (action === 'Installation Guide') await vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
  }

  function manualRefresh() {
    if (!manualPending) manualPending = runManualRefresh().finally(() => { manualPending = undefined; });
    return manualPending;
  }

  function restart() {
    clearTimer();
    const previous = settings;
    settings = readSettings();
    if (previous && previous.cliPath !== settings.cliPath) lastSuccess = undefined;
    lastError = undefined;
    if (pending) {
      const old = pending;
      pending = undefined;
      old.abort.abort();
    }
    return refresh();
  }

  function start() {
    if (started || disposed) return;
    started = true;
    subscriptions.push(
      vscode.commands.registerCommand('kiro-usage.refresh', manualRefresh),
      vscode.commands.registerCommand('kiro-usage.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', 'kiro-usage')),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('kiro-usage')) void restart();
      }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => { void restart(); }),
    );
    void restart();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimer();
    pending?.abort.abort();
    pending = undefined;
    for (const subscription of subscriptions) subscription.dispose();
  }

  function getStatus() {
    return { text: item.text, tooltip: item.tooltip, errorCode: lastError?.code, refreshing: Boolean(pending), disposed };
  }

  return { start, refresh, dispose, getStatus };
}

module.exports = { createController };
