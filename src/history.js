const fs = require('node:fs/promises');
const path = require('node:path');
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const round = n => Math.round(n * 1e6) / 1e6;
function category(used, quota) { return quota > 0 ? used > 2*quota/22 ? 'red' : used > .8*quota/22 ? 'yellow' : 'green' : 'unknown'; }
function accumulate(state, usage, date = new Date(), zone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!Number.isFinite(usage.used) || !Number.isFinite(usage.total) || usage.used < 0 || usage.total < 0) throw new Error('Invalid usage');
  const next = structuredClone(state || { version: 1, days: {}, gaps: [] });
  const at = date.toISOString(), key = dayKey(date), previous = next.last;
  if (previous && at <= previous.at) return next;
  const day = next.days[key] ||= { used: 0, quota: usage.total, partial: true, first: at, last: at };
  day.quota = usage.total; day.last = at;
  if (previous) {
    const delta = round(usage.used - previous.used);
    if (previous.zone === zone && delta >= 0 && previous.total === usage.total) {
      // Cross-midnight consumption belongs to the calendar day before this reading.
      const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
      const targetKey = previous.day === key ? key : dayKey(yesterday);
      const target = next.days[targetKey] ||= { used: 0, quota: usage.total, partial: true, first: previous.at, last: at };
      target.used = round(target.used + delta);
      target.quota = usage.total;
      target.last = at;
    } else if (delta !== 0 || previous.total !== usage.total || previous.zone !== zone) {
      next.gaps.push({ from: previous.at, to: at, credits: delta >= 0 && previous.total === usage.total ? delta : null, reason: previous.zone !== zone ? 'timezone' : delta < 0 || previous.total !== usage.total ? 'reset' : 'midnight' });
      if (next.days[previous.day]) next.days[previous.day].partial = true;
    }
  }
  next.last = { at, day: key, zone, used: usage.used, total: usage.total };
  next.gaps = next.gaps.slice(-400);
  return next;
}
function createHistory(directory) {
  const file = path.join(directory, 'daily-usage-v1.json'), lock = file + '.lock';
  let queue = Promise.resolve();
  async function read() {
    try {
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      if (value.version !== 1 || !value.days || !Array.isArray(value.gaps)) throw new Error('Invalid daily history');
      return value;
    } catch (e) { if (e.code === 'ENOENT') return { version: 1, days: {}, gaps: [] }; throw e; }
  }
  function record(usage, date) {
    const work = queue.catch(() => {}).then(async () => {
      await fs.mkdir(directory, { recursive: true });
      let held = false;
      for (let i=0;i<100;i++) {
        try { await fs.mkdir(lock); held=true; break; }
        catch(e) { if(e.code!=='EEXIST') throw e; if(Date.now()-(await fs.stat(lock).catch(()=>({mtimeMs:Date.now()}))).mtimeMs>30000) await fs.rm(lock,{recursive:true,force:true}); await new Promise(r=>setTimeout(r,50)); }
      }
      if(!held) throw new Error('Daily history is busy');
      try { const next=accumulate(await read(),usage,date); const temp=file+'.'+process.pid+'.tmp'; await fs.writeFile(temp,JSON.stringify(next)); await fs.rename(temp,file); return next; }
      finally { await fs.rm(lock,{recursive:true,force:true}); }
    });
    queue=work; return work;
  }
  return { read, record };
}
module.exports={dayKey,category,accumulate,createHistory};
