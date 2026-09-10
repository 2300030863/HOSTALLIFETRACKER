-- ============================================
-- Hostel Life Tracker — Supabase Database Setup
-- Safe & Idempotent SQL Script (Can be re-run anytime)
-- ============================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  email text not null default '',
  phone text,
  hostel_name text,
  room_number text,
  college_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 3. PEOPLE TABLE
-- ============================================
create table if not exists public.people (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.people enable row level security;

drop policy if exists "Users can CRUD own people" on public.people;
create policy "Users can CRUD own people" on public.people for all using (auth.uid() = user_id);

-- ============================================
-- 4. TRANSACTIONS TABLE
-- ============================================
do $$ begin
  create type transaction_type as enum ('expense', 'given', 'received', 'settlement');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('cash', 'upi', 'bank', 'card', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type transaction_status as enum ('pending', 'settled', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  person_id uuid references public.people on delete set null,
  person_name text,
  type transaction_type not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Other',
  description text,
  transaction_date date not null default current_date,
  expected_return_date date,
  purpose text,
  payment_method payment_method not null default 'cash',
  status transaction_status not null default 'completed',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.transactions enable row level security;

drop policy if exists "Users can CRUD own transactions" on public.transactions;
create policy "Users can CRUD own transactions" on public.transactions for all using (auth.uid() = user_id);

-- ============================================
-- 5. REMINDERS TABLE
-- ============================================
do $$ begin
  create type repeat_type as enum ('once', 'daily', 'weekly', 'monthly');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type priority_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.reminders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  reminder_date date not null default current_date,
  reminder_time time not null default '09:00',
  repeat_type repeat_type not null default 'once',
  priority priority_level not null default 'medium',
  completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reminders enable row level security;

drop policy if exists "Users can CRUD own reminders" on public.reminders;
create policy "Users can CRUD own reminders" on public.reminders for all using (auth.uid() = user_id);

-- ============================================
-- 6. ATTENDANCE TABLE
-- ============================================
do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type attendance_source as enum ('manual', 'biometric');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.attendance (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  attendance_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status attendance_status not null default 'absent',
  source attendance_source not null default 'manual',
  reason text,
  created_at timestamptz default now(),
  constraint attendance_user_date_key unique (user_id, attendance_date)
);

alter table public.attendance enable row level security;

drop policy if exists "Users can CRUD own attendance" on public.attendance;
create policy "Users can CRUD own attendance" on public.attendance for all using (auth.uid() = user_id);

-- ============================================
-- 7. ACTIVITIES TABLE
-- ============================================
do $$ begin
  create type activity_category as enum ('mess', 'study', 'gym', 'outing', 'laundry', 'cleaning', 'personal', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type activity_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.activities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  category activity_category not null default 'personal',
  activity_date date not null default current_date,
  start_time time,
  end_time time,
  status activity_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.activities enable row level security;

drop policy if exists "Users can CRUD own activities" on public.activities;
create policy "Users can CRUD own activities" on public.activities for all using (auth.uid() = user_id);

-- ============================================
-- 8. GOALS TABLE
-- ============================================
create table if not exists public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  target numeric(12,2) not null default 100,
  current_value numeric(12,2) not null default 0,
  deadline date,
  priority priority_level not null default 'medium',
  completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;

drop policy if exists "Users can CRUD own goals" on public.goals;
create policy "Users can CRUD own goals" on public.goals for all using (auth.uid() = user_id);

-- ============================================
-- 9. HABITS & HABIT LOGS TABLE
-- ============================================
create table if not exists public.habits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  frequency text not null default 'daily',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.habits enable row level security;

drop policy if exists "Users can CRUD own habits" on public.habits;
create policy "Users can CRUD own habits" on public.habits for all using (auth.uid() = user_id);

create table if not exists public.habit_logs (
  id uuid default uuid_generate_v4() primary key,
  habit_id uuid references public.habits on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null default current_date,
  completed boolean not null default true,
  created_at timestamptz default now(),
  constraint habit_logs_user_habit_date_key unique (habit_id, log_date)
);

alter table public.habit_logs enable row level security;

drop policy if exists "Users can CRUD own habit_logs" on public.habit_logs;
create policy "Users can CRUD own habit_logs" on public.habit_logs for all using (auth.uid() = user_id);

-- ============================================
-- 10. NOTES TABLE
-- ============================================
create table if not exists public.notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  content text not null default '',
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notes enable row level security;

drop policy if exists "Users can CRUD own notes" on public.notes;
create policy "Users can CRUD own notes" on public.notes for all using (auth.uid() = user_id);
