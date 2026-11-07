const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { parseUsage, UsageError, classifyError, normalizeSettings, executablePath, fetchUsage, severity, formatUsage, CLI_ARGS, MAX_BUFFER } = require('../src/usage');
const execute = promisify(execFile);
const settings = normalizeSettings();
const expected = { used: 25.5, total: 100, percent: 25.5 };
const line = (used, total, percent = '') => `Credits (${used} of ${total} covered in plan)${percent}`;

for (const [name, input, result] of [
  ['original format', line('25.5', '100', ', 25.5%'), expected],
  ['integer zero', line('0', '100', ', 0%'), { used: 0, total: 100, percent: 0 }],
  ['ANSI and CRLF', `\x1b[32mHeader\r\n${line('25.5', '100', ', 25.5%')}\x1b[0m\r\n`, expected],
  ['OSC hyperlink', `\x1b]8;;https://example.com\x07${line('25.5', '100')}\x1b]8;;\x07`, expected],
  ['progress bar', line('25.5', '100', '\n█████░░░ 26%'), { used: 25.5, total: 100, percent: 26 }],
  ['grouped decimals', line('1,234.5', '2,000', ', 61.73%'), { used: 1234.5, total: 2000, percent: 61.73 }],
  ['derived percent', line('1', '3'), { used: 1, total: 3, percent: 33.33 }],
  ['zero quota', line('0', '0', ', 0%'), { used: 0, total: 0, percent: null }],
  ['zero quota with usage', line('5', '0'), { used: 5, total: 0, percent: null }],
  ['over quota', line('120', '100', ', 120%'), { used: 120, total: 100, percent: 120 }],
  ['bonus ignored', 'Bonus credits: 1/5, 20%\n' + line('25.5', '100') + '\nBonus credits: 1/5, 20%', expected],
  ['blank lines and indentation', '\n  ' + line('25.5', '100') + '\n\n 25.5%\n', expected],
]) test(`parse: ${name}`, () => assert.deepEqual(parseUsage(input), result));

for (const [name, input] of [
  ['empty', ''], ['undefined', undefined], ['null', null], ['wrong output', 'logged in'],
  ['bonus only', 'Bonus credits: 1/5, 20%'], ['negative usage', line('-1', '100')],
  ['negative total', line('1', '-100')], ['negative percent', line('1', '100', ', -1%')],
  ['NaN', line('NaN', '100')], ['infinity', line('1', 'Infinity')],
  ['multiple decimal points', line('1.2.3', '100')], ['bad grouping', line('12,34', '100')],
  ['decimal comma', line('1,2', '100')], ['exponent', line('1e3', '100')],
  ['unsafe integer', line('9007199254740992', '100')],
  ['duplicate labels', line('1', '100') + '\n' + line('2', '100')],
  ['non-number percent', line('1', '100', ', NaN%')],
  ['overflow derived percent', line('1', '0.' + '0'.repeat(320) + '1')],
]) test(`reject: ${name}`, () => assert.throws(() => parseUsage(input), { code: 'format' }));

for (const [percent, level] of [[null, 'unknown'], [0, 'low'], [59.99, 'low'], [60, 'medium'], [90, 'medium'], [90.01, 'high'], [100, 'high'], [120, 'high']]) {
  test(`threshold ${percent}`, () => assert.equal(severity(percent), level));
}
test('format zero quota does not claim zero percent', () => assert.equal(formatUsage({ used: 0, total: 0, percent: null }), '0/0 · n/a'));
test('normalization defaults and valid settings', () => {
  assert.deepEqual(settings, { cliPath: 'kiro-cli', refreshIntervalSeconds: 60, timeoutSeconds: 30 });
  assert.deepEqual(normalizeSettings({ cliPath: ' /opt/kiro-cli ', refreshIntervalSeconds: 300, timeoutSeconds: 60 }), { cliPath: '/opt/kiro-cli', refreshIntervalSeconds: 300, timeoutSeconds: 60 });
});
for (const [input, expectedInterval] of [[0, 0], [1, 5], [4, 5], [5.8, 5], [86401, 86400], [-1, 60], ['10', 60], [NaN, 60], [Infinity, 60], [null, 60]]) {
  test(`interval normalization ${String(input)}`, () => assert.equal(normalizeSettings({ refreshIntervalSeconds: input }).refreshIntervalSeconds, expectedInterval));
}
test('timeout and empty path normalization', () => {
  assert.equal(normalizeSettings({ timeoutSeconds: -1 }).timeoutSeconds, 5);
  assert.equal(normalizeSettings({ timeoutSeconds: 121 }).timeoutSeconds, 120);
  assert.equal(normalizeSettings({ timeoutSeconds: NaN }).timeoutSeconds, 30);
  assert.equal(normalizeSettings({ timeoutSeconds: '15' }).timeoutSeconds, 30);
  assert.equal(normalizeSettings({ cliPath: ' ' }).cliPath, 'kiro-cli');
});
test('absolute paths, spaces and home expansion', () => {
  assert.equal(executablePath('C:\\Program Files\\Kiro\\kiro-cli.exe', 'win32'), 'C:\\Program Files\\Kiro\\kiro-cli.exe');
  assert.equal(executablePath('/opt/my tools/kiro-cli', 'linux'), '/opt/my tools/kiro-cli');
  assert.equal(executablePath('~/.local/bin/kiro-cli'), path.join(os.homedir(), '.local/bin/kiro-cli'));
  assert.equal(executablePath('kiro-cli'), 'kiro-cli');
});
for (const value of ['./kiro-cli', '../kiro-cli', 'kiro-cli --flag', '"C:\\Kiro\\kiro-cli.exe"', 'kiro\ncli', '', 'bad\0path']) {
  test(`invalid executable path ${JSON.stringify(value)}`, () => assert.throws(() => executablePath(value), { code: 'config' }));
}
for (const suffix of ['cmd', 'bat', 'ps1']) test(`Windows refuses ${suffix} shell wrappers`, () => assert.throws(() => executablePath(`C:\\Kiro\\kiro-cli.${suffix}`, 'win32'), { code: 'permission' }));

for (const [error, code] of [
  [{ code: 'ENOENT' }, 'missing'], [{ code: 'EACCES' }, 'permission'], [{ code: 'EPERM' }, 'permission'],
  [{ code: 'EINVAL' }, 'permission'], [{ code: 'ENOEXEC' }, 'permission'], [{ code: 'ETIMEDOUT' }, 'timeout'],
  [{ killed: true }, 'timeout'], [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 'output'],
  [{ name: 'AbortError' }, 'cancelled'], [{ code: 'ABORT_ERR' }, 'cancelled'],
  [{ stderr: 'Token has expired' }, 'auth'], [{ stdout: 'Please sign in' }, 'auth'],
  [{ stderr: 'KIRO_API_KEY is required' }, 'auth'], [{ stderr: 'unknown option --v2' }, 'incompatible'],
  [null, 'failed'], [new Error('private-token=DO-NOT-LOG'), 'failed'],
]) test(`classify ${code}: ${JSON.stringify(error)}`, () => {
  const result = classifyError(error);
  assert.equal(result.code, code);
  assert.doesNotMatch(result.message, /DO-NOT-LOG/);
});
test('preserves typed errors', () => {
  const error = new UsageError('format');
  assert.equal(classifyError(error), error);
});
test('spawn contract uses no shell, bounded output, home cwd, fixed args and closes stdin', async () => {
  let closed = false;
  await fetchUsage(settings, undefined, (file, args, options) => {
    assert.equal(file, 'kiro-cli');
    assert.deepEqual(args, CLI_ARGS);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.cwd, os.homedir());
    assert.equal(options.timeout, 30000);
    assert.equal(options.maxBuffer, MAX_BUFFER);
    const promise = Promise.resolve({ stdout: line('25.5', '100') });
    promise.child = { stdin: { end: () => { closed = true; } } };
    return promise;
  });
  assert.ok(closed);
});

function fixture(mode) {
  return (_file, args, options) => execute(process.execPath, [path.join(__dirname, 'fixtures', 'cli.js'), mode, ...args], options);
}
for (const mode of ['success', 'ansi', 'stdin', 'context']) test(`real child: ${mode}`, async () => {
  assert.deepEqual(await fetchUsage(settings, undefined, fixture(mode)), expected);
});
for (const [mode, code] of [['auth', 'auth'], ['auth-zero', 'auth'], ['incompatible', 'incompatible'], ['failed', 'failed'], ['malformed', 'format'], ['oversized', 'output']]) {
  test(`real child: ${mode}`, async () => {
    await assert.rejects(fetchUsage(settings, undefined, fixture(mode)), error => error.code === code && !error.message.includes('DO-NOT-LOG'));
  });
}
test('real child: missing executable', async () => {
  await assert.rejects(fetchUsage({ ...settings, cliPath: path.join(os.tmpdir(), 'kiro-usage-definitely-missing-' + process.pid, 'kiro-cli') }), { code: 'missing' });
});
test('real child: timeout terminates child', async () => {
  await assert.rejects(fetchUsage({ ...settings, timeoutSeconds: 0.1 }, undefined, fixture('sleep')), { code: 'timeout' });
});
test('real child: abort terminates child', async () => {
  const abort = new AbortController();
  const request = fetchUsage(settings, abort.signal, fixture('sleep'));
  abort.abort();
  await assert.rejects(request, { code: 'cancelled' });
});
test('real child: already aborted', async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(fetchUsage(settings, abort.signal, fixture('sleep')), { code: 'cancelled' });
});
