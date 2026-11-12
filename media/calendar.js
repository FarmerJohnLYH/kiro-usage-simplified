(()=>{
const vscode=acquireVsCodeApi(),saved=vscode.getState();
let state={days:{},gaps:[]},now=new Date(),month=saved?.month||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,selected=saved?.selected,unit=saved?.unit==='percent'?'percent':'credits';
const $=id=>document.getElementById(id),key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,fmt=n=>n.toFixed(2),level=(v,q)=>q>0?v>2*q/22?'red':v>.8*q/22?'yellow':'green':'unknown',labels={red:'高用量',yellow:'中等用量',green:'低用量',unknown:'无有效套餐额度'};
const amountText=(used,quota)=>unit==='percent'?(quota>0?(used/quota*100).toFixed(2)+'%':'—'):fmt(used);
function setAmount(element, text) {
const numeric=document.createElement('span'),suffix=document.createElement('span');
numeric.className='value-number';suffix.className='value-unit';
numeric.textContent=text.endsWith('%')?text.slice(0,-1):text;
suffix.textContent=text.endsWith('%')?'%':'';
element.append(numeric,suffix);
}
function render(){
const today=key(now),[y,m]=month.split('-').map(Number),quota=state.last?.total,entries=Object.entries(state.days).filter(([d])=>d.startsWith(month+'-'));
$('monthTitle').textContent=`${y} 年 ${m} 月`;
$('heading').textContent=unit==='percent'?'每日用量 %':'每日 Credit 用量';
$('monthUsed').textContent=entries.length?amountText(entries.reduce((sum,[,d])=>sum+d.used,0),quota):'—';$('todayUsed').textContent=state.days[today]?amountText(state.days[today].used,state.days[today].quota):'—';$('quota').textContent=quota===undefined?'—':amountText(quota,quota);
for(const id of ['monthUsed','todayUsed','quota']){const text=$(id).textContent;$(id).replaceChildren();setAmount($(id),text);$(id).setAttribute('aria-label',text+'，点击切换为'+(unit==='percent'?'credits':'百分比'));}
const grid=$('calendar');grid.replaceChildren();for(let i=0;i<(new Date(y,m-1,1).getDay()+6)%7;i++)grid.append(document.createElement('div'));
for(let day=1;day<=new Date(y,m,0).getDate();day++){
const date=`${month}-${String(day).padStart(2,'0')}`,record=state.days[date],b=document.createElement('button'),dateNode=document.createElement('span'),amount=document.createElement('span');b.type='button';b.className='day';b.dataset.date=date;b.setAttribute('aria-pressed',String(date===selected));dateNode.className='date';dateNode.textContent=day+(date===today?' · 今':'');amount.className='amount';
if(record){const dot=document.createElement('i');dot.className='dot '+level(record.used,record.quota);dot.setAttribute('aria-hidden','true');amount.append(dot);setAmount(amount,amountText(record.used,record.quota));}else {amount.classList.add('no-record');setAmount(amount,'—');}
b.setAttribute('aria-label',`${date}，${record?amountText(record.used,record.quota)+(unit==='percent'?'':' credits')+'，'+labels[level(record.used,record.quota)]:date>today?'未来日期':'未记录'}`);b.append(dateNode,amount);b.onclick=event=>{selected=date;if(record&&(event.target.closest('.amount')||event.detail===0))unit=unit==='credits'?'percent':'credits';render();$('calendar').querySelector('[data-date="'+date+'"]').focus({preventScroll:true});};grid.append(b);
}
vscode.setState({month,selected,unit});
}
function move(delta){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);month=key(d).slice(0,7);render();}
for(const id of ['monthUsed','todayUsed','quota'])$(id).onclick=()=>{unit=unit==='credits'?'percent':'credits';render()};
$('exportCsv').onclick=()=>vscode.postMessage({type:'exportCsv'});
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('current').onclick=()=>{month=key(now).slice(0,7);selected=key(now);render()};
window.addEventListener('message',({data})=>{if(data.type==='history'){state=data.state;now=new Date(data.now);selected||=key(now);$('error').hidden=!data.error;$('error').textContent=data.error||'';render();}if(data.type==='error'){$('error').hidden=false;$('error').textContent=data.message;}});render();vscode.postMessage({type:'ready'});
})();
