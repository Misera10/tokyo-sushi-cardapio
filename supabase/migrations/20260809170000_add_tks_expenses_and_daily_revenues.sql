create table if not exists public.tks_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null,
  category text not null default 'Outros',
  supplier text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  notes text not null default '',
  source text not null default 'manual',
  source_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (source, source_record_id)
);

create table if not exists public.tks_finance_daily_revenues (
  id uuid primary key default gen_random_uuid(),
  revenue_date date not null,
  revenue numeric(12,2) not null default 0 check (revenue >= 0),
  orders integer not null default 0 check (orders >= 0),
  source text not null default 'manual',
  source_record_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (source, source_record_id),
  unique (revenue_date, source)
);

alter table public.tks_expenses enable row level security;
alter table public.tks_finance_daily_revenues enable row level security;

drop policy if exists "tks expenses admin all" on public.tks_expenses;
drop policy if exists "tks daily revenues admin all" on public.tks_finance_daily_revenues;

create policy "tks expenses admin all" on public.tks_expenses
  for all to authenticated
  using (public.tks_is_admin())
  with check (public.tks_is_admin());

create policy "tks daily revenues admin all" on public.tks_finance_daily_revenues
  for all to authenticated
  using (public.tks_is_admin())
  with check (public.tks_is_admin());

create index if not exists tks_expenses_date_idx on public.tks_expenses (expense_date desc);
create index if not exists tks_expenses_category_idx on public.tks_expenses (category);
create index if not exists tks_daily_revenues_date_idx on public.tks_finance_daily_revenues (revenue_date desc);

revoke all on public.tks_expenses, public.tks_finance_daily_revenues from anon;
grant select, insert, update, delete on public.tks_expenses, public.tks_finance_daily_revenues to authenticated;
