const test = require('node:test');
const assert = require('node:assert/strict');
const { createController } = require('../src/controller');
const { UsageError } = require('../src/usage');

const usage = { used: 25, total: 100, percent: 25 };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function harness(t, fetch = async () => usage, values = {}) {
  const commands = new Map();
  const timers = new Map();
  const logs = [], warnings = [], external = [], executions = [];
  let configListener, trustListener, nextTimer = 0;
  const item = { show() { assert.ok(!this.disposed); }, dispose() { this.disposed = true; } };
  const disposable = (cleanup = () => {}) => ({ dispose: cleanup });
  const output = { appendLine: line => logs.push(line), dispose() { this.disposed = true; } };
  const vscode = {
    StatusBarAlignment: { Right: 2 }, ThemeColor: class { constructor(id) { this.id = id; } },
    window: {
      createStatusBarItem: () => item, createOutputChannel: () => output,
      showWarningMessage: async (...args) => { warnings.push(args); return values.action; },
    },
    commands: {
      registerCommand: (id, fn) => { commands.set(id, fn); return disposable(() => commands.delete(id)); },
      executeCommand: async (...args) => executions.push(args),
    },
    workspace: {
      isTrusted: values.isTrusted !== false,
      getConfiguration: () => ({ get: (key, fallback) => values[key] ?? fallback, inspect: () => ({ defaultValue: 'kiro-cli', globalValue: values.cliPath, workspaceValue: values.workspaceCliPath }) }),
      onDidChangeConfiguration: listener => { configListener = listener; return disposable(() => { configListener = undefined; }); },
      onDidGrantWorkspaceTrust: listener => { trustListener = listener; return disposable(() => { trustListener = undefined; }); },
    },
    env: { openExternal: async uri => external.push(uri) }, Uri: { parse: url => url },
  };
  const calls = [];
  const controller = createController(vscode, {
    fetchUsage: (...args) => { calls.push(args); return fetch(...args); },
    now: () => new Date('2026-11-08T04:00:00Z'),
    setTimeout: (fn, ms) => { timers.set(++nextTimer, { fn, ms }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  t.after(() => controller.dispose());
  const change = (newValues, relevant = true) => { Object.assign(values, newValues); configListener({ affectsConfiguration: () => relevant }); };
  const fire = () => { const [id, timer] = [...timers][0]; timers.delete(id); timer.fn(); };
  return { controller, item, commands, timers, logs, warnings, external, executions, values, calls, output, change, fire, trust: () => { vscode.workspace.isTrusted = true; trustListener(); } };
}

test('startup, status, accessibility, commands, timer and repeated start', async t => {
  const h = harness(t);
  h.controller.start(); h.controller.start();
  assert.equal(h.item.text, '⚪ Kiro');
  await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.item.text, '🟢 25/100 · 25%');
  assert.equal(h.item.command, 'kiro-usage.refresh');
  assert.match(h.item.accessibilityInformation.label, /25\/100/);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, 60000);
  assert.equal(h.commands.size, 2);
  assert.equal(h.warnings.length, 0);
});
test('poll only after completion; concurrent refreshes share a request', async t => {
  const d = deferred(); const h = harness(t, () => d.promise);
  h.controller.start();
  const a = h.controller.refresh(), b = h.controller.refresh();
  assert.equal(a, b);
  await tick();
  assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
  d.resolve(usage); await a;
  assert.equal(h.timers.size, 1);
  h.fire(); await tick();
  assert.equal(h.calls.length, 2); assert.equal(h.timers.size, 1);
});
test('manual-only mode still refreshes on start and command', async t => {
  const h = harness(t, undefined, { refreshIntervalSeconds: 0 });
  h.controller.start(); await tick();
  assert.equal(h.timers.size, 0);
  await h.commands.get('kiro-usage.refresh')();
  assert.equal(h.calls.length, 2); assert.equal(h.timers.size, 0);
});
test('refresh preserves usage, severity, tooltip and accessibility until completion', async t => {
  const d = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? Promise.resolve({ used: 95, total: 100, percent: 95 }) : d.promise);
  h.controller.start(); await tick();
  const before = { text: h.item.text, tooltip: h.item.tooltip, backgroundColor: h.item.backgroundColor, accessibilityInformation: h.item.accessibilityInformation };
  const request = h.controller.refresh(); await tick();
  assert.ok(h.controller.getStatus().refreshing);
  assert.deepEqual({ text: h.item.text, tooltip: h.item.tooltip, backgroundColor: h.item.backgroundColor, accessibilityInformation: h.item.accessibilityInformation }, before);
  d.resolve(usage); await request;
  assert.equal(h.item.text, '🟢 25/100 · 25%');
  assert.equal(h.item.backgroundColor, undefined);
});
test('retry preserves the error display until a new result arrives', async t => {
  const d = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? Promise.reject(new UsageError('missing')) : d.promise);
  h.controller.start(); await tick();
  const before = { text: h.item.text, tooltip: h.item.tooltip, backgroundColor: h.item.backgroundColor };
  const request = h.controller.refresh(); await tick();
  assert.deepEqual({ text: h.item.text, tooltip: h.item.tooltip, backgroundColor: h.item.backgroundColor }, before);
  d.resolve(usage); await request;
  assert.equal(h.item.text, '🟢 25/100 · 25%');
});

for (const percent of [25, 60, 95, null]) {
  test(`manual refresh replaces only the status icon at ${percent}%`, async t => {
    const d = deferred(); let count = 0;
    const value = { used: percent ?? 0, total: percent === null ? 0 : 100, percent };
    const h = harness(t, () => ++count === 1 ? Promise.resolve(value) : d.promise);
    h.controller.start(); await tick();
    const before = { ...h.item };
    const request = h.commands.get('kiro-usage.refresh')();
    assert.equal(h.item.text, '$(loading~spin)' + before.text.slice(before.text.indexOf(' ')));
    assert.equal(h.item.tooltip, before.tooltip);
    assert.equal(h.item.backgroundColor, before.backgroundColor);
    assert.equal(h.item.accessibilityInformation, before.accessibilityInformation);
    d.resolve(value); await request;
    assert.equal(h.item.text, before.text);
    assert.equal(h.controller.getStatus().refreshing, false);
  });
}

test('click during automatic refresh shows one spinner and shares the running request', async t => {
  const d = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? Promise.resolve(usage) : d.promise);
  h.controller.start(); await tick();
  h.fire(); await tick();
  assert.equal(h.item.text, '🟢 25/100 · 25%');
  const command = h.commands.get('kiro-usage.refresh');
  const a = command(), b = command();
  assert.equal(a, b);
  assert.equal(h.calls.length, 2);
  assert.equal(h.item.text, '$(loading~spin) 25/100 · 25%');
  d.resolve(usage); await a;
  assert.equal(h.item.text, '🟢 25/100 · 25%');
  assert.equal(h.timers.size, 1);
});

test('click during first load uses the reserved icon slot', async t => {
  const d = deferred(); const h = harness(t, () => d.promise);
  h.controller.start();
  assert.equal(h.item.text, '⚪ Kiro');
  const request = h.commands.get('kiro-usage.refresh')();
  assert.equal(h.item.text, '$(loading~spin) Kiro');
  d.resolve(usage); await request;
  assert.equal(h.calls.length, 1);
  assert.equal(h.item.text, '🟢 25/100 · 25%');
});

test('manual failure clears the spinner; retry replaces only the warning icon', async t => {
  let d = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? Promise.resolve(usage) : d.promise);
  h.controller.start(); await tick();
  const first = h.commands.get('kiro-usage.refresh')();
  await tick(); d.reject(new UsageError('timeout')); await first;
  assert.equal(h.item.text, '$(warning) 25/100 · 25% (stale)');
  assert.equal(h.warnings.length, 1);
  d = deferred();
  const retry = h.commands.get('kiro-usage.refresh')();
  assert.equal(h.item.text, '$(loading~spin) 25/100 · 25% (stale)');
  d.resolve(usage); await retry;
  assert.equal(h.item.text, '🟢 25/100 · 25%');
});

test('manual retry without a local CLI keeps the error text and restores warning', async t => {
  const d = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? Promise.reject(new UsageError('missing')) : d.promise);
  h.controller.start(); await tick();
  const before = { ...h.item };
  const retry = h.commands.get('kiro-usage.refresh')();
  assert.equal(h.item.text, before.text.replace('$(warning)', '$(loading~spin)'));
  assert.equal(h.item.tooltip, before.tooltip);
  await tick(); d.reject(new UsageError('missing')); await retry;
  assert.equal(h.item.text, before.text);
  assert.equal(h.warnings.length, 1);
});

for (const changePath of [false, true]) {
  test(`configuration change clears manual spinner (change path: ${changePath})`, async t => {
    const old = deferred(), next = deferred(); let count = 0;
    const h = harness(t, () => ++count === 1 ? Promise.resolve(usage) : count === 2 ? old.promise : next.promise);
    h.controller.start(); await tick();
    const manual = h.commands.get('kiro-usage.refresh')(); await tick();
    assert.equal(h.item.text, '$(loading~spin) 25/100 · 25%');
    h.change(changePath ? { cliPath: '/new/kiro-cli' } : { timeoutSeconds: 60 });
    assert.equal(h.calls[1][1].aborted, true);
    const expected = changePath ? '⚪ Kiro' : '🟢 25/100 · 25%';
    assert.equal(h.item.text, expected);
    old.resolve({ used: 95, total: 100, percent: 95 }); await manual;
    assert.equal(h.item.text, expected);
    next.resolve(usage); await tick();
    assert.equal(h.item.text, '🟢 25/100 · 25%');
  });
}
test('missing CLI is silent in background, retries and recovers', async t => {
  let missing = true;
  const h = harness(t, async () => { if (missing) throw new UsageError('missing'); return usage; });
  h.controller.start(); await tick();
  assert.match(h.item.text, /CLI not found/); assert.equal(h.warnings.length, 0);
  assert.match(h.item.tooltip, /Install Kiro CLI/); assert.equal(h.logs.length, 1);
  h.fire(); await tick(); assert.equal(h.logs.length, 1);
  missing = false; h.fire(); await tick();
  assert.equal(h.item.text, '🟢 25/100 · 25%');
  assert.equal(h.controller.getStatus().errorCode, undefined); assert.equal(h.logs.length, 2);
});
for (const code of ['auth', 'timeout', 'format', 'incompatible', 'output', 'permission', 'failed', 'config']) {
  test(`background failure: ${code}`, async t => {
    const h = harness(t, async () => { throw new UsageError(code); });
    h.controller.start(); await tick();
    assert.equal(h.controller.getStatus().errorCode, code);
    assert.equal(h.warnings.length, 0); assert.equal(h.timers.size, 1);
    assert.equal(h.item.backgroundColor.id, 'statusBarItem.warningBackground');
  });
}
test('failed refresh explicitly marks previous values stale and keeps last success time', async t => {
  let failed = false;
  const h = harness(t, async () => { if (failed) throw new UsageError('timeout'); return usage; });
  h.controller.start(); await tick(); failed = true;
  await h.controller.refresh();
  assert.equal(h.item.text, '$(warning) 25/100 · 25% (stale)');
  assert.match(h.item.tooltip, /Last successful update/);
  assert.match(h.item.tooltip, /Request timed out/);
  failed = false; await h.controller.refresh(); assert.doesNotMatch(h.item.text, /stale/);
});
test('high usage background clears after recovery to low usage or zero quota', async t => {
  let next = { used: 91, total: 100, percent: 91 };
  const h = harness(t, async () => next);
  h.controller.start(); await tick(); assert.equal(h.item.backgroundColor.id, 'statusBarItem.errorBackground');
  next = usage; await h.controller.refresh(); assert.equal(h.item.backgroundColor, undefined);
  next = { used: 0, total: 0, percent: null }; await h.controller.refresh(); assert.equal(h.item.text, '⚪ 0/0 · n/a');
  next = { used: 60, total: 100, percent: 60 }; await h.controller.refresh(); assert.match(h.item.text, /🟡/);
});
test('manual errors offer settings and installation help without leaking CLI output', async t => {
  const h = harness(t, async () => { throw { stdout: 'private-token=DO-NOT-LOG', stderr: 'Not logged in' }; }, { action: 'Open Settings' });
  h.controller.start(); await tick(); await h.commands.get('kiro-usage.refresh')();
  assert.equal(h.warnings.length, 1); assert.deepEqual(h.executions[0], ['workbench.action.openSettings', 'kiro-usage']);
  h.values.action = 'Installation Guide'; await h.commands.get('kiro-usage.refresh')();
  assert.equal(h.external[0], 'https://kiro.dev/docs/getting-started/installation/');
  h.values.action = undefined; await h.commands.get('kiro-usage.refresh')();
  assert.doesNotMatch(JSON.stringify([h.logs, h.warnings, h.item]), /DO-NOT-LOG/);
  await h.commands.get('kiro-usage.openSettings')(); assert.equal(h.executions.length, 2);
});
test('configuration change aborts old request and discards its late result', async t => {
  const old = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? old.promise : Promise.resolve(usage));
  h.controller.start(); await tick();
  h.change({ cliPath: '/new/kiro-cli', refreshIntervalSeconds: 300, timeoutSeconds: 60 });
  assert.equal(h.calls[0][1].aborted, true);
  await tick(); old.resolve({ used: 99, total: 100, percent: 99 }); await tick();
  assert.equal(h.item.text, '🟢 25/100 · 25%'); assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, 300000);
  assert.equal(h.calls[1][0].timeoutSeconds, 60);
});
test('late rejection after configuration change cannot replace current state', async t => {
  const old = deferred(); let count = 0;
  const h = harness(t, () => ++count === 1 ? old.promise : Promise.resolve(usage));
  h.controller.start(); await tick(); h.change({ timeoutSeconds: 60 }); await tick();
  old.reject(new UsageError('timeout')); await tick();
  assert.equal(h.controller.getStatus().errorCode, undefined); assert.equal(h.timers.size, 1);
});
test('path switch drops usage from the previous CLI/account', async t => {
  let failed = false;
  const h = harness(t, async () => { if (failed) throw new UsageError('missing'); return usage; });
  h.controller.start(); await tick(); failed = true; h.change({ cliPath: '/missing/kiro-cli' }); await tick();
  assert.match(h.item.text, /CLI not found/); assert.doesNotMatch(h.item.text, /25\/100/);
});
test('workspace cannot override executable and unrelated changes do not refresh', async t => {
  const h = harness(t, undefined, { workspaceCliPath: '/untrusted/command' });
  h.controller.start(); await tick(); assert.equal(h.calls[0][0].cliPath, 'kiro-cli');
  h.change({}, false); await tick(); assert.equal(h.calls.length, 1);
});
test('restricted workspace executes nothing; granting trust starts polling', async t => {
  const h = harness(t, undefined, { isTrusted: false });
  h.controller.start(); await tick();
  assert.equal(h.calls.length, 0); assert.equal(h.timers.size, 0); assert.match(h.item.text, /untrusted/);
  h.trust(); await tick(); assert.equal(h.calls.length, 1);
});
test('dispose clears timer, commands and UI and is idempotent', async t => {
  const h = harness(t); h.controller.start(); await tick();
  h.controller.dispose(); h.controller.dispose(); h.controller.start(); await h.controller.refresh();
  assert.equal(h.timers.size, 0); assert.equal(h.commands.size, 0); assert.equal(h.calls.length, 1);
  assert.ok(h.item.disposed); assert.ok(h.output.disposed); assert.ok(h.controller.getStatus().disposed);
});
test('dispose during request aborts and ignores late results', async t => {
  const d = deferred(); const h = harness(t, () => d.promise);
  h.controller.start(); await tick(); h.controller.dispose();
  assert.equal(h.calls[0][1].aborted, true);
  d.resolve(usage); await tick(); assert.equal(h.timers.size, 0);
});
test('dispose during failed manual refresh suppresses notification', async t => {
  const d = deferred(); const h = harness(t, () => d.promise);
  h.controller.start(); const command = h.commands.get('kiro-usage.refresh')();
  await tick(); h.controller.dispose(); d.reject(new UsageError('missing')); await command;
  assert.equal(h.warnings.length, 0);
});
test('repeated clicks coalesce both CLI requests and failure notifications', async t => {
  const d = deferred(); const h = harness(t, () => d.promise);
  h.controller.start();
  const command = h.commands.get('kiro-usage.refresh');
  const first = command(), second = command();
  assert.equal(first, second);
  await tick(); d.reject(new UsageError('auth'));
  await Promise.all([first, second]);
  assert.equal(h.calls.length, 1); assert.equal(h.warnings.length, 1);
});
