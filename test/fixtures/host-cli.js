const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
assert.deepEqual(process.argv.slice(2), ['chat', '--no-interactive', '/usage', '--v2']);
const mode = fs.readFileSync(path.join(process.env.KIRO_USAGE_TEST_FIXTURE, 'mode.txt'), 'utf8').trim();
if (mode === 'auth') { console.error('Not logged in. Run kiro-cli login.'); process.exit(1); }
if (mode === 'malformed') console.log('unsupported response');
else if (mode === 'timeout') setTimeout(() => {}, 30000);
else if (mode === 'slow') setTimeout(() => console.log('Credits (25 of 100 covered in plan), 25%'), 1000);
else if (mode === 'high') console.log('Credits (95 of 100 covered in plan), 95%');
else console.log('Credits (25 of 100 covered in plan), 25%');
