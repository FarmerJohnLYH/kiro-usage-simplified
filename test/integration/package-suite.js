const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vscode = require('vscode');
const manifest = require('../../package.json');

async function run() {
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert.ok(extension, 'Installed VSIX discovered');
  const relative = path.relative(process.env.KIRO_USAGE_PACKAGE_EXTENSIONS, extension.extensionPath);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Testing installed package, not source checkout');
  for (const file of ['extension.js', 'src/usage.js', 'src/controller.js', 'src/history.js', 'src/calendar.js', 'media/calendar.html', 'media/calendar.css', 'media/calendar.js']) {
    assert.deepEqual(fs.readFileSync(path.join(extension.extensionPath, file)), fs.readFileSync(path.resolve(__dirname, '../..', file)), 'Installed runtime matches source: ' + file);
  }
  const api = await extension.activate();
  const deadline = Date.now() + 45000;
  while (api.getStatus().refreshing && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  const status = api.getStatus();
  assert.equal(status.refreshing, false);
  if (process.env.KIRO_USAGE_LIVE_CLI) {
    assert.equal(status.errorCode, undefined, status.tooltip);
    assert.match(status.text, /\d.*\/.* · (?:[\d.]+%|n\/a)/);
    console.log('PASS: installed VSIX fetched live Kiro usage; no raw response or account details recorded');
  } else {
    assert.equal(status.errorCode, 'missing');
    assert.match(status.text, /CLI not found/);
    console.log('PASS: installed VSIX activates and handles absent CLI');
  }
  for (const [theme, kind] of [['Default Light Modern', vscode.ColorThemeKind.Light], ['Default Dark Modern', vscode.ColorThemeKind.Dark]]) {
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', theme, vscode.ConfigurationTarget.Global);
    const end = Date.now() + 10000;
    while (vscode.window.activeColorTheme.kind !== kind && Date.now() < end) await new Promise(r => setTimeout(r, 100));
    assert.equal(vscode.window.activeColorTheme.kind, kind);
    await vscode.commands.executeCommand('kiro-usage.openCalendar');
    await new Promise(r => setTimeout(r, 1500));
    assert.ok(vscode.window.tabGroups.all.some(g => g.tabs.some(t => t.label === 'Kiro · 每日用量')));
    console.log('PASS: installed calendar opens in ' + theme);
  }
  console.log(`Packaged smoke complete on VS Code ${vscode.version} / ${process.platform}`);
}
module.exports = { run };
