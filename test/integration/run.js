const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { runTests } = require('@vscode/test-electron');
const root = path.resolve(__dirname, '../..');
const base = path.join(root, '.vscode-test', 'usage-integration');
const fixture = path.join(base, 'CLI with spaces');
fs.mkdirSync(fixture, { recursive: true });
const executable = path.join(fixture, process.platform === 'win32' ? 'kiro-cli.exe' : 'kiro-cli');
if (process.platform === 'win32') {
  const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/out:' + executable, path.join(root, 'test/fixtures/FakeKiro.cs')], { stdio: 'inherit' });
} else {
  const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
  fs.writeFileSync(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(path.join(root, 'test/fixtures/host-cli.js'))} "$@"\n`, { mode: 0o755 });
}
fs.writeFileSync(path.join(fixture, 'mode.txt'), 'success');
// A separate profile keeps tests away from the user's extensions, settings and login.
const profile = path.join(base, 'profile');
fs.mkdirSync(path.join(profile, 'User'), { recursive: true });
fs.writeFileSync(path.join(profile, 'User', 'settings.json'), JSON.stringify({
  'kiro-usage.cliPath': path.join(fixture, 'not-installed', 'kiro-cli'),
  'kiro-usage.refreshIntervalSeconds': 0,
  'kiro-usage.timeoutSeconds': 5,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.autoCheckUpdates': false,
  'workbench.startupEditor': 'none',
}));

runTests({
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
  version: process.env.VSCODE_TEST_VERSION || 'stable',
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(__dirname, 'suite.js'),
  extensionTestsEnv: { KIRO_USAGE_TEST_FIXTURE: fixture, KIRO_USAGE_TEST_CLI: executable },
  launchArgs: ['--user-data-dir=' + profile, '--extensions-dir=' + path.join(base, 'extensions'), '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--disable-updates'],
}).catch(error => { console.error(error); process.exitCode = 1; });
