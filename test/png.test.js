const test = require('node:test');
const assert = require('node:assert/strict');
const { crc32, chunk, withDpi, createPngExporter } = require('../src/png');
function fixture() {
 const header=Buffer.alloc(13);header.writeUInt32BE(9166);header.writeUInt32BE(7200,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('pHYs',Buffer.alloc(9)),chunk('IDAT',Buffer.from([1,2,3])),chunk('IEND',Buffer.alloc(0))]);
}
test('PNG density is 800 DPI with valid CRC and unchanged image data',()=>{
 const output=withDpi(fixture());let densities=0;
 for(let p=8;p<output.length;){const n=output.readUInt32BE(p),type=output.toString('ascii',p+4,p+8);assert.equal(output.readUInt32BE(p+n+8),crc32(output.subarray(p+4,p+n+8)));if(type==='pHYs'){densities++;assert.equal(output.readUInt32BE(p+8),31496);assert.equal(output.readUInt32BE(p+12),31496);assert.equal(output[p+16],1);}if(type==='IDAT')assert.deepEqual(output.subarray(p+8,p+n+8),Buffer.from([1,2,3]));p+=n+12;}
 assert.equal(densities,1);assert.deepEqual(withDpi(output),output);
});
test('invalid and incomplete PNGs are rejected',()=>{
 assert.throws(()=>withDpi(Buffer.from('bad')));assert.throws(()=>withDpi(fixture().subarray(0,40)));const wrong=fixture();wrong.writeUInt32BE(40000,16);assert.throws(()=>withDpi(wrong),/dimensions/);
});
test('PNG save handles cancel, write failure and subsequent retry',async()=>{
 let action='cancel',writes=0,errors=0;const vscode={Uri:{file:x=>x},window:{showSaveDialog:async()=>action==='cancel'?undefined:'/tmp/test.png',showInformationMessage:async()=>{},showErrorMessage:async()=>{errors++;}},workspace:{fs:{writeFile:async()=>{if(action==='fail')throw Error('disk full');writes++;}}}};
 const save=createPngExporter(vscode),message={month:'2026-11',data:fixture().toString('base64')};
 assert.equal(await save(message),false);assert.equal(writes,0);action='fail';assert.equal(await save(message),false);assert.equal(errors,1);action='save';assert.equal(await save(message),true);assert.equal(writes,1);assert.equal(await save({...message,month:'../bad'}),false);assert.equal(writes,1);
});

test('exports a multi-megabyte image and rejects malformed Base64 before saving', async () => {
  const base = fixture();
  const input = Buffer.concat([base.subarray(0, -12), chunk('IDAT', Buffer.alloc(4 * 1024 * 1024)), base.subarray(-12)]);
  const data = input.toString('base64');
  const errors = [];
  let writes = 0;
  const save = createPngExporter({
    Uri: { file: p => p },
    window: {
      showSaveDialog: async () => '/tmp/calendar.png',
      showInformationMessage: async () => {},
      showErrorMessage: async () => {}
    },
    workspace: { fs: { writeFile: async (_, png) => {
      assert.deepEqual(png, withDpi(input));
      writes++;
    } } }
  }, (stage, error) => { if (stage.endsWith('.error')) errors.push(error.message); });
  assert.equal(await save({ month: '2026-11', data }), true);
  for (const invalid of [data + '=', '=' + data.slice(1), data.slice(0, -4) + 'A===', data.slice(0, -1) + '!']) {
    assert.equal(await save({ month: '2026-11', data: invalid }), false);
    assert.equal(errors.pop(), 'Invalid PNG export payload');
  }
  assert.equal(writes, 1);
});
