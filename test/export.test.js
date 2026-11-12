const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv, createExporter } = require('../src/export');
const state = { days: { '2026-11-12': {used:1.25,quota:50}, '2026-10-31':{used:0,quota:100} } };
test('CSV exports all days sorted, preserves zero and decimals, with BOM and CRLF', () => {
  assert.equal(toCsv(state), '\uFEFFdate,credits,plan_credits\r\n2026-10-31,0,100\r\n2026-11-12,1.25,50\r\n');
});
test('invalid values cannot become spreadsheet formulas', () => {
  assert.throws(()=>toCsv({days:{'=CMD()':{used:1,quota:50}}}));
  assert.throws(()=>toCsv({days:{'2026-11-12':{used:'=CMD()',quota:50}}}));
});
function harness({days=state.days,target={path:'/chosen.csv'},fail=false}={}) {
 const writes=[],info=[],errors=[];let dialogs=0;
 const vscode={Uri:{file:p=>({path:p})},window:{showSaveDialog:async()=>{dialogs++;return target},showInformationMessage:async m=>info.push(m),showErrorMessage:async m=>errors.push(m)},workspace:{fs:{writeFile:async(uri,data)=>{if(fail)throw Error('denied');writes.push({uri,text:data.toString()})}}}};
 return {run:createExporter(vscode,{read:async()=>({days})}),writes,info,errors,dialogs:()=>dialogs};
}
test('export writes CSV to chosen destination',async()=>{const h=harness();await h.run();assert.equal(h.writes[0].text,toCsv(state));assert.equal(h.writes[0].uri.path,'/chosen.csv');assert.equal(h.info.length,1)});
test('cancel and empty history do not write',async()=>{for(const options of [{target:undefined,days:{}},{target:null}]){const h=harness(options);await h.run();assert.equal(h.writes.length,0)} });
test('save failure reports an error and permits retry',async()=>{const h=harness({fail:true});await h.run();await h.run();assert.equal(h.errors.length,2);assert.equal(h.info.length,0)});
test('concurrent clicks open only one save dialog',async()=>{const h=harness();await Promise.all([h.run(),h.run()]);assert.equal(h.dialogs(),1);assert.equal(h.writes.length,1)});
