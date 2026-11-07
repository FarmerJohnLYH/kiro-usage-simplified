const vscode = require('vscode');
const { createController } = require('./src/controller');
let controller;

function activate(context) {
  controller = createController(vscode);
  context.subscriptions.push(controller);
  controller.start();
  return { getStatus: () => controller.getStatus() };
}

function deactivate() {
  controller?.dispose();
  controller = undefined;
}

module.exports = { activate, deactivate };
