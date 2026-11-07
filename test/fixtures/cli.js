const mode = process.argv[2];
const usage = 'Credits (25.5 of 100 covered in plan), 25.5%';
switch (mode) {
  case 'success': console.log(usage); break;
  case 'ansi': console.log(`\x1b[32m${usage}\x1b[0m`); break;
  case 'auth': console.error('Not logged in. Run kiro-cli login. private-token=DO-NOT-LOG'); process.exitCode = 1; break;
  case 'auth-zero': console.log('Authentication required. private-token=DO-NOT-LOG'); break;
  case 'incompatible': console.error("unexpected argument '--v2'"); process.exitCode = 2; break;
  case 'failed': console.error('Network unavailable private-token=DO-NOT-LOG'); process.exitCode = 1; break;
  case 'malformed': console.log('Credits (something else)'); break;
  case 'oversized': process.stdout.write('x'.repeat(2 * 1024 * 1024)); break;
  case 'sleep': setTimeout(() => console.log(usage), 10000); break;
  case 'stdin': process.stdin.resume(); process.stdin.on('end', () => console.log(usage)); break;
  case 'context': {
    const assert = require('node:assert/strict');
    assert.equal(process.cwd().toLowerCase(), require('node:os').homedir().toLowerCase());
    assert.equal(process.env.NO_COLOR, '1');
    assert.equal(process.env.TERM, 'dumb');
    assert.deepEqual(process.argv.slice(3), ['chat', '--no-interactive', '/usage', '--v2']);
    console.log(usage);
    break;
  }
  default: throw new Error('Unknown test mode');
}
