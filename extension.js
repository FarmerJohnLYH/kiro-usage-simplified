const vscode = require('vscode');
const { createController } = require('./src/controller');
const { createHistory } = require('./src/history');
const { createCalendar } = require('./src/calendar');
const { createLogger } = require('./src/logger');
let controller;
function activate(context) {
  const output = vscode.window.createOutputChannel('kiro usage');
  const log = createLogger(output);
  context.subscriptions.push(output);
  log('extension.activate.begin');
  try {
    const history = createHistory(context.globalStorageUri.fsPath, log);
    const calendar = createCalendar(vscode, context, history, log);
    controller = createController(vscode, {
      log,
      openCalendar: () => calendar.open(),
      onUsage: async (usage, at) => {
        log('history.record.begin', { usage, at });
        try { await history.record(usage, at); log('history.record.complete'); calendar.setError(undefined); }
        catch (error) { log('history.record.error', error); calendar.setError('日用量保存失败，请查看 kiro usage 输出。'); }
      },
    });
    context.subscriptions.push(controller, calendar);
    controller.start();
    log('extension.activate.complete');
    return { getStatus: () => controller.getStatus() };
  } catch (error) { log('extension.activate.error', error); throw error; }
}
function deactivate() { controller?.dispose(); controller = undefined; }
module.exports = { activate, deactivate };
