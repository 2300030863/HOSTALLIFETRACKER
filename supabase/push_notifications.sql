-- ============================================
-- Hostel Life Tracker — Push Notifications & Device Subscriptions
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- 1. Push Subscriptions Table (Web Push tokens for phones & browsers)
create table if not exists public.push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

-- Index for fast user subscription lookup
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- Enable Row Level Security
alter table public.push_subscriptions enable row level security;

-- RLS Policies: Each user can only read, insert, update, delete their own subscriptions
drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- 2. Notification Settings Table (Per-user toggle preferences)
create table if not exists public.notification_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  attendance_reminders boolean not null default true,
  expense_reminders boolean not null default true,
  money_given_reminders boolean not null default true,
  money_received_reminders boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.notification_settings enable row level security;

drop policy if exists "Users can view own notification settings" on public.notification_settings;
create policy "Users can view own notification settings"
  on public.notification_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification settings" on public.notification_settings;
create policy "Users can insert own notification settings"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification settings" on public.notification_settings;
create policy "Users can update own notification settings"
  on public.notification_settings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notification settings" on public.notification_settings;
create policy "Users can delete own notification settings"
  on public.notification_settings for delete
  using (auth.uid() = user_id);
