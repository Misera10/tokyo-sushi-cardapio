alter table public.tks_products add column if not exists archived_at timestamptz;
alter table public.tks_products add column if not exists active_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb;
alter table public.tks_products add column if not exists channels jsonb not null default '{"retirada":true,"delivery":false,"mesa":false}'::jsonb;
alter table public.tks_products add column if not exists badges jsonb not null default '{}'::jsonb;
alter table public.tks_products add column if not exists highlight boolean not null default false;
alter table public.tks_products add column if not exists secondary_images jsonb not null default '[]'::jsonb;
alter table public.tks_products add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.tks_products add column if not exists internal_code text not null default '';
alter table public.tks_products add column if not exists cost numeric(10,2) not null default 0;
alter table public.tks_products add column if not exists from_price numeric(10,2);
alter table public.tks_products add column if not exists strike_price numeric(10,2);
alter table public.tks_products add column if not exists stock_controlled boolean not null default false;
alter table public.tks_products add column if not exists stock_qty integer;

alter table public.tks_complements add column if not exists description text not null default '';
alter table public.tks_complements add column if not exists sort_order integer not null default 0;
alter table public.tks_complements add column if not exists active_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb;

drop policy if exists "public tks products read" on public.tks_products;
create policy "public tks products read" on public.tks_products
  for select to anon using (active = true);

drop policy if exists "public tks complements read" on public.tks_complements;
create policy "public tks complements read" on public.tks_complements
  for select to anon using (active = true);

drop policy if exists "public tks store status read" on public.tks_settings;
create policy "public tks store status read" on public.tks_settings
  for select to anon using (key = 'store_status');

drop policy if exists "public tks whatsapp contact read" on public.tks_settings;
create policy "public tks whatsapp contact read" on public.tks_settings
  for select to anon using (key = 'whatsapp_contact');

drop policy if exists "public tks store schedule read" on public.tks_settings;
create policy "public tks store schedule read" on public.tks_settings
  for select to anon using (key = 'store_schedule');

create index if not exists tks_cash_movements_created_by_idx on public.tks_cash_movements (created_by);
create index if not exists tks_cash_movements_session_id_idx on public.tks_cash_movements (session_id);
create index if not exists tks_cash_sessions_closed_by_idx on public.tks_cash_sessions (closed_by);
create index if not exists tks_cash_sessions_opened_by_idx on public.tks_cash_sessions (opened_by);
create index if not exists tks_expenses_created_by_idx on public.tks_expenses (created_by);
create index if not exists tks_finance_daily_revenues_created_by_idx on public.tks_finance_daily_revenues (created_by);
create index if not exists tks_finance_entries_created_by_idx on public.tks_finance_entries (created_by);
