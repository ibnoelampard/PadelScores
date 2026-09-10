import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { createEmptyState } from '../src/storage.js';
import { cloudText } from '../src/cloud-messages.js';
const bundle=(await build({entryPoints:['src/app.js'],bundle:true,format:'iife',write:false,plugins:[{name:'test-repository',setup(b){b.onResolve({filter:/\/supabase\.js$/},()=>({path:'fake',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`
 export const repository = window.testRepository;
 export const signIn = async()=>{};
 export const watchSession = ()=>()=>{};
 export const supabase={auth:{onAuthStateChange(fn){window.authChanged=fn;fn('INITIAL_SESSION',{user:{id:'A',email:'a@example.com'}});},async signOut(){window.authChanged('SIGNED_OUT',null);return {error:null};}}};
 `}));}}]})).outputFiles[0].text;
const wait=async(predicate)=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}assert.fail('UI condition timed out');};
async function fixture(t){
 const window=new Window({url:'https://padel-scores.vercel.app'});t.after(()=>window.happyDOM.abort());
 window.structuredClone=structuredClone;window.TextEncoder=TextEncoder;window.confirm=()=>true;window.alert=()=>{};
 let remote={revision:0,state:createEmptyState()};let fail=false;
 window.testRepository={load:async()=>structuredClone(remote),save:async(state,r)=>{if(fail)throw new Error('network');assert.equal(r,remote.revision);remote={revision:r+1,state:structuredClone(state)};return {revision:remote.revision};}};
 window.document.body.innerHTML='<main id="app"></main>';window.eval(bundle);
 await wait(()=>window.document.querySelector('.empty .primary-btn'));
 const click=text=>{const b=[...window.document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,`button ${text}`);b.click();};
 const input=(selector,value)=>{const n=window.document.querySelector(selector);assert.ok(n,selector);n.value=value;n.dispatchEvent(new window.Event('input',{bubbles:true}));return n;};
 return {window,click,input,remote:()=>remote,fail:()=>{fail=true;}};
}
async function setup(f){
 f.click('Create Match');f.input('#playerCount','4');f.input('#courtCount','1');f.input('#durationHours','1');f.click('Create Match');
 ['Ana','Budi','Cici','Dedi'].forEach((name,i)=>f.input(`.name-row:nth-child(${i+1}) input`,name));
 f.click('Create Match Schedule');
}
test('cloud UI creates session, saves score, recovers from errors without claiming saved',async t=>{
 const f=await fixture(t);await setup(f);
 f.click('Start');f.input('.scores input','1e2');
 await wait(()=>f.remote().state.schedule[0]?.scoreA==='100');
 assert.match(f.window.document.querySelector('.cloud-status').textContent,/Saved to database/);
 const score=f.input('.scores input','1000000');assert.ok(score.validationMessage);assert.equal(f.remote().state.schedule[0].scoreA,'100');
 f.input('.scores input','6');await wait(()=>f.remote().state.schedule[0].scoreA==='6');
 f.fail();f.input('.scores input','7');await wait(()=>f.window.document.querySelector('.scores input').disabled);
 assert.match(f.window.document.querySelector('.cloud-status').textContent,/Could not/);
 assert.equal(f.remote().state.schedule[0].scoreA,'6');
 assert.match(f.window.localStorage.getItem('padelscore-recovery-v1:A'),/"scoreA":"7"/);
});
test('sign out hides private session and offers Google sign in',async t=>{
 const f=await fixture(t);await setup(f);await wait(()=>f.remote().revision>0 && f.window.document.querySelector('.cloud-status').textContent==='Saved to database');
 f.click('Sign out');await wait(()=>f.window.document.querySelector('.auth-panel'));
 assert.match(f.window.document.body.textContent,/Sign in with Google/);assert.doesNotMatch(f.window.document.body.textContent,/Ana/);
});
test('cloud copy is translated for both languages',()=>{
 for(const key of ['login','error','conflict','legacy','restore','limits','invalidScore']){assert.notEqual(cloudText('id',key),key);assert.notEqual(cloudText('en',key),key);assert.notEqual(cloudText('id',key),cloudText('en',key));}
});
