-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace text not null check (workspace in ('personal','work')),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  recurrence text not null check (recurrence in ('daily','weekly','monthly')),
  day_of_week int,   -- 0 = Sunday .. 6 = Saturday, used when recurrence = 'weekly'
  day_of_month int,  -- 1-31, used when recurrence = 'monthly'
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (task_id, date)
);

create table if not exists targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  unit text,
  target_value numeric not null default 100,
  current_value numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_completions enable row level security;
alter table targets enable row level security;

create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own completions" on task_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own targets" on targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
