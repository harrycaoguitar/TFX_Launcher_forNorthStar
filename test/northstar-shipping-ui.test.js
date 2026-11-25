const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('shipping preload permits connection diagnostics',()=>{const source=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');const block=source.slice(source.indexOf('const receiveChannels'),source.indexOf('const invokeChannels'));assert.match(block||source,/"northstar-connection"/);});
test('shipping prototype receives late errors without changing launch success',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app/prototype/runtime.js'),'utf8'),listeners={},toasts=[],state={title:'tf2'};
 const ctx=vm.createContext({ipc:{on:(name,fn)=>listeners[name]=fn},state,paintData(){},render(){},toast:m=>toasts.push(m)});
 vm.runInContext(source.slice(source.indexOf("  let connectionNotice = ''"),source.indexOf("  ipc.on('launch-guard-result'")),ctx);
 listeners['launch-status'](null,{state:'starting'});listeners['launch-status'](null,{state:'confirmed'});
 listeners['northstar-connection'](null,{code:'session-expired'});assert.match(state.launchStep,/登录会话已失效/);assert.equal(state.launchProgress,100);assert.equal(state.busy,false);
 listeners['northstar-connection'](null,{code:'session-expired'});assert.equal(toasts.length,1);
 listeners['northstar-connection'](null,{code:'authenticated'});assert.match(state.launchStep,/认证已通过/);
 listeners['launch-status'](null,{state:'starting'});listeners['launch-status'](null,{state:'confirmed'});assert.equal(state.launchStep,'游戏已启动');
});
