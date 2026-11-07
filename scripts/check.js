const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');

for (const folder of ['src', 'scripts', 'test']) {
  function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) check(file);
      else if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    }
  }
  check(path.join(root, folder));
}
execFileSync(process.execPath, ['--check', path.join(root, 'extension.js')], { stdio: 'inherit' });
for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE', '.vscodeignore']) assert.ok(fs.statSync(path.join(root, file)).size > 0, file);
assert.equal(manifest.main, './extension.js');
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
assert.equal(manifest.contributes.configuration.properties['kiro-usage.cliPath'].scope, 'machine');
if (manifest.repository) assert.ok(manifest.repository.url.startsWith('https://'));
if (process.argv.includes('--release')) {
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (manifest.publisher === 'local' || uuid.test(manifest.publisher) || !/^[a-z0-9][a-z0-9-]*$/i.test(manifest.publisher)) {
    console.error('Release blocked: set package.json publisher to your registered Marketplace publisher ID (not a user UUID or "local").');
    process.exit(1);
  }
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
console.log('Syntax and manifest checks passed.' + (manifest.publisher === 'local' ? ' Local preview only: publisher is not configured.' : ''));
