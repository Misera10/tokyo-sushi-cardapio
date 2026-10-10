select
  coalesce((
    select jsonb_array_length(value)
    from public.tks_settings
    where key = 'menu_groups'
  ), 0) as menu_group_count,
  coalesce((
    select (value->>'enabled')::boolean
    from public.tks_settings
    where key = 'store_schedule'
  ), false) as schedule_enabled,
  coalesce((
    select count(*)
    from jsonb_array_elements(
      coalesce((select value->'weekly' from public.tks_settings where key = 'store_schedule'), '[]'::jsonb)
    ) day(value)
    where coalesce((day.value->>'enabled')::boolean, false)
  ), 0) as schedule_enabled_days,
  (
    select value->'weekly'
    from public.tks_settings
    where key = 'store_schedule'
  ) as weekly_schedule,
  (
    select value
    from public.tks_settings
    where key = 'store_status'
  ) as store_status,
  (
    select count(*)
    from public.tks_orders
    where coalesce(client_request_id, '') like 'crud-audit-%'
       or coalesce(notes, '') like 'crud-audit-%'
  ) as audit_orders,
  (
    select count(*)
    from public.tks_settings
    where key like 'crud_audit_%'
  ) as audit_settings,
  (
    select count(*)
    from public.tks_products
    where name like 'Produto CRUD Audit%'
  ) as audit_products,
  (
    select count(*)
    from public.tks_complements
    where name like 'Complemento CRUD Audit%'
  ) as audit_complements,
  (
    select count(*)
    from public.tks_expenses
    where source = 'crud-audit'
  ) as audit_expenses,
  (
    select count(*)
    from public.tks_finance_daily_revenues
    where source = 'crud-audit'
  ) as audit_revenues,
  (
    select count(*)
    from public.tks_cash_sessions
    where status = 'open'
  ) as open_cash_sessions;
