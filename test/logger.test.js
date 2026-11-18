const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger } = require('../src/logger');
test('logger retains long raw strings, nested details and error stacks', () => {
  const lines = [];
  const log = createLogger({ appendLine: line => lines.push(line) });
  const response = 'token=raw\n' + 'x'.repeat(20000);
  log('stdout', response);
  log('error', new Error('broken'));
  assert.ok(lines[0].endsWith(response));
  assert.match(lines[1], /Error: broken\n\s+at/);
});
test('output failure does not break the diagnosed operation', () => {
  assert.doesNotThrow(() => createLogger({ appendLine() { throw new Error('disposed'); } })('stage'));
});
test('activation shares exactly one output channel with all modules', t => {
  const Module = require('node:module');
  const original = Module._load;
  const channels = [], loggers = [];
  const extensionPath = require.resolve('../extension');
  Module._load = function (id, parent, ...rest) {
    if (parent?.filename === extensionPath) {
      if (id === 'vscode') return { window: { createOutputChannel(name) { channels.push(name); return { appendLine() {}, dispose() {} }; } } };
      if (id === './src/history') return { createHistory(directory, log) { loggers.push(log); return {}; } };
      if (id === './src/calendar') return { createCalendar(vscode, context, history, log) { loggers.push(log); return { dispose() {} }; } };
      if (id === './src/controller') return { createController(vscode, dependencies) { loggers.push(dependencies.log); return { start() {}, dispose() {}, getStatus() {} }; } };
    }
    return original.call(this, id, parent, ...rest);
  };
  t.after(() => { Module._load = original; delete require.cache[extensionPath]; });
  const extension = require('../extension');
  extension.activate({ globalStorageUri: { fsPath: '/unused' }, subscriptions: [] });
  extension.deactivate();
  assert.deepEqual(channels, ['kiro usage']);
  assert.equal(loggers.length, 3);
  assert.ok(loggers.every(log => log === loggers[0]));
});
