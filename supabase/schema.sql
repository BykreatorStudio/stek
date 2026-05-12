-- Family Finances App — Database Schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type currency as enum ('RSD', 'EUR');
create type transaction_type as enum ('prihod', 'rashod');
create type recurring_type as enum ('fiksni', 'varijabilni');
create type debt_direction as enum ('dugujemo', 'duguju_nam');
create type debt_status as enum ('aktivno', 'izmireno');
create type cek_status as enum ('na_cekanju', 'isplacen', 'propusten');
create type month_status as enum ('otvoren', 'zatvoren');

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Buckets (seeded, not user-created)
create table buckets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

insert into buckets (name, slug) values
  ('Kuća', 'kuca'),
  ('Bykreator Studio', 'bykreator'),
  ('October Care', 'october-care');

-- Categories
create table categories (
  id uuid primary key default uuid_generate_v4(),
  bucket_id uuid not null references buckets(id) on delete cascade,
  name text not null,
  type transaction_type not null,
  currency_default currency not null default 'RSD',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Recurring items (fixed and variable)
create table recurring_items (
  id uuid primary key default uuid_generate_v4(),
  bucket_id uuid not null references buckets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  type recurring_type not null,
  amount numeric(12,2),
  currency currency not null default 'RSD',
  due_day integer not null check (due_day between 1 and 31),
  notify_7_days boolean not null default true,
  notify_3_days boolean not null default true,
  notify_on_day boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Transactions
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  bucket_id uuid not null references buckets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  recurring_item_id uuid references recurring_items(id) on delete set null,
  user_id uuid not null references auth.users(id),
  type transaction_type not null,
  amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  date date not null,
  month text not null,
  note text,
  created_at timestamptz default now()
);

create index idx_transactions_month on transactions(month);
create index idx_transactions_bucket on transactions(bucket_id);

-- Checks (Čekovi)
create table cekovi (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  quantity integer not null default 1 check (quantity > 0),
  status cek_status not null default 'na_cekanju',
  month text not null,
  note text,
  cleared_at timestamptz,
  created_at timestamptz default now()
);

create index idx_cekovi_month on cekovi(month);

-- Savings
create table savings (
  id uuid primary key default uuid_generate_v4(),
  amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  date date not null,
  note text,
  created_at timestamptz default now()
);

create table savings_goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  deadline date,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Debts (Dugovi)
create table dugovi (
  id uuid primary key default uuid_generate_v4(),
  direction debt_direction not null,
  name text not null,
  bucket_id uuid not null references buckets(id),
  total_amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  start_date date not null,
  note text,
  status debt_status not null default 'aktivno',
  created_at timestamptz default now()
);

create table debt_payments (
  id uuid primary key default uuid_generate_v4(),
  debt_id uuid not null references dugovi(id) on delete cascade,
  amount numeric(12,2) not null,
  currency currency not null default 'RSD',
  date date not null,
  note text,
  created_at timestamptz default now()
);

-- Push subscriptions
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NBS exchange rates
create table nbs_rates (
  id uuid primary key default uuid_generate_v4(),
  eur_to_rsd numeric(10,4) not null,
  date date not null unique,
  fetched_at timestamptz default now()
);

-- Months
create table months (
  id uuid primary key default uuid_generate_v4(),
  month text not null unique,
  status month_status not null default 'otvoren',
  carry_forward numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- RLS Policies (all authenticated users share all data)
alter table profiles enable row level security;
alter table categories enable row level security;
alter table recurring_items enable row level security;
alter table transactions enable row level security;
alter table cekovi enable row level security;
alter table savings enable row level security;
alter table savings_goals enable row level security;
alter table dugovi enable row level security;
alter table debt_payments enable row level security;
alter table push_subscriptions enable row level security;
alter table nbs_rates enable row level security;
alter table months enable row level security;

-- Buckets are public (seeded data)
alter table buckets enable row level security;
create policy "buckets_read" on buckets for select using (true);

-- All other tables: any authenticated user can do everything
create policy "auth_all" on profiles for all using (auth.uid() is not null);
create policy "auth_all" on categories for all using (auth.uid() is not null);
create policy "auth_all" on recurring_items for all using (auth.uid() is not null);
create policy "auth_all" on transactions for all using (auth.uid() is not null);
create policy "auth_all" on cekovi for all using (auth.uid() is not null);
create policy "auth_all" on savings for all using (auth.uid() is not null);
create policy "auth_all" on savings_goals for all using (auth.uid() is not null);
create policy "auth_all" on dugovi for all using (auth.uid() is not null);
create policy "auth_all" on debt_payments for all using (auth.uid() is not null);
create policy "auth_all" on push_subscriptions for all using (auth.uid() is not null);
create policy "auth_all" on nbs_rates for all using (auth.uid() is not null);
create policy "auth_all" on months for all using (auth.uid() is not null);

-- Function: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Korisnik'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
