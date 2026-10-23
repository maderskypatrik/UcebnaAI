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
