const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPngExporter } = require('./png');
const { createExporter } = require('./export');
function createCalendar(vscode, context, history, log = () => {}) {
  let panel, timer, error, disposed=false;
  const exportPng = createPngExporter(vscode, log);
  const exportCsv = createExporter(vscode, history, log);
  async function update() {
    if (!panel || disposed) return;
    let stage = 'calendar.update.readHistory';
    try {
      log(stage);
      const state = await history.read();
      stage = 'calendar.update.postMessage'; log(stage);
      if(panel) await panel.webview.postMessage({type:'history',state,error,now:new Date().toISOString()});
      log('calendar.update.complete');
    }
    catch (error) {
      log(stage + '.error', error);
      try { if(panel) await panel.webview.postMessage({type:'error',message:'无法读取本地日用量记录；请查看 kiro usage 输出。'}); }
      catch (notificationError) { log('calendar.update.errorNotification.failed', notificationError); }
    }
  }
  function open() {
    log('calendar.open.begin');
    try {
      if(disposed) return;
      if(panel) {panel.reveal();void update();return;}
      panel=vscode.window.createWebviewPanel('kiroUsageCalendar','Kiro · 每日用量',vscode.ViewColumn.Active,{enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
      const nonce=crypto.randomBytes(16).toString('hex');
      const css=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','calendar.css'));
      const js=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','calendar.js'));
      const capturejs=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','vendor','html-to-image.js'));
      const pngjs=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','calendar-png.js'));
      log('calendar.open.readTemplate');
      panel.webview.html=fs.readFileSync(path.join(context.extensionPath,'media','calendar.html'),'utf8').replaceAll('{{csp}}',panel.webview.cspSource).replaceAll('{{nonce}}',nonce).replace('{{css}}',css.toString()).replace('{{js}}',js.toString()).replace('{{pngjs}}',pngjs.toString()).replace('{{capturejs}}',capturejs.toString());
      panel.webview.onDidReceiveMessage(async message=>{
        if(message?.type==='exportPng'&&!disposed){const target=panel;try{await exportPng(message);}finally{try{await target?.webview.postMessage({type:'exportPngDone'});}catch(error){log('png.acknowledge.error',error);}}}
        if(message?.type==='exportPngError')log('png.render.error',{message:message.message,stack:message.stack});
        if(message?.type==='ready')void update();if(message?.type==='exportCsv'&&!disposed)void exportCsv();});
      timer=setInterval(()=>void update(),30000);
      panel.onDidDispose(()=>{panel=undefined;clearInterval(timer);});
      log('calendar.open.complete');
    } catch (error) { log('calendar.open.error', error); }
  }
  return {open,update,setError(message){error=message;void update();},dispose(){disposed=true;clearInterval(timer);panel?.dispose();}};
}
module.exports={createCalendar};
