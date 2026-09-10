import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSession } from '../src/cloud.js';
import { parseBackup, serializeBackup, readRecovery, writeRecovery } from '../src/backup.js';
import { createEmptyState } from '../src/storage.js';
const memory = () => { const map = new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; };
const draft = n => ({...createEmptyState(), session:{...createEmptyState().session,status:'setup',playerCount:n}});
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(save) {
 let remote={revision:0,state:createEmptyState()};
 const storage=memory();
 const repository={load:async()=>structuredClone(remote),save:save|| (async(state,revision)=>{if(revision!==remote.revision) throw new Error('revision_conflict'); remote={revision:revision+1,state:structuredClone(state)};return {revision:remote.revision};})};
 const cloud=new CloudSession({repository,storage,delay:100000});
 return {cloud,storage,setRemote:value=>{remote=value;}};
}
test('backup accepts legacy data and rejects foreign or broken files',()=>{
 const value=draft(4); assert.deepEqual(parseBackup(serializeBackup(value)),value);
 assert.deepEqual(parseBackup(JSON.stringify(value)),value);
 for(const text of ['{}','null','[]','{"session":{},"players":[],"courts":[],"schedule":[]}']) assert.throws(()=>parseBackup(text));
});
test('failed saves retain account-bound recovery and never report saved',async()=>{
 const {cloud,storage}=fixture(async()=>{throw new Error('network');});
 await cloud.connect({id:'A'});cloud.edit(draft(4));await cloud.flush();
 assert.equal(cloud.status,'error');assert.equal(cloud.dirty,true);
 assert.equal(readRecovery(storage,'A').state.session.playerCount,4);
 assert.equal(readRecovery(storage,'B'),null);cloud.dispose();
});
test('serial writes retain latest changes made during an in-flight save',async()=>{
 const first=deferred();const calls=[];
 const {cloud,storage}=fixture(async(s,r)=>{calls.push([s.session.playerCount,r]);return calls.length===1?first.promise:{revision:2};});
 await cloud.connect({id:'A'});cloud.edit(draft(4));const running=cloud.flush();
 cloud.edit(draft(8));first.resolve({revision:1});await running;
 assert.deepEqual(calls,[[4,0],[8,1]]);assert.equal(cloud.dirty,false);assert.equal(cloud.revision,2);assert.equal(readRecovery(storage,'A'),null);cloud.dispose();
});
test('remote changes cause conflict without overwriting local edits',async()=>{
 const {cloud,setRemote}=fixture();await cloud.connect({id:'A'});cloud.edit(draft(4));
 setRemote({revision:1,state:draft(8)});await cloud.refresh();
 assert.equal(cloud.status,'conflict');assert.equal(cloud.state.session.playerCount,4);
 await cloud.retry();assert.equal(cloud.status,'conflict');
 await cloud.discardAndReload();assert.equal(cloud.state.session.playerCount,8);assert.equal(cloud.dirty,false);cloud.dispose();
});
test('account changes ignore stale load responses and clear previous state',async()=>{
 const first=deferred(); const cloud=new CloudSession({storage:memory(),repository:{load:uid=>uid==='A'?first.promise:Promise.resolve({revision:2,state:draft(8)})}});
 const pending=cloud.connect({id:'A'});await cloud.connect({id:'B'});first.resolve({revision:1,state:draft(4)});await pending;
 assert.equal(cloud.user.id,'B');assert.equal(cloud.state.session.playerCount,8);
 await cloud.connect(null);assert.equal(cloud.state.session.status,'empty');cloud.dispose();
});
test('restoring a draft with stale base requires explicit conflict resolution',async()=>{
 const {cloud,storage,setRemote}=fixture();writeRecovery(storage,'A',{revision:0,state:draft(4)});setRemote({revision:1,state:draft(8)});
 await cloud.connect({id:'A'});assert.equal(cloud.recovery.state.session.playerCount,4);
 cloud.restoreRecovery();assert.equal(cloud.status,'conflict');assert.equal(cloud.state.session.playerCount,4);cloud.dispose();
});
test('server rejects stale write and preserves draft for export',async()=>{
 const {cloud,setRemote}=fixture();await cloud.connect({id:'A'});cloud.edit(draft(4));setRemote({revision:1,state:draft(8)});await cloud.flush();
 assert.equal(cloud.status,'conflict');assert.equal(cloud.dirty,true);cloud.dispose();
});
test('a slow refresh cannot roll back a newer acknowledged save',async()=>{
 const pending=deferred();let reads=0;
 const cloud=new CloudSession({storage:memory(),delay:100000,repository:{load:async()=>++reads===1?{revision:0,state:createEmptyState()}:pending.promise,save:async()=>({revision:1})}});
 await cloud.connect({id:'A'});const refresh=cloud.refresh();cloud.edit(draft(4));await cloud.flush();
 pending.resolve({revision:0,state:createEmptyState()});await refresh;
 assert.equal(cloud.revision,1);assert.equal(cloud.state.session.playerCount,4);cloud.dispose();
});
test('stale refresh failure cannot mark a newer successful save as failed',async()=>{
 const pending=deferred();let reads=0;
 const cloud=new CloudSession({storage:memory(),delay:100000,repository:{load:async()=>++reads===1?{revision:0,state:createEmptyState()}:pending.promise,save:async()=>({revision:1})}});
 await cloud.connect({id:'A'});const refresh=cloud.refresh();cloud.edit(draft(4));await cloud.flush();pending.reject(new Error('network'));await refresh;
 assert.equal(cloud.status,'ready');cloud.dispose();
});
