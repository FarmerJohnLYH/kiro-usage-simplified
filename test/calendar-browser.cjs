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
 await page.evaluate(()=>{window.acquireVsCodeApi=()=>({getState:()=>undefined,setState:()=>{},postMessage:()=>{}})});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'media/calendar.js'),'utf8')});
 const days={};[4,8,12,26.4,0,6.3,9.8,null,22.6,20,5.4].forEach((used,i)=>{if(used!==null)days['2026-11-'+String(i+1).padStart(2,'0')]={used,quota:220,partial:true,first:'2026-11-01T00:00:00Z',last:'2026-11-11T01:40:00Z'}});
 await page.evaluate(state=>window.postMessage({type:'history',state,now:'2026-11-11T01:40:00Z'},'*'),{days,gaps:[],last:{total:220,at:'2026-11-11T01:40:00Z'}});await page.locator('#current').click();
 fs.mkdirSync(path.join(root,'dist','review'),{recursive:true});
 for(const [file,theme] of [['light_modern.json','light'],['dark_modern.json','dark']]){
 const c=colors(file);await page.evaluate(({c,theme})=>{document.documentElement.removeAttribute("style");for(const [k,v] of Object.entries(c))document.documentElement.style.setProperty('--vscode-'+k.replaceAll('.','-'),v);document.documentElement.style.setProperty('--vscode-font-family','Arial, sans-serif');document.documentElement.style.setProperty('--vscode-font-size','13px');document.body.className='vscode-'+theme;},{c,theme});
 const actual=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);const expected=c['editor.background'];assert.equal(actual,`rgb(${parseInt(expected.slice(1,3),16)}, ${parseInt(expected.slice(3,5),16)}, ${parseInt(expected.slice(5,7),16)})`);
 assert.equal(await page.locator('#timezone,.legend,#gaps,#detail,#updated').count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/\*|部分记录|首次采集开始记录|Asia\/Shanghai/);assert.equal(await page.locator('.day').count(),30);assert.equal(await page.locator('[data-date="2026-11-02"] .green').count(),1);assert.equal(await page.locator('[data-date="2026-11-10"] .yellow').count(),1);assert.equal(await page.locator('[data-date="2026-11-04"] .red').count(),1);
 await page.locator('[data-date="2026-11-04"]').click();assert.equal(await page.locator('[data-date="2026-11-04"]').getAttribute('aria-pressed'),'true');await page.mouse.move(0,0);await page.screenshot({path:path.join(root,'dist/review/calendar-'+theme+'.png'),fullPage:true});
 await page.locator('#prev').click();assert.match(await page.locator('#monthTitle').innerText(),/10 月/);await page.locator('#current').click();
 await page.setViewportSize({width:360,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(root,'dist/review/calendar-'+theme+'-narrow.png'),fullPage:true});await page.setViewportSize({width:1100,height:900});console.log('PASS '+theme+': actual VS Code palette, thresholds, date selection, month navigation, narrow layout');
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
