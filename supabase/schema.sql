-- ============================================
-- Hostel Life Tracker — Supabase Database Setup
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

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

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
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

create policy "Users can CRUD own people"
  on public.people for all
  using (auth.uid() = user_id);

-- ============================================
-- 4. TRANSACTIONS TABLE
-- ============================================
create type transaction_type as enum ('expense', 'given', 'received', 'settlement');
create type payment_method as enum ('cash', 'upi', 'bank', 'card', 'other');
create type transaction_status as enum ('pending', 'settled', 'completed');

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

create policy "Users can CRUD own transactions"
  on public.transactions for all
  using (auth.uid() = user_id);

-- ============================================
-- 5. ACTIVITIES TABLE
-- ============================================
create type activity_status as enum ('pending', 'in_progress', 'completed');

create table if not exists public.activities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  category text not null default 'other',
  activity_date date not null default current_date,
  start_time time,
  end_time time,
  status activity_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.activities enable row level security;

create policy "Users can CRUD own activities"
  on public.activities for all
  using (auth.uid() = user_id);

-- ============================================
-- 6. REMINDERS TABLE
-- ============================================
create type repeat_type as enum ('once', 'daily', 'weekly', 'monthly', 'custom');
create type priority_level as enum ('low', 'medium', 'high');

create table if not exists public.reminders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  reminder_date date not null,
  reminder_time time not null,
  repeat_type repeat_type not null default 'once',
  priority priority_level not null default 'medium',
  completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reminders enable row level security;

create policy "Users can CRUD own reminders"
  on public.reminders for all
  using (auth.uid() = user_id);

-- ============================================
-- 7. ATTENDANCE TABLE
-- ============================================
create type attendance_status as enum ('present', 'absent', 'late');
create type attendance_source as enum ('manual', 'biometric');

create table if not exists public.attendance (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  attendance_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status attendance_status not null default 'present',
  source attendance_source not null default 'manual',
  created_at timestamptz default now(),
  unique(user_id, attendance_date)
);

alter table public.attendance enable row level security;

-- Attendance Window Rules (9:00 PM to 10:30 PM Server Time Enforcement)
create or replace function public.enforce_attendance_window()
returns trigger as $$
declare
  current_time_var time := current_time;
begin
  if (new.status = 'present' or new.status = 'late') then
    if current_time_var < time '21:00:00' then
      raise exception 'Attendance Closed: Window opens at 9:00 PM';
    elsif current_time_var >= time '22:30:00' then
      new.status := 'absent';
      raise exception 'Attendance Closed: Today''s attendance window closed at 10:30 PM. Automatically marked ABSENT.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger check_attendance_window_trigger
  before insert or update on public.attendance
  for each row execute procedure public.enforce_attendance_window();

-- Automatic 10:30 PM Expiry function
create or replace function public.auto_mark_absent_expired()
returns void as $$
begin
  insert into public.attendance (user_id, attendance_date, status, source)
  select u.id, current_date, 'absent'::attendance_status, 'manual'::attendance_source
  from auth.users u
  where not exists (
    select 1 from public.attendance a 
    where a.user_id = u.id and a.attendance_date = current_date
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- 8. HABITS TABLE
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

create policy "Users can CRUD own habits"
  on public.habits for all
  using (auth.uid() = user_id);

-- ============================================
-- 9. HABIT LOGS TABLE
-- ============================================
create table if not exists public.habit_logs (
  id uuid default uuid_generate_v4() primary key,
  habit_id uuid references public.habits on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null default current_date,
  completed boolean not null default false,
  created_at timestamptz default now(),
  unique(habit_id, log_date)
);

alter table public.habit_logs enable row level security;

create policy "Users can CRUD own habit logs"
  on public.habit_logs for all
  using (auth.uid() = user_id);

-- ============================================
-- 10. GOALS TABLE
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

create policy "Users can CRUD own goals"
  on public.goals for all
  using (auth.uid() = user_id);

-- ============================================
-- 11. NOTES TABLE
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

create policy "Users can CRUD own notes"
  on public.notes for all
  using (auth.uid() = user_id);

-- ============================================
-- 12. IMPORTANT ITEMS TABLE
-- ============================================
create table if not exists public.important_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text not null default 'Other',
  location text,
  description text,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.important_items enable row level security;

create policy "Users can CRUD own important items"
  on public.important_items for all
  using (auth.uid() = user_id);

-- ============================================
-- 13. UPDATED_AT TRIGGER (auto-update)
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.people
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.transactions
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.activities
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.reminders
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.habits
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.goals
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.notes
  for each row execute procedure public.update_updated_at();

create trigger set_updated_at before update on public.important_items
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 14. PUSH SUBSCRIPTIONS & NOTIFICATION SETTINGS
-- ============================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can CRUD own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attendance_reminders boolean default true,
  expense_reminders boolean default true,
  money_given_reminders boolean default true,
  money_received_reminders boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notification_settings enable row level security;

create policy "Users can CRUD own notification settings"
  on public.notification_settings for all
  using (auth.uid() = user_id);

create trigger set_updated_at before update on public.notification_settings
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 15. BACKGROUND PUSH CRON SCHEDULER (Website Closed)
-- ============================================
-- Enables pg_cron and pg_net extensions for sending push notifications when website is closed
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- Scheduled cron job that runs every minute to dispatch push notifications for matching reminders
select cron.schedule(
  'process-minute-reminders-job',
  '* * * * *',
  $$
    select net.http_post(
      url:='https://pcwovisjyhbxbevywzci.supabase.co/functions/v1/send-push',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:=jsonb_build_object(
        'check_time', to_char(now() at time zone 'Asia/Kolkata', 'HH24:MI'),
        'check_date', to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')
      )
    );
  $$
);

-- ============================================
-- DONE! All tables created with RLS enabled.
-- ============================================
