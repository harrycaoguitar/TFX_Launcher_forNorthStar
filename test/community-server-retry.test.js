'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {fetchPayload,SOURCES}=require('../src/modules/server-list');

function fixture(attempts){
  let calls=0;
  const transport={get(_url,_options,callback){
    const attempt=attempts[calls++];
    const req=new EventEmitter();req.destroy=()=>{};
    queueMicrotask(()=>{
      if(attempt==='network'){req.emit('error',Error('connection failed'));return;}
      const res=new PassThrough();res.headers={};res.statusCode=attempt;
      callback(res);res.end('[]');
    });
    return req;
  }};
  return {transport,get calls(){return calls;}};
}

test('International list retries a transient connection failure once',async()=>{
  const f=fixture(['network',200]);
  assert.deepEqual(await fetchPayload(SOURCES.global,{transport:f.transport}),[]);
  assert.equal(f.calls,2);
});

test('International list stops after two network failures and does not retry HTTP failures',async()=>{
  for(const [attempts,code] of [[['network','network'],'NETWORK'],[[503],'http']]){
    const f=fixture(attempts);
    await assert.rejects(fetchPayload(SOURCES.global,{transport:f.transport}),{code});
    assert.equal(f.calls,attempts.length);
  }
});

test('China list keeps its original single-attempt behavior',async()=>{
  const f=fixture(['network']);
  await assert.rejects(fetchPayload(SOURCES.cn,{transport:f.transport}),{code:'NETWORK'});
  assert.equal(f.calls,1);
});
