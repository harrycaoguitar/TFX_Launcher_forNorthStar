'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../src/modules/is_running'),'utf8');
function fixture(){
  let complete;const timers=new Set(),mod={exports:{}};
  vm.runInNewContext(source,{module:mod,Date,require(id){
    if(id==='../win')return ()=>({isVisible:()=>false});
    if(id==='child_process')return {execFile(...args){complete=args.at(-1);}};
    return require(id);
  },setTimeout(fn,delay){const t={fn,delay,unref(){}};timers.add(t);return t;},clearTimeout(t){timers.delete(t);}});
  return {api:mod.exports,timers,fire(){const t=[...timers][0];timers.delete(t);return t.fn();},finish(){complete(null,'[]');}};
}
test('stopping while a process query is outstanding cannot restart the polling loop',async()=>{
  const f=fixture(),pending=f.fire();f.api.stop();f.finish();await pending;assert.equal(f.timers.size,0);
});
test('old query completion cannot replace the newly requested launch poll',async()=>{
  const f=fixture(),pending=f.fire();f.api.speedUp(Date.now()+5000);f.finish();await pending;
  assert.deepEqual([...f.timers].map(t=>t.delay),[100]);
});
test('background inactivity uses one slow timer but guards can request a fresh query immediately',async()=>{
  const f=fixture(),p=f.fire();f.finish();await p;assert.deepEqual([...f.timers].map(t=>t.delay),[60000]);
  const a=f.api.snapshot();assert.equal(f.api.snapshot(),a);f.finish();assert.equal((await a).ok,true);
});
