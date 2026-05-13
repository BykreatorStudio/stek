-- Run this in Supabase SQL Editor
-- Missing tables that were not in original schema.sql

-- Credits (krediti)
create table if not exists credits (
  id uuid primary key default uuid_generate_v4(),
  bucket_id uuid not null references buckets(id) on delete cascade,
  name text not null,
  monthly_payment numeric(12,2) not null,
  due_day integer not null check (due_day between 1 and 31),
  original_amount numeric(12,2) not null,
  remaining_amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  note text,
  status text not null default 'aktivan' check (status in ('aktivan', 'zatvoren')),
  created_at timestamptz default now()
);

alter table credits enable row level security;
create policy "auth_all" on credits for all using (auth.uid() is not null);

-- Credit payments
create table if not exists credit_payments (
  id uuid primary key default uuid_generate_v4(),
  credit_id uuid not null references credits(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  note text,
  created_at timestamptz default now()
);

alter table credit_payments enable row level security;
create policy "auth_all" on credit_payments for all using (auth.uid() is not null);

-- Members (clanovi — separate from auth.users)
create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  avatar_url text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table members enable row level security;
create policy "auth_all" on members for all using (auth.uid() is not null);

-- Notifications
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  external_key text,
  is_read boolean not null default false,
  triggered_by_member_id uuid references members(id) on delete set null,
  created_at timestamptz default now()
);

alter table notifications enable row level security;
create policy "auth_all" on notifications for all using (auth.uid() is not null);

