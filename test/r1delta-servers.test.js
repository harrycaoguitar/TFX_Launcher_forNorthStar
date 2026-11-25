'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,createService}=require('../src/modules/r1delta-servers');
const payload=[
 {ip:'203.0.113.14',port:37015,host_name:'^A1B2C3D4Delta Test',map_name:'mp_angel_city',playlist_display_name:'#PL_ATTRITION',total_players:7,max_players:12,has_password:true,has_auth:true,version:'3.0.5'},
 {ip:'not-an-ip',port:2},{ip:'::1',port:0},{ip:'2001:db8::5',port:37015,host_name:'IPv6'}
];
test('normalizes official server records and drops invalid endpoints',()=>{
 const rows=normalize(payload);assert.equal(rows.length,2);assert.equal(rows[0].name,'Delta Test');assert.equal(rows[0].mode,'ATTRITION');assert.equal(rows[0].address,'203.0.113.14:37015');assert.equal(rows[0].password,true);assert.equal(rows[0].auth,true);assert.equal(rows[1].address,'[2001:db8::5]:37015');
});
test('caches master results and returns stale records after a failed refresh',async()=>{
 let now=1000,calls=0,fail=false;const service=createService({core:{},now:()=>now,fetch:async()=>{calls++;if(fail)throw Error('offline fixture');return payload;}});
 assert.equal((await service.get()).status,'online');assert.equal((await service.get()).status,'online');assert.equal(calls,1);now+=61000;fail=true;const stale=await service.get();assert.equal(stale.status,'stale');assert.equal(stale.servers.length,2);assert.equal(stale.error,'offline fixture');
});
test('joins with Delta auth, server password, and validated address arguments',async()=>{
 let launched;const service=createService({core:{launch:async(...args)=>{launched=args;return {ok:true};}},fetch:async()=>payload});
 await service.get();await service.join({key:normalize(payload)[0].key,password:'local-pass'});
 assert.deepEqual(launched[2].args,['+delta_online_auth_enable','1','+password','local-pass','+delta_connect','203.0.113.14:37015']);
 await assert.rejects(service.join({key:normalize(payload)[0].key}),/需要密码/);
 await assert.rejects(service.join({key:normalize(payload)[0].key,password:'bad; +quit'}),/不支持/);
});
