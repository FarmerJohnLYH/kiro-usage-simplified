const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function createCalendar(vscode, context, history) {
  let panel, timer, error, disposed=false;
  async function update() {
    if (!panel || disposed) return;
    try { const state=await history.read(); if(panel) await panel.webview.postMessage({type:'history',state,error,now:new Date().toISOString()}); }
    catch { if(panel) await panel.webview.postMessage({type:'error',message:'无法读取本地日用量记录；请查看 Kiro Usage 输出。'}); }
  }
  function open() {
    if(disposed) return;
    if(panel) {panel.reveal();void update();return;}
    panel=vscode.window.createWebviewPanel('kiroUsageCalendar','Kiro · 每日用量',vscode.ViewColumn.Active,{enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
    const nonce=crypto.randomBytes(16).toString('hex');
    const css=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','calendar.css'));
    const js=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','calendar.js'));
    panel.webview.html=fs.readFileSync(path.join(context.extensionPath,'media','calendar.html'),'utf8').replaceAll('{{csp}}',panel.webview.cspSource).replaceAll('{{nonce}}',nonce).replace('{{css}}',css.toString()).replace('{{js}}',js.toString());
    panel.webview.onDidReceiveMessage(message=>{if(message?.type==='ready')void update();});
    timer=setInterval(()=>void update(),30000);
    panel.onDidDispose(()=>{panel=undefined;clearInterval(timer);});
  }
  return {open,update,setError(message){error=message;void update();},dispose(){disposed=true;clearInterval(timer);panel?.dispose();}};
}
module.exports={createCalendar};
