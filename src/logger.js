const { inspect } = require('node:util');

// One channel for every module. Do not redact or truncate diagnostic details.
function createLogger(output) {
  return (stage, detail) => {
    try {
      const text = detail === undefined ? '' : typeof detail === 'string' ? detail : inspect(detail, { depth: null, maxArrayLength: null, maxStringLength: null });
      output.appendLine(`[${new Date().toISOString()}] [${stage}]${text ? '\n' + text : ''}`);
    } catch { /* Logging must never interrupt the operation being diagnosed. */ }
  };
}
module.exports = { createLogger };
