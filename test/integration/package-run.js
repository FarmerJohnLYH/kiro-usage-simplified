const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runTests, downloadAndUnzipVSCode } = require('@vscode/test-electron');
const manifest = require('../../package.json');
const root = path.resolve(__dirname, '../..');

async function main() {
  const code = process.env.VSCODE_EXECUTABLE_PATH || await downloadAndUnzipVSCode(process.env.VSCODE_TEST_VERSION || 'stable');
  const codeDir = path.dirname(code);
  const relative = process.platform === 'darwin' ? '../Resources/app/out/cli.js' : 'resources/app/out/cli.js';
  const candidates = [path.join(codeDir, relative), ...fs.readdirSync(codeDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(codeDir, entry.name, relative))];
  const cli = candidates.find(file => fs.existsSync(file));
  if (!cli) throw new Error('Cannot locate VS Code CLI script beside ' + code);
  const base = path.join(root, '.vscode-test', process.env.KIRO_USAGE_LIVE_CLI ? 'packaged-live' : 'packaged-missing', manifest.publisher);
  const profile = path.join(base, 'profile');
  const extensions = path.join(base, 'extensions');
  fs.mkdirSync(path.join(profile, 'User'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'User', 'settings.json'), JSON.stringify({
    'kiro-usage.cliPath': process.env.KIRO_USAGE_LIVE_CLI || path.join(base, 'not-installed', 'kiro-cli'),
    'kiro-usage.refreshIntervalSeconds': 0,
    'telemetry.telemetryLevel': 'off', 'update.mode': 'none',
    'extensions.autoCheckUpdates': false, 'workbench.startupEditor': 'none',
  }));
  const profileArgs = ['--user-data-dir=' + profile, '--extensions-dir=' + extensions];
  const vsix = path.join(root, 'dist', `${manifest.name}-${manifest.version}.vsix`);
  const launcher = path.join(codeDir, 'bin', 'code.cmd');
  const legacyFlags = process.platform === 'win32' && fs.existsSync(launcher) && fs.readFileSync(launcher, 'utf8').includes('--ms-enable-electron-run-as-node') ? ['--ms-enable-electron-run-as-node'] : [];
  execFileSync(code, [cli, ...legacyFlags, ...profileArgs, '--install-extension', vsix, '--force'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: 'inherit',
  });
  await runTests({
    vscodeExecutablePath: code,
    extensionDevelopmentPath: path.join(root, 'test/fixtures/driver'),
    extensionTestsPath: path.join(__dirname, 'package-suite.js'),
    extensionTestsEnv: { KIRO_USAGE_PACKAGE_EXTENSIONS: extensions, KIRO_USAGE_LIVE_CLI: process.env.KIRO_USAGE_LIVE_CLI || '' },
    launchArgs: [...profileArgs, '--skip-welcome', '--skip-release-notes', '--disable-updates'],
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
