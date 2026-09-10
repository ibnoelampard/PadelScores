import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createEmptyState, normalizeState } from '../src/storage.js';

const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const fixture = () => normalizeState({session:{status:'schedule',playerCount:5,courtCount:1,durationHours:1,slotMinutes:10}, players:Array.from({length:5},(_,i)=>({id:`p${i}`,name:`Player ${i}`})),courts:[{id:'c1',name:'Court 1'}],schedule:[{id:'m1',slotIndex:0,startMinute:0,courtId:'c1',teamA:['p4','p1'],teamB:['p2','p3'],scoreA:'6',scoreB:'2',started:true,finished:true,bye:['p0'],replacements:[{outPlayerId:'p0',inPlayerId:'p4',changedAt:'2026-09-10T01:02:03.000Z'}]}]});

test('database RPC transactions, validation, revisions and owner isolation', async t => {
 const migration = await readFile(new URL('../supabase/migrations/202609100001_padel.sql',import.meta.url),'utf8');
 const db = new PGlite();
 t.after(()=>db.close());
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${A}'),('${B}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`);
 await db.exec(migration);
 let currentUser;
 const user = async id => { currentUser = id || null; await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
 const save = async (state,rev,expectedUser=currentUser) => (await db.query('select public.save_padel_session($1::jsonb,$2::bigint,$3::uuid) as data',[JSON.stringify(state),rev,expectedUser])).rows[0].data;
 const load = async (expectedUser=currentUser) => (await db.query('select public.load_padel_session($1::uuid) as data',[expectedUser])).rows[0].data;
 await user(A);
 assert.deepEqual(await load(),{revision:0,state:createEmptyState()});
 const state=fixture();
 assert.deepEqual(await save(state,0),{revision:1});
 assert.deepEqual(await load(),{revision:1,state});
 await assert.rejects(save(createEmptyState(),0),/revision_conflict/);
 for(const mutate of [s=>s.schedule[0].scoreA='-1',s=>s.schedule[0].teamA[0]='missing',s=>s.schedule[0].teamB[0]='p1',s=>s.schedule[0].courtId='missing',s=>s.session.status='invalid',s=>s.players[0].removed='false',s=>s.session.playerCount='5',s=>s.schedule[0].replacements[0].inPlayerId='missing',s=>s.schedule[0].bye=['missing'],s=>s.players[0].name='x'.repeat(300),s=>s.schedule[0].finished='true',s=>s.schedule[0].teamA=[4,'p1']]){
   const invalid=structuredClone(state); mutate(invalid);
   await assert.rejects(save(invalid,1));
   assert.deepEqual(await load(),{revision:1,state});
 }
 await assert.rejects(save({...state,players:{}},1));
 await assert.rejects(save({...state,junk:'x'.repeat(2_100_000)},1));
 for (const table of ['sessions','session_players','courts','matches','match_players','match_replacements']) {
   await assert.rejects(db.exec(`delete from public.${table}`),/permission denied/);
 }
 await user(B);
 await assert.rejects(load(A),/account_mismatch/);
 await assert.rejects(save(state,0,A),/account_mismatch/);
 await assert.rejects(load(null),/account_mismatch/);
 await assert.rejects(save(state,0,null),/account_mismatch/);
 assert.deepEqual(await load(),{revision:0,state:createEmptyState()});
 for(const table of ['sessions','session_players','courts','matches','match_players','match_replacements']) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0);
 assert.deepEqual(await save({...createEmptyState(),owner_id:A},0),{revision:1});
 await user(A);
 assert.deepEqual(await load(),{revision:1,state});
 assert.deepEqual(await save(createEmptyState(),1),{revision:2});
 assert.deepEqual(await load(),{revision:2,state:createEmptyState()});
 await user('');
 await assert.rejects(load(),/authentication_required/);
 await assert.rejects(save(state,0),/authentication_required/);
 await db.exec('reset role; set role anon');
 await assert.rejects(load(),/permission denied/);
 await assert.rejects(save(state,0),/permission denied/);
 await assert.rejects(db.exec('select * from public.sessions'),/permission denied/);
});
