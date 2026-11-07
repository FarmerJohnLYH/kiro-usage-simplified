const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../../package.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error('Timed out: ' + description);
}

async function run() {
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert.ok(extension, 'Extension discovered by real VS Code');
  const api = await extension.activate();
  const status = () => api.getStatus();
  await waitFor(() => status().errorCode === 'missing' && !status().refreshing, 'CLI absent');
  assert.match(status().text, /CLI not found/);
  assert.match(status().tooltip, /Install Kiro CLI/);
  console.log('PASS: actual extension host activates without a CLI');
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('kiro-usage.refresh'));
  assert.ok(commands.includes('kiro-usage.openSettings'));

  const configuration = vscode.workspace.getConfiguration('kiro-usage');
  await configuration.update('cliPath', process.env.KIRO_USAGE_TEST_CLI, vscode.ConfigurationTarget.Global);
  await waitFor(() => status().text === '🟢 25/100 · 25%', 'recovery after setting executable path');
  console.log('PASS: configuration change recovers using executable path with spaces');
  const mode = value => fs.writeFileSync(path.join(process.env.KIRO_USAGE_TEST_FIXTURE, 'mode.txt'), value);
  mode('slow');
  const before = status();
  const refreshing = vscode.commands.executeCommand('kiro-usage.refresh');
  await waitFor(() => status().text === '$(loading~spin) 25/100 · 25%', 'manual refresh icon');
  assert.equal(status().tooltip, before.tooltip);
  await refreshing;
  assert.equal(status().text, before.text);
  console.log('PASS: manual refresh replaces only the icon and restores it on completion');

  await configuration.update('timeoutSeconds', 6, vscode.ConfigurationTarget.Global);
  await waitFor(() => status().refreshing, 'background refresh started');
  assert.equal(status().text, before.text);
  await waitFor(() => !status().refreshing, 'background refresh completed');
  console.log('PASS: background refresh keeps the status icon unchanged');

  mode('high');
  await vscode.commands.executeCommand('kiro-usage.refresh');
  assert.equal(status().text, '🔴 95/100 · 95%');
  console.log('PASS: contributed refresh command and high usage');

  mode('auth');
  await configuration.update('refreshIntervalSeconds', 5, vscode.ConfigurationTarget.Global);
  await waitFor(() => status().errorCode === 'auth', 'authentication state');
  assert.match(status().text, /stale/);
  assert.match(status().tooltip, /Sign-in required/);
  console.log('PASS: unauthenticated CLI and stale value');
  mode('success');
  await waitFor(() => status().text === '🟢 25/100 · 25%', 'automatic polling recovery');
  console.log('PASS: scheduled retry recovers');

  mode('malformed');
  await configuration.update('refreshIntervalSeconds', 0, vscode.ConfigurationTarget.Global);
  await waitFor(() => status().errorCode === 'format', 'unsupported output');
  console.log('PASS: unsupported output');
  mode('timeout');
  await configuration.update('timeoutSeconds', 5, vscode.ConfigurationTarget.Global);
  await waitFor(() => status().errorCode === 'timeout', 'process timeout');
  console.log('PASS: actual process timeout');

  mode('success');
  await vscode.commands.executeCommand('kiro-usage.refresh');
  assert.equal(status().errorCode, undefined);
  assert.equal(status().text, '🟢 25/100 · 25%');
  console.log('PASS: recovery clears error state');
  console.log(`Integration complete on VS Code ${vscode.version} / ${process.platform} / Node ${process.versions.node}`);
}

module.exports = { run };
