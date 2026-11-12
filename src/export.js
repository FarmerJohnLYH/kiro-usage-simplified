const os = require('node:os');
const path = require('node:path');
function toCsv(state) {
  const rows = ['date,credits,plan_credits'];
  for (const [date, day] of Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.used) || day.used < 0 || !Number.isFinite(day.quota) || day.quota < 0) throw new Error('Invalid daily record');
    rows.push(`${date},${day.used},${day.quota}`);
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
function createExporter(vscode, history) {
  let busy = false;
  return async function exportCsv() {
    if (busy) return;
    busy = true;
    try {
      const state = await history.read();
      if (!Object.keys(state.days).length) { await vscode.window.showInformationMessage('暂无可导出的用量数据。'); return; }
      const csv = toCsv(state);
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'kiro-usage.csv')),
        filters: { CSV: ['csv'] }, saveLabel: '导出', title: '导出全部每日 Credit 用量',
      });
      if (!target) return;
      await vscode.workspace.fs.writeFile(target, Buffer.from(csv, 'utf8'));
      await vscode.window.showInformationMessage('已导出全部每日 Credit 用量。');
    } catch {
      await vscode.window.showErrorMessage('导出失败，请检查数据和保存位置后重试。');
    } finally { busy = false; }
  };
}
module.exports = { toCsv, createExporter };
