const os = require('node:os');
const path = require('node:path');
const DPI = 800;
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}
function withDpi(input) {
  if (!input.subarray(0, 8).equals(SIGNATURE)) throw new Error('Invalid PNG signature');
  const parts = [SIGNATURE]; let offset = 8, header = false, ended = false;
  while (offset < input.length) {
    if (offset + 12 > input.length) throw new Error('Incomplete PNG chunk');
    const length = input.readUInt32BE(offset), end = offset + 12 + length;
    if (end > input.length) throw new Error('Incomplete PNG data');
    const type = input.toString('ascii', offset + 4, offset + 8);
    if (!header) {
      if (type !== 'IHDR' || length !== 13 || !input.readUInt32BE(offset + 8) || !input.readUInt32BE(offset + 12) || input.readUInt32BE(offset + 8) > 32767 || input.readUInt32BE(offset + 12) > 32767 || input.readUInt32BE(offset + 8) * input.readUInt32BE(offset + 12) > 150000000) throw new Error('Unexpected PNG dimensions');
      header = true;
    }
    if (type !== 'pHYs') parts.push(input.subarray(offset, end));
    if (type === 'IHDR') {
      const density = Buffer.alloc(9);
      density.writeUInt32BE(Math.round(DPI / 0.0254), 0); density.writeUInt32BE(Math.round(DPI / 0.0254), 4); density[8] = 1;
      parts.push(chunk('pHYs', density));
    }
    offset = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || offset !== input.length) throw new Error('Invalid PNG end');
  return Buffer.concat(parts);
}
function isBase64Payload(data) {
  if (typeof data !== 'string' || !data.length || data.length > 96 * 1024 * 1024 || data.length % 4 !== 0) return false;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  // Search for a single invalid character without matching the entire encoded image.
  return !/[^A-Za-z0-9+/=]/.test(data) && data.indexOf('=') === (padding ? data.length - padding : -1);
}
function createPngExporter(vscode, log = () => {}) {
  let busy = false;
  return async message => {
    if (busy) return false;
    busy = true; let stage = 'png.validate';
    try {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(message.month) || !isBase64Payload(message.data)) throw new Error('Invalid PNG export payload');
      const png = withDpi(Buffer.from(message.data, 'base64'));
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      stage = 'png.saveDialog'; log(stage, { month: message.month, width, height, dpi: DPI, bytes: png.length });
      const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(path.join(os.homedir(), `kiro-usage-${message.month}.png`)), filters: { PNG: ['png'] }, saveLabel: '保存图片', title: '分享当前月历 · PNG' });
      if (!target) { log('png.cancelled'); return false; }
      stage = 'png.writeFile'; log(stage, target.toString());
      await vscode.workspace.fs.writeFile(target, png);
      log('png.complete', { bytes: png.length, dpi: DPI });
      await vscode.window.showInformationMessage(`月历已导出（${width} × ${height}，${DPI} DPI，${(png.length / 1024 / 1024).toFixed(2)} MB）。`);
      return true;
    } catch (error) {
      log(stage + '.error', error);
      await vscode.window.showErrorMessage('月历图片导出失败，请查看 kiro usage 输出。');
      return false;
    } finally { busy = false; }
  };
}
module.exports = { DPI, crc32, chunk, withDpi, createPngExporter };
