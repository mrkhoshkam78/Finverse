-- Finverse Supabase schema (run in SQL Editor)
-- Enable UUID if needed
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Drop old policies if re-running
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Future: watchlist (ready, not required for auth)
create table if not exists public.watchlist (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id text not null,
  created_at timestamptz default now(),
  unique (user_id, asset_id)
);

alter table public.watchlist enable row level security;

drop policy if exists "watchlist_select_own" on public.watchlist;
drop policy if exists "watchlist_insert_own" on public.watchlist;
drop policy if exists "watchlist_delete_own" on public.watchlist;

create policy "watchlist_select_own"
  on public.watchlist for select using (auth.uid() = user_id);

create policy "watchlist_insert_own"
  on public.watchlist for insert with check (auth.uid() = user_id);

create policy "watchlist_delete_own"
  on public.watchlist for delete using (auth.uid() = user_id);
