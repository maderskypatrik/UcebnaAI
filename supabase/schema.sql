-- Učebna.ai database. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again: it only creates what is missing and replaces the functions.

-- Saved tests and worksheets (the teacher's Kabinet).
create table if not exists public.sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('test', 'worksheet')),
  title text not null,
  meta text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sheets_user_created on public.sheets (user_id, created_at desc);

alter table public.sheets enable row level security;

drop policy if exists "Teachers read their sheets" on public.sheets;
create policy "Teachers read their sheets" on public.sheets
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Teachers add their sheets" on public.sheets;
create policy "Teachers add their sheets" on public.sheets
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Teachers edit their sheets" on public.sheets;
create policy "Teachers edit their sheets" on public.sheets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Teachers delete their sheets" on public.sheets;
create policy "Teachers delete their sheets" on public.sheets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Generations per teacher per day (Prague time). Written only by the functions below.
create table if not exists public.usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.usage enable row level security;

drop policy if exists "Teachers read their usage" on public.usage;
create policy "Teachers read their usage" on public.usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- The daily limit. To change it, edit the number here and run this file again.
create or replace function public.daily_limit()
returns int language sql immutable set search_path = '' as $$ select 20 $$;

-- How many generations the signed-in teacher has left today.
create or replace function public.generations_left()
returns int language sql stable security definer set search_path = '' as $$
  select public.daily_limit() - coalesce(
    (select count from public.usage
      where user_id = auth.uid() and day = (now() at time zone 'Europe/Prague')::date),
    0)
$$;

-- Counts one successful generation for the signed-in teacher.
create or replace function public.consume_generation()
returns int language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'Europe/Prague')::date, 1)
  on conflict (user_id, day) do update set count = public.usage.count + 1;
  return public.generations_left();
end
$$;

revoke all on function public.generations_left() from public, anon;
revoke all on function public.consume_generation() from public, anon;
grant execute on function public.generations_left() to authenticated;
grant execute on function public.consume_generation() to authenticated;

-- Folders in the Kabinet (by class or subject) and links for sharing a test with colleagues.
alter table public.sheets add column if not exists folder text not null default '';
alter table public.sheets add column if not exists share_id uuid unique;

-- A shared test, for anyone who has its link. Only tests the teacher shared are reachable.
create or replace function public.shared_sheet(share uuid)
returns table (kind text, title text, meta text, data jsonb)
language sql stable security definer set search_path = '' as $$
  select s.kind, s.title, s.meta, s.data from public.sheets s where s.share_id = share
$$;

revoke all on function public.shared_sheet(uuid) from public;
grant execute on function public.shared_sheet(uuid) to anon, authenticated;

-- Every Claude call with its tokens, so the cost per test can be measured.
create table if not exists public.claude_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  created_at timestamptz not null default now()
);

-- Which kinds of calls are logged; extended when a feature adds a new one.
alter table public.claude_calls drop constraint if exists claude_calls_kind_check;
alter table public.claude_calls add constraint claude_calls_kind_check
  check (kind in ('generate', 'replace', 'svp', 'section'));

create index if not exists claude_calls_created on public.claude_calls (created_at desc);

alter table public.claude_calls enable row level security;

drop policy if exists "Teachers log their calls" on public.claude_calls;
create policy "Teachers log their calls" on public.claude_calls
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Teachers read their calls" on public.claude_calls;
create policy "Teachers read their calls" on public.claude_calls
  for select to authenticated using ((select auth.uid()) = user_id);

-- Thumbs up or down on single questions, to see where Claude's questions need to get better.
create table if not exists public.question_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  question_type text not null,
  item jsonb not null,
  sheet_title text not null default '',
  meta text not null default '',
  created_at timestamptz not null default now()
);

alter table public.question_feedback enable row level security;

drop policy if exists "Teachers rate questions" on public.question_feedback;
create policy "Teachers rate questions" on public.question_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Questions teachers disliked, newest first: paste on its own into the SQL Editor and Run.
--
-- select created_at, meta, question_type, item->>'prompt' as otazka, item->>'answer' as odpoved
-- from public.question_feedback where rating = -1 order by created_at desc limit 100;

-- Cost overview for you as the operator: paste this into the SQL Editor on its own and Run.
-- Prices in USD per million tokens for Claude Opus 5.5: input 4, output 20, cache read 0.20, cache write 5.
--
-- select (created_at at time zone 'Europe/Prague')::date as den,
--        kind as druh,
--        count(*) as volani,
--        count(distinct user_id) as ucitelu,
--        round(sum(input_tokens * 4 + output_tokens * 20 + cache_read_tokens * 0.2 + cache_write_tokens * 5) / 1e6, 2) as usd,
--        round(sum(input_tokens * 4 + output_tokens * 20 + cache_read_tokens * 0.2 + cache_write_tokens * 5) / 1e6 / count(*), 3) as usd_za_volani
-- from public.claude_calls
-- group by 1, 2
-- order by 1 desc, 2;

-- Feedback from beta testers ("Zpětná vazba" in the corner of every page).
-- Anyone may send it, signed in or not; only you read it, in the Table Editor or with the query below.
create table if not exists public.beta_feedback (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'praise')),
  message text not null check (char_length(message) between 1 and 4000),
  page text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

drop policy if exists "Anyone sends feedback" on public.beta_feedback;
create policy "Anyone sends feedback" on public.beta_feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Newest feedback with the sender's e-mail: paste on its own into the SQL Editor and Run.
--
-- select f.created_at, f.kind, u.email, f.page, f.message
-- from public.beta_feedback f left join auth.users u on u.id = f.user_id
-- order by f.created_at desc limit 100;
