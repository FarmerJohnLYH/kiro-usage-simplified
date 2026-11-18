const { createLogger } = require('./logger');
const { fetchUsage, classifyError, normalizeSettings, formatUsage, severity } = require('./usage');

const INSTALL_URL = 'https://kiro.dev/docs/getting-started/installation/';

function createController(vscode, dependencies = {}) {
  const fetch = dependencies.fetchUsage || fetchUsage;
  const schedule = dependencies.setTimeout || setTimeout;
  const unschedule = dependencies.clearTimeout || clearTimeout;
  const now = dependencies.now || (() => new Date());
  const item = vscode.window.createStatusBarItem('kiro-usage', vscode.StatusBarAlignment.Right, -1000);
  item.name = 'Kiro Usage';
  item.command = 'kiro-usage.statusClick';
  const output = dependencies.log ? undefined : vscode.window.createOutputChannel('kiro usage');
  const log = dependencies.log || createLogger(output);
  const subscriptions = output ? [item, output] : [item];
  let requestSequence = 0;
  let disposed = false;
  let started = false;
  let timer;
  let pending;
  let manualPending;
  let lastSuccess;
  let lastError;
  let lastLoggedCode;
  let settings;
  let clickTimer;

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
    show(`${dot} ${formatUsage(usage)}`, `Kiro credit usage\nUpdated: ${lastSuccess.at.toLocaleString()}\nClick to refresh; double-click for daily calendar`, level === 'high' ? 'statusBarItem.errorBackground' : undefined);
  }

  function renderError(error) {
    const previous = lastSuccess ? `\nLast successful update: ${lastSuccess.at.toLocaleString()}\nPrevious usage: ${formatUsage(lastSuccess.usage)} (stale)` : '';
    const text = lastSuccess ? `$(warning) ${formatUsage(lastSuccess.usage)} (stale)` : `$(warning) Kiro: ${error.label}`;
    show(text, `${error.label}\n${error.message}${previous}\nClick to retry; use Kiro Usage: Open Settings to configure.`, 'statusBarItem.warningBackground');
    log('controller.renderError', error);
    lastLoggedCode = error.code;
  }

  function clearTimer() {
    if (timer !== undefined) unschedule(timer);
    timer = undefined;
  }

  function scheduleNext() {
    clearTimer();
    if (!disposed && settings.refreshIntervalSeconds > 0) {
      timer = schedule(() => { timer = undefined; void refresh(); }, Math.min(settings.refreshIntervalSeconds * 1000, new Date(now().getFullYear(), now().getMonth(), now().getDate()+1).getTime() - now().getTime()));
    }
  }

  function showManualProgress(request) {
    if (request.previousText !== undefined) return;
    // Replace the existing icon only; keep the usage, hover and accessible label stable.
    const text = item.text.replace(/^(?:🟢|🟡|🔴|⚪|\$\(warning\))(?= )/u, '$(loading~spin)');
    if (text !== item.text) {
      request.previousText = item.text;
      item.text = text;
    }
  }

  function refresh(manual = false) {
    log('controller.refresh.enter', { manual, disposed, pending: Boolean(pending) });
    if (disposed) return Promise.resolve();
    if (pending) {
      if (manual) showManualProgress(pending);
      return pending.promise;
    }
    clearTimer();
    if (!vscode.workspace.isTrusted) {
      log('controller.refresh.skipped', 'Workspace untrusted');
      show('$(lock) Kiro: Workspace untrusted', 'Trust this workspace before running Kiro CLI.');
      return Promise.resolve();
    }
    const request = { abort: new AbortController(), id: ++requestSequence };
    const requestLog = (stage, detail) => log(`request:${request.id} ${stage}`, detail);
    requestLog('controller.refresh.begin', settings);
    const requestSettings = settings;
    pending = request;
    if (!lastSuccess && !lastError) show('⚪ Kiro', 'Kiro credit usage\nClick to refresh');
    if (manual) showManualProgress(request);
    request.promise = Promise.resolve().then(() => fetch(requestSettings, request.abort.signal, undefined, requestLog)).then(async usage => {
      if (disposed || pending !== request) return;
      lastSuccess = { usage, at: now() };
      lastError = undefined;
      if (lastLoggedCode) log('controller.refresh.recovered');
      lastLoggedCode = undefined;
      renderSuccess(usage);
      requestLog('controller.refresh.rendered', usage);
      await dependencies.onUsage?.(usage, lastSuccess.at);
    }).catch(error => {
      requestLog('controller.refresh.error', error);
      if (disposed || pending !== request) return;
      lastError = classifyError(error);
      renderError(lastError);
    }).finally(() => {
      requestLog('controller.refresh.complete');
      if (pending === request) {
        pending = undefined;
        if (!disposed) scheduleNext();
      }
    });
    return request.promise;
  }

  async function runManualRefresh() {
    await refresh(true);
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
    log('controller.restart.settings', settings);
    if (previous && previous.cliPath !== settings.cliPath) lastSuccess = undefined;
    lastError = undefined;
    if (pending) {
      const old = pending;
      pending = undefined;
      if (old.previousText !== undefined) item.text = old.previousText;
      old.abort.abort();
    }
    return refresh();
  }

  function start() {
    if (started || disposed) return;
    started = true;
    subscriptions.push(
      vscode.commands.registerCommand('kiro-usage.refresh', manualRefresh),
      vscode.commands.registerCommand('kiro-usage.statusClick', () => {
        if (clickTimer !== undefined) { unschedule(clickTimer); clickTimer = undefined; dependencies.openCalendar?.(); }
        else clickTimer = schedule(() => { clickTimer = undefined; void manualRefresh(); }, 450);
      }),
      vscode.commands.registerCommand('kiro-usage.openCalendar', () => dependencies.openCalendar?.()),
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
    log('controller.dispose');
    disposed = true;
    if (clickTimer !== undefined) unschedule(clickTimer);
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
