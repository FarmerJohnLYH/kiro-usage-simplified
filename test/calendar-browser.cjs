// Run with PLAYWRIGHT_MODULE pointing to a locally installed playwright package.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const themeDir='/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/theme-defaults/themes';
function colors(file){const data=JSON.parse(fs.readFileSync(path.join(themeDir,file)));return {...(data.include?colors(data.include):{}),...data.colors};}
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:900},timezoneId:'Asia/Shanghai'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(root,'media/calendar.html'),'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/<link[^>]*>/,'').replace(/<script[^>]*><\/script>/,'');
 await page.setContent(html);await page.addStyleTag({content:fs.readFileSync(path.join(root,'media/calendar.css'),'utf8')});
 await page.evaluate(()=>{window.acquireVsCodeApi=()=>({getState:()=>undefined,setState:s=>{window.savedCalendarState=s},postMessage:m=>{window.lastCalendarMessage=m}})});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'media/calendar.js'),'utf8')});
 const days={};[4,8,12,26.4,0,6.3,9.8,null,22.6,20,5.4].forEach((used,i)=>{if(used!==null)days['2026-11-'+String(i+1).padStart(2,'0')]={used,quota:220,partial:true,first:'2026-11-01T00:00:00Z',last:'2026-11-11T01:40:00Z'}});
 await page.evaluate(state=>window.postMessage({type:'history',state,now:'2026-11-11T01:40:00Z'},'*'),{days,gaps:[],last:{total:220,at:'2026-11-11T01:40:00Z'}});await page.locator('#current').click();
 fs.mkdirSync(path.join(root,'dist','review'),{recursive:true});
 for(const [file,theme] of [['light_modern.json','light'],['dark_modern.json','dark']]){
 const c=colors(file);await page.evaluate(({c,theme})=>{document.documentElement.removeAttribute("style");for(const [k,v] of Object.entries(c))document.documentElement.style.setProperty('--vscode-'+k.replaceAll('.','-'),v);document.documentElement.style.setProperty('--vscode-font-family','Arial, sans-serif');document.documentElement.style.setProperty('--vscode-font-size','13px');document.body.className='vscode-'+theme;},{c,theme});
 const actual=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);const expected=c['editor.background'];assert.equal(actual,`rgb(${parseInt(expected.slice(1,3),16)}, ${parseInt(expected.slice(3,5),16)}, ${parseInt(expected.slice(5,7),16)})`);
 assert.equal(await page.locator('#timezone,.legend,#gaps,#detail,#updated').count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/\*|部分记录|首次采集开始记录|Asia\/Shanghai/);assert.equal(await page.locator('.day').count(),30);assert.equal(await page.locator('[data-date="2026-11-02"] .green').count(),1);assert.equal(await page.locator('[data-date="2026-11-10"] .yellow').count(),1);assert.equal(await page.locator('[data-date="2026-11-04"] .red').count(),1);
 await page.locator('[data-date="2026-11-04"]').click();assert.equal(await page.locator('[data-date="2026-11-04"]').getAttribute('aria-pressed'),'true');await page.mouse.move(0,0);await page.screenshot({path:path.join(root,'dist/review/calendar-'+theme+'.png'),fullPage:true});
 await page.locator('[data-date="2026-11-04"] .amount').click();
 assert.equal(await page.locator('[data-date="2026-11-04"] .amount').textContent(),'12.00%');
 assert.equal(await page.locator('[data-date="2026-11-01"] .amount').textContent(),'1.82%');
 assert.equal(await page.locator('[data-date="2026-11-05"] .amount').textContent(),'0.00%');
 assert.equal(await page.locator('[data-date="2026-11-08"] .amount').textContent(),'—');
 assert.equal(await page.locator('#quota').textContent(),'100.00%');
 assert.equal(await page.locator('#todayUsed').textContent(),'2.45%');
 assert.equal(await page.locator('#monthUsed').textContent(),'52.05%');
 assert.equal(await page.evaluate(()=>window.savedCalendarState.unit),'percent');
 const alignment=await page.locator('.day').evaluateAll(cells=>cells.filter(c=>c.querySelector('.value-unit').textContent==='%').map(c=>({unit:c.querySelector('.value-unit').getBoundingClientRect().right-c.getBoundingClientRect().left,num:c.querySelector('.value-number').getBoundingClientRect().right-c.getBoundingClientRect().left})));
 assert.ok(Math.max(...alignment.map(x=>x.unit))-Math.min(...alignment.map(x=>x.unit))<1);
 assert.ok(Math.max(...alignment.map(x=>x.num))-Math.min(...alignment.map(x=>x.num))<1);
 await page.mouse.move(0,0);await page.screenshot({path:path.join(root,'dist/review/calendar-percent-'+theme+'.png'),fullPage:true});
 await page.locator('#prev').click();assert.match(await page.locator('#monthTitle').innerText(),/10 月/);await page.locator('#current').click();
 await page.setViewportSize({width:360,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(root,'dist/review/calendar-'+theme+'-narrow.png'),fullPage:true});await page.setViewportSize({width:1100,height:900});
 assert.equal(await page.locator('[data-date="2026-11-04"] .amount').textContent(),'12.00%');
 await page.locator('#quota').click();assert.equal(await page.locator('[data-date="2026-11-04"] .amount').textContent(),'26.40');
 await page.locator('[data-date="2026-11-04"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-date="2026-11-04"] .amount').textContent(),'12.00%');
 await page.locator('#todayUsed').click();
 console.log('PASS '+theme+': actual VS Code palette, thresholds, date selection, month navigation, narrow layout');
 }
 if(process.env.LAYOUT_MATRIX){
 const results=[];
 const cases=[320,360,480,600,601,640,768,900,1100,1440].map(width=>({width,zoom:1})).concat([1.25,1.5,2].map(zoom=>({width:Math.floor(1100/zoom),zoom})));
 for(const theme of ['light','dark']){
 const c=colors(theme+'_modern.json');await page.evaluate(({c,theme})=>{document.documentElement.removeAttribute('style');for(const [k,v] of Object.entries(c))document.documentElement.style.setProperty('--vscode-'+k.replaceAll('.','-'),v);document.documentElement.style.setProperty('--vscode-font-family','Arial,sans-serif');document.documentElement.style.setProperty('--vscode-font-size','13px');document.body.className='vscode-'+theme;},{c,theme});
 for(const mode of ['credits','percent']){
 if(await page.evaluate(()=>window.savedCalendarState.unit)!==mode)await page.locator('#quota').click();
 for(const scenario of cases){await page.setViewportSize({width:scenario.width,height:900});
 const problems=await page.evaluate(()=>{
 const errors=[];if(document.documentElement.scrollWidth>innerWidth)errors.push('page overflow');
 for(const element of document.querySelectorAll('.day .value-number,.day .value-unit,.metric-value,nav,header')){
 const r=element.getBoundingClientRect(),p=element.closest('.day')?.getBoundingClientRect();
 if(element.scrollWidth>element.clientWidth+1)errors.push('text overflow '+element.className);
 if(p&&(r.left<p.left||r.right>p.right))errors.push('outside day '+element.className);
 }
 return [...new Set(errors)];});
 results.push({theme,mode,...scenario,problems});
 if(mode==='percent'&&[360,601,768,1100].includes(scenario.width))await page.screenshot({path:path.join(root,`dist/review/layout-${theme}-${scenario.width}.png`),fullPage:true});
 }
 }
 }
 fs.writeFileSync(path.join(root,'dist/review/layout-matrix.json'),JSON.stringify(results,null,2));
 const failed=results.filter(r=>r.problems.length);console.log('LAYOUT MATRIX',results.length,'cases',failed.length,'failures');if(failed.length)console.log(JSON.stringify(failed));assert.equal(failed.length,0);
 await page.setViewportSize({width:1100,height:900});if(await page.evaluate(()=>window.savedCalendarState.unit)!=='credits')await page.locator('#quota').click();
 }
 if(process.env.RATIO_MATRIX){
 const results=[];
 const cases=[{name:'ultrawide',width:1680,height:720},{name:'wide',width:1280,height:720},{name:'classic',width:1024,height:768},{name:'square',width:800,height:800},{name:'portrait',width:720,height:1280},{name:'narrow-tall',width:360,height:900},{name:'short',width:1280,height:360},{name:'compact',width:600,height:400},{name:'small-square',width:400,height:400}];
 for(const theme of ['light','dark']){
 const c=colors(theme+'_modern.json');await page.evaluate(({c,theme})=>{document.documentElement.removeAttribute('style');for(const [k,v] of Object.entries(c))document.documentElement.style.setProperty('--vscode-'+k.replaceAll('.','-'),v);document.documentElement.style.setProperty('--vscode-font-family','Arial,sans-serif');document.documentElement.style.setProperty('--vscode-font-size','13px');document.body.className='vscode-'+theme;},{c,theme});
 for(const mode of ['credits','percent']){
 if(await page.evaluate(()=>window.savedCalendarState.unit)!==mode)await page.locator('#quota').click();
 for(const scenario of cases){
 await page.setViewportSize({width:scenario.width,height:scenario.height});await page.evaluate(()=>scrollTo(0,0));
 const issues=await page.evaluate(()=>{
 const issues=[];if(document.documentElement.scrollWidth>innerWidth)issues.push('horizontal overflow');
 for(const el of document.querySelectorAll('.day .value-number,.day .value-unit,.metric-value')){
 const r=el.getBoundingClientRect(),cell=el.closest('.day');if(el.scrollWidth>el.clientWidth+1)issues.push('text clipped');
 if(cell){const c=cell.getBoundingClientRect();if(r.left<c.left-1||r.right>c.right+1||r.top<c.top-1||r.bottom>c.bottom+1)issues.push('outside cell');}
 }
 const button=document.getElementById('exportCsv').getBoundingClientRect();if(button.left<0||button.right>innerWidth||button.top<0||button.bottom>innerHeight)issues.push('export outside initial viewport');
 const rows=new Map();for(const cell of document.querySelectorAll('.day')){const r=cell.getBoundingClientRect();const row=rows.get(r.top)||[];row.push(r);rows.set(r.top,row);}for(const row of rows.values()){row.sort((a,b)=>a.left-b.left);for(let i=1;i<row.length;i++)if(row[i].left<row[i-1].right)issues.push('overlapping cells');}
 return [...new Set(issues)];});
 await page.locator('[data-date="2026-11-30"]').click();
 const lastVisible=await page.locator('[data-date="2026-11-30"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});if(!lastVisible)issues.push('last date unreachable');
 await page.locator('#exportCsv').click();assert.deepEqual(await page.evaluate(()=>window.lastCalendarMessage),{type:'exportCsv'});
 await page.locator('#prev').click();assert.match(await page.locator('#monthTitle').innerText(),/10 月/);await page.locator('#current').click();
 await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);
 if(mode==='percent')await page.screenshot({path:path.join(root,`dist/review/ratio-${theme}-${scenario.name}.png`)});
 const scroll=await page.evaluate(()=>({contentHeight:document.documentElement.scrollHeight,viewportHeight:innerHeight}));results.push({theme,mode,...scenario,...scroll,issues});
 }
 }
 }
 fs.writeFileSync(path.join(root,'dist/review/ratio-matrix.json'),JSON.stringify(results,null,2));const failed=results.filter(r=>r.issues.length);console.log('RATIO MATRIX',results.length,'cases',failed.length,'failures');if(failed.length)console.log(JSON.stringify(failed));assert.equal(failed.length,0);
 await page.setViewportSize({width:1100,height:900});if(await page.evaluate(()=>window.savedCalendarState.unit)!=='credits')await page.locator('#quota').click();
 }
 await page.locator('#monthUsed').click();
 await page.evaluate(()=>window.postMessage({type:'history',state:{days:{'2026-11-11':{used:4,quota:0}},gaps:[],last:{total:0,at:'2026-11-11T01:40:00Z'}},now:'2026-11-11T01:40:00Z'},'*'));
 await page.waitForFunction(()=>document.getElementById('quota').textContent==='—');
 assert.equal(await page.locator('[data-date="2026-11-11"] .amount').textContent(),'—');
 await page.locator('#exportCsv').click();assert.deepEqual(await page.evaluate(()=>window.lastCalendarMessage),{type:'exportCsv'});
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
