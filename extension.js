const vscode = require('vscode');
const { createController } = require('./src/controller');
const { createHistory } = require('./src/history');
const { createCalendar } = require('./src/calendar');
let controller;
function activate(context) {
  const history = createHistory(context.globalStorageUri.fsPath);
  const calendar = createCalendar(vscode, context, history);
  const log = vscode.window.createOutputChannel('Kiro Daily Usage');
  controller = createController(vscode, {
    openCalendar: () => calendar.open(),
    onUsage: (usage, at) => { void history.record(usage, at).then(() => calendar.setError(undefined), error => { log.appendLine(error.message); calendar.setError('日用量保存失败，请查看 Kiro Daily Usage 输出。'); }); },
  });
  context.subscriptions.push(controller, calendar, log);
  controller.start();
  return { getStatus: () => controller.getStatus() };
}
function deactivate() { controller?.dispose(); controller = undefined; }
module.exports = { activate, deactivate };
