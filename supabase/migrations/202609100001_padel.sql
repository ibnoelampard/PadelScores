-- One private session per authenticated owner. All writes go through the RPC.
create table public.sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 status text not null check (status in ('empty','setup','players','schedule','finished')),
 player_count integer not null check (player_count between 0 and 200),
 court_count integer not null check (court_count between 0 and 50),
 duration_hours numeric not null check (duration_hours between 0 and 1000),
 slot_minutes integer not null check (slot_minutes = 10),
 revision bigint not null default 0 check (revision >= 0),
 updated_at timestamptz not null default now()
);
create table public.session_players (
 session_id uuid not null references public.sessions(id) on delete cascade,
 id text not null check (length(id) between 1 and 100),
 name text not null check (length(name) <= 200),
 removed boolean not null default false,
 -- Legacy mixer seed values, not cached leaderboard totals.
 matches integer not null default 0 check (matches >= 0),
 wins integer not null default 0 check (wins >= 0),
 byes integer not null default 0 check (byes >= 0),
 position integer not null,
 primary key(session_id,id)
);
create table public.courts (
 session_id uuid not null references public.sessions(id) on delete cascade,
 id text not null check (length(id) between 1 and 100),
 name text not null check (length(name) <= 200),
 removed boolean not null default false,
 position integer not null,
 primary key(session_id,id)
);
create table public.matches (
 session_id uuid not null references public.sessions(id) on delete cascade,
 id text not null check (length(id) between 1 and 100),
 court_id text not null,
 slot_index integer not null check (slot_index between 0 and 100000),
 start_minute integer not null check (start_minute between 0 and 1000000),
 score_a text not null check (score_a = '' or score_a ~ '^[0-9]{1,6}$'),
 score_b text not null check (score_b = '' or score_b ~ '^[0-9]{1,6}$'),
 started boolean not null, finished boolean not null,
 position integer not null,
 primary key(session_id,id),
 foreign key(session_id,court_id) references public.courts(session_id,id)
);
create table public.match_players (
 session_id uuid not null, match_id text not null, player_id text not null,
 team text not null check (team in ('A','B','bye')), position integer not null,
 primary key(session_id,match_id,team,position),
 unique(session_id,match_id,team,player_id),
 foreign key(session_id,match_id) references public.matches(session_id,id) on delete cascade,
 foreign key(session_id,player_id) references public.session_players(session_id,id)
);
create table public.match_replacements (
 session_id uuid not null, match_id text not null, position integer not null,
 out_player_id text not null, in_player_id text not null,
 changed_at text not null check (length(changed_at) between 1 and 100),
 primary key(session_id,match_id,position),
 foreign key(session_id,match_id) references public.matches(session_id,id) on delete cascade,
 foreign key(session_id,out_player_id) references public.session_players(session_id,id),
 foreign key(session_id,in_player_id) references public.session_players(session_id,id),
 check (out_player_id <> in_player_id)
);

alter table public.sessions enable row level security;
create policy owner_read on public.sessions for select to authenticated using (owner_id = (select auth.uid()));
do $$
declare tbl text;
begin
 foreach tbl in array array['session_players','courts','matches','match_players','match_replacements'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy owner_read on public.%I for select to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid())))',tbl);
 end loop;
end $$;
revoke all on public.sessions, public.session_players, public.courts, public.matches, public.match_players, public.match_replacements from public, anon, authenticated;
grant select on public.sessions, public.session_players, public.courts, public.matches, public.match_players, public.match_replacements to authenticated;

create function public.load_padel_session(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.sessions%rowtype; result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_user_id is distinct from auth.uid() then raise exception 'account_mismatch'; end if;
 select * into s from public.sessions where owner_id = auth.uid();
 if not found then return '{"revision":0,"state":{"session":{"status":"empty","playerCount":0,"courtCount":0,"durationHours":0,"slotMinutes":10},"players":[],"courts":[],"schedule":[]}}'::jsonb; end if;
 select jsonb_build_object(
  'session',jsonb_build_object('status',s.status,'playerCount',s.player_count,'courtCount',s.court_count,'durationHours',s.duration_hours,'slotMinutes',s.slot_minutes),
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'removed',p.removed,'matches',p.matches,'wins',p.wins,'byes',p.byes) order by p.position) from public.session_players p where p.session_id=s.id),'[]'::jsonb),
  'courts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'removed',c.removed) order by c.position) from public.courts c where c.session_id=s.id),'[]'::jsonb),
  'schedule',coalesce((select jsonb_agg(jsonb_build_object(
   'id',m.id,'courtId',m.court_id,'slotIndex',m.slot_index,'startMinute',m.start_minute,'scoreA',m.score_a,'scoreB',m.score_b,'started',m.started,'finished',m.finished,
   'teamA',coalesce((select jsonb_agg(mp.player_id order by mp.position) from public.match_players mp where mp.session_id=s.id and mp.match_id=m.id and mp.team='A'),'[]'::jsonb),
   'teamB',coalesce((select jsonb_agg(mp.player_id order by mp.position) from public.match_players mp where mp.session_id=s.id and mp.match_id=m.id and mp.team='B'),'[]'::jsonb),
   'bye',coalesce((select jsonb_agg(mp.player_id order by mp.position) from public.match_players mp where mp.session_id=s.id and mp.match_id=m.id and mp.team='bye'),'[]'::jsonb),
   'replacements',coalesce((select jsonb_agg(jsonb_build_object('outPlayerId',r.out_player_id,'inPlayerId',r.in_player_id,'changedAt',r.changed_at) order by r.position) from public.match_replacements r where r.session_id=s.id and r.match_id=m.id),'[]'::jsonb)
  ) order by m.position) from public.matches m where m.session_id=s.id),'[]'::jsonb)
 ) into result;
 return jsonb_build_object('revision',s.revision,'state',result);
end $$;

create function public.save_padel_session(p_state jsonb,p_expected_revision bigint,p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); sid uuid; rev bigint; sess jsonb; item jsonb; member jsonb; change jsonb;
 field text; team_name text; pos integer; member_pos integer; change_pos integer;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if p_user_id is distinct from uid then raise exception 'account_mismatch'; end if;
 if p_expected_revision is null or p_expected_revision < 0 then raise exception 'invalid_revision'; end if;
 if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 2000000 then raise exception 'invalid_state'; end if;
 sess := p_state->'session';
 if jsonb_typeof(sess) is distinct from 'object' then raise exception 'invalid_session'; end if;
 foreach field in array array['players','courts','schedule'] loop
  if jsonb_typeof(p_state->field) is distinct from 'array' then raise exception 'invalid_array: %',field; end if;
 end loop;
 if jsonb_array_length(p_state->'players')>200 or jsonb_array_length(p_state->'courts')>50 or jsonb_array_length(p_state->'schedule')>5000 then raise exception 'state_too_large'; end if;
 if jsonb_typeof(sess->'status') is distinct from 'string' then raise exception 'invalid_status'; end if;
 foreach field in array array['playerCount','courtCount','durationHours','slotMinutes'] loop
  if jsonb_typeof(sess->field) is distinct from 'number' then raise exception 'invalid_session_number'; end if;
 end loop;
 if (sess->>'playerCount') !~ '^[0-9]+$' or (sess->>'courtCount') !~ '^[0-9]+$' or (sess->>'slotMinutes') <> '10' then raise exception 'invalid_session_number'; end if;
 -- Serialize first creation too: a session row does not yet exist to lock.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select id,revision into sid,rev from public.sessions where owner_id=uid for update;
 if not found then
  if p_expected_revision <> 0 then raise exception 'revision_conflict'; end if;
  insert into public.sessions(owner_id,status,player_count,court_count,duration_hours,slot_minutes)
   values(uid,sess->>'status',(sess->>'playerCount')::integer,(sess->>'courtCount')::integer,(sess->>'durationHours')::numeric,10) returning id,revision into sid,rev;
 end if;
 if rev <> p_expected_revision then raise exception 'revision_conflict'; end if;
 update public.sessions set status=sess->>'status',player_count=(sess->>'playerCount')::integer,court_count=(sess->>'courtCount')::integer,duration_hours=(sess->>'durationHours')::numeric,revision=rev+1,updated_at=clock_timestamp() where id=sid;
 -- Deletes and inserts share the caller's transaction; any failure restores all old rows.
 delete from public.matches where session_id=sid;
 delete from public.session_players where session_id=sid;
 delete from public.courts where session_id=sid;
 pos := 0;
 for item in select value from jsonb_array_elements(p_state->'players') loop
  if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string' then raise exception 'invalid_player'; end if;
  if item ? 'removed' and jsonb_typeof(item->'removed') <> 'boolean' then raise exception 'invalid_removed'; end if;
  foreach field in array array['matches','wins','byes'] loop
   if item ? field and (jsonb_typeof(item->field) <> 'number' or (item->>field) !~ '^[0-9]+$') then raise exception 'invalid_player_seed'; end if;
  end loop;
  insert into public.session_players values(sid,item->>'id',item->>'name',coalesce((item->>'removed')::boolean,false),coalesce((item->>'matches')::integer,0),coalesce((item->>'wins')::integer,0),coalesce((item->>'byes')::integer,0),pos);
  pos := pos+1;
 end loop;
 pos := 0;
 for item in select value from jsonb_array_elements(p_state->'courts') loop
  if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string' then raise exception 'invalid_court'; end if;
  if item ? 'removed' and jsonb_typeof(item->'removed') <> 'boolean' then raise exception 'invalid_removed'; end if;
  insert into public.courts values(sid,item->>'id',item->>'name',coalesce((item->>'removed')::boolean,false),pos);
  pos := pos+1;
 end loop;
 pos := 0;
 for item in select value from jsonb_array_elements(p_state->'schedule') loop
  foreach field in array array['id','courtId','scoreA','scoreB'] loop
   if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'invalid_match_string'; end if;
  end loop;
  foreach field in array array['slotIndex','startMinute'] loop
   if jsonb_typeof(item->field) is distinct from 'number' or (item->>field) !~ '^[0-9]+$' then raise exception 'invalid_match_number'; end if;
  end loop;
  foreach field in array array['started','finished'] loop
   if jsonb_typeof(item->field) is distinct from 'boolean' then raise exception 'invalid_match_boolean'; end if;
  end loop;
  foreach field in array array['teamA','teamB','bye','replacements'] loop
   if jsonb_typeof(item->field) is distinct from 'array' then raise exception 'invalid_match_array'; end if;
  end loop;
  if jsonb_array_length(item->'teamA') <> 2 or jsonb_array_length(item->'teamB') <> 2 or jsonb_array_length(item->'replacements') > 1000 then raise exception 'invalid_team'; end if;
  if (select count(distinct value) from jsonb_array_elements((item->'teamA') || (item->'teamB'))) <> 4 then raise exception 'duplicate_team_player'; end if;
  insert into public.matches values(sid,item->>'id',item->>'courtId',(item->>'slotIndex')::integer,(item->>'startMinute')::integer,item->>'scoreA',item->>'scoreB',(item->>'started')::boolean,(item->>'finished')::boolean,pos);
  foreach field in array array['teamA','teamB','bye'] loop
   team_name := case field when 'teamA' then 'A' when 'teamB' then 'B' else 'bye' end;
   member_pos := 0;
   for member in select value from jsonb_array_elements(item->field) loop
    if jsonb_typeof(member) <> 'string' then raise exception 'invalid_player_reference'; end if;
    insert into public.match_players values(sid,item->>'id',member#>>'{}',team_name,member_pos);
    member_pos := member_pos+1;
   end loop;
  end loop;
  change_pos := 0;
  for change in select value from jsonb_array_elements(item->'replacements') loop
   foreach field in array array['outPlayerId','inPlayerId','changedAt'] loop
    if jsonb_typeof(change->field) is distinct from 'string' then raise exception 'invalid_replacement'; end if;
   end loop;
   perform (change->>'changedAt')::timestamptz;
   insert into public.match_replacements values(sid,item->>'id',change_pos,change->>'outPlayerId',change->>'inPlayerId',change->>'changedAt');
   change_pos := change_pos+1;
  end loop;
  pos := pos+1;
 end loop;
 return jsonb_build_object('revision',rev+1);
end $$;
revoke all on function public.load_padel_session(uuid) from public, anon;
revoke all on function public.save_padel_session(jsonb,bigint,uuid) from public, anon;
grant execute on function public.load_padel_session(uuid) to authenticated;
grant execute on function public.save_padel_session(jsonb,bigint,uuid) to authenticated;
-- Supabase has this publication; local PostgreSQL test environments may not.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sessions') then
  alter publication supabase_realtime add table public.sessions;
 end if;
end $$;
