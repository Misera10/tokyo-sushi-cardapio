begin;

do $audit$
declare
  v_admin uuid;
  v_product_id bigint := -2026092701;
  v_complement_id bigint := -2026092701;
  v_promo_id bigint;
  v_expense_id uuid := gen_random_uuid();
  v_revenue_id uuid := gen_random_uuid();
  v_order jsonb;
  v_order_id bigint;
  v_cash jsonb;
  v_cash_id bigint;
  v_count integer;
begin
  select user_id into v_admin from public.tks_admins limit 1;
  if v_admin is null then
    raise exception 'CRUD_AUDIT: nenhum administrador cadastrado';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if not public.tks_is_admin() then
    raise exception 'CRUD_AUDIT: contexto autenticado não reconheceu o administrador';
  end if;

  insert into public.tks_settings(key, value) values ('crud_audit_setting_20260927', '{"step":1}'::jsonb);
  update public.tks_settings set value = '{"step":2}'::jsonb where key = 'crud_audit_setting_20260927';
  if (select value->>'step' from public.tks_settings where key = 'crud_audit_setting_20260927') <> '2' then
    raise exception 'CRUD_AUDIT: settings create/update falhou';
  end if;
  delete from public.tks_settings where key = 'crud_audit_setting_20260927';
  if exists(select 1 from public.tks_settings where key = 'crud_audit_setting_20260927') then
    raise exception 'CRUD_AUDIT: settings delete falhou';
  end if;

  insert into public.tks_settings(key, value) values
    ('customer_profiles', '{"crud-audit":{"name":"CRUD Audit","phone":"5599999999999","notes":"teste"}}'::jsonb)
  on conflict (key) do update set value = excluded.value;
  insert into public.tks_settings(key, value) values
    ('hidden_customers', '["crud-audit"]'::jsonb)
  on conflict (key) do update set value = excluded.value;
  if not (select value ? 'crud-audit' from public.tks_settings where key = 'customer_profiles') then
    raise exception 'CRUD_AUDIT: customer_profiles falhou';
  end if;
  if not (select value @> '["crud-audit"]'::jsonb from public.tks_settings where key = 'hidden_customers') then
    raise exception 'CRUD_AUDIT: hidden_customers falhou';
  end if;

  insert into public.tks_products(id, cat, name, description, price, active, sort_order)
  values (v_product_id, 'CRUD Audit', 'Produto CRUD Audit', 'temporário', 12.34, true, 9999);
  update public.tks_products set name = 'Produto CRUD Audit Atualizado', price = 13.45 where id = v_product_id;
  if not exists(select 1 from public.tks_products where id = v_product_id and name = 'Produto CRUD Audit Atualizado' and price = 13.45) then
    raise exception 'CRUD_AUDIT: products create/update falhou';
  end if;

  insert into public.tks_complements(id, name, min_qty, max_qty, active, linked_product_ids, items)
  values (v_complement_id, 'Complemento CRUD Audit', 0, 2, true, jsonb_build_array(v_product_id::text), '[]'::jsonb);
  update public.tks_complements set max_qty = 3 where id = v_complement_id;
  if not exists(select 1 from public.tks_complements where id = v_complement_id and max_qty = 3) then
    raise exception 'CRUD_AUDIT: complements create/update falhou';
  end if;

  insert into public.tks_promos(title, text, code, discount_type, discount_value, active)
  values ('CRUD Audit', 'temporário', 'CRUD-AUDIT-20260927', 'fixed', 1.00, true)
  returning id into v_promo_id;
  update public.tks_promos set discount_value = 2.00 where id = v_promo_id;
  if not exists(select 1 from public.tks_promos where id = v_promo_id and discount_value = 2.00) then
    raise exception 'CRUD_AUDIT: promos create/update falhou';
  end if;
  delete from public.tks_promos where id = v_promo_id;
  if exists(select 1 from public.tks_promos where id = v_promo_id) then
    raise exception 'CRUD_AUDIT: promos delete falhou';
  end if;

  insert into public.tks_expenses(id, expense_date, description, category, supplier, amount, source)
  values (v_expense_id, current_date, 'CRUD Audit', 'Teste', 'Tokyo', 10.00, 'crud-audit');
  update public.tks_expenses set amount = 11.00 where id = v_expense_id;
  if not exists(select 1 from public.tks_expenses where id = v_expense_id and amount = 11.00) then
    raise exception 'CRUD_AUDIT: expenses create/update falhou';
  end if;
  delete from public.tks_expenses where id = v_expense_id;
  if exists(select 1 from public.tks_expenses where id = v_expense_id) then
    raise exception 'CRUD_AUDIT: expenses delete falhou';
  end if;

  insert into public.tks_finance_daily_revenues(id, revenue_date, revenue, orders, source, notes)
  values (v_revenue_id, date '2099-09-27', 99.90, 2, 'crud-audit', 'temporário');
  update public.tks_finance_daily_revenues set revenue = 100.00, orders = 3 where id = v_revenue_id;
  if not exists(select 1 from public.tks_finance_daily_revenues where id = v_revenue_id and revenue = 100.00 and orders = 3) then
    raise exception 'CRUD_AUDIT: daily revenues create/update falhou';
  end if;
  delete from public.tks_finance_daily_revenues where id = v_revenue_id;

  v_order := public.tks_create_order(jsonb_build_object(
    'customer_name', 'CRUD Audit',
    'customer_phone', '5599999999999',
    'payment', 'Pix',
    'payment_status', 'paid',
    'notes', 'crud-audit-20260927',
    'order_source', 'pdv',
    'client_request_id', 'crud-audit-order-20260927',
    'items', jsonb_build_array(jsonb_build_object('id', v_product_id, 'qty', 1, 'options', '[]'::jsonb)),
    'pricing', '{}'::jsonb
  ));
  v_order_id := (v_order->>'id')::bigint;
  if v_order_id is null or not exists(select 1 from public.tks_orders where id = v_order_id and payment_status = 'paid' and order_source = 'pdv') then
    raise exception 'CRUD_AUDIT: order create/payment status falhou';
  end if;

  perform public.tks_update_order(v_order_id, jsonb_build_object(
    'customer_name', 'CRUD Audit Atualizado',
    'customer_phone', '5599999999999',
    'payment', 'Pix',
    'payment_status', 'paid',
    'notes', 'crud-audit-update',
    'order_source', 'pdv',
    'items', jsonb_build_array(jsonb_build_object('id', v_product_id, 'qty', 2, 'options', '[]'::jsonb)),
    'pricing', '{}'::jsonb
  ));
  if not exists(select 1 from public.tks_orders where id = v_order_id and customer_name = 'CRUD Audit Atualizado' and total = 26.90) then
    raise exception 'CRUD_AUDIT: order update/recalculation falhou';
  end if;

  update public.tks_orders set status = 'Aceito' where id = v_order_id;
  update public.tks_orders set payment_status = 'pending' where id = v_order_id;
  update public.tks_orders set archived_at = now() where id = v_order_id;
  if not exists(select 1 from public.tks_orders where id = v_order_id and status = 'Aceito' and payment_status = 'pending' and archived_at is not null) then
    raise exception 'CRUD_AUDIT: order status/payment/archive falhou';
  end if;

  update public.tks_cash_sessions set status = 'closed' where status = 'open';
  v_cash := public.tks_open_cash_session(20.00);
  v_cash_id := (v_cash->>'id')::bigint;
  perform public.tks_record_cash_movement(v_cash_id, 'entrada', 5.00, 'CRUD Audit');
  perform public.tks_record_cash_movement(v_cash_id, 'saida', 2.00, 'CRUD Audit');
  select count(*) into v_count from public.tks_cash_movements where session_id = v_cash_id;
  if v_count <> 2 then
    raise exception 'CRUD_AUDIT: cash movements falhou';
  end if;
  v_cash := public.tks_close_cash_session(v_cash_id, 23.00);
  if coalesce((v_cash->>'open')::boolean, true) then
    raise exception 'CRUD_AUDIT: cash close falhou';
  end if;

  perform public.tks_save_operation_settings(
    '{"crudAudit":true}'::jsonb,
    '"5599999999999"'::jsonb,
    '"crud-audit-pix"'::jsonb,
    '"CRUD Audit"'::jsonb,
    '{"enabled":false,"weekly":[]}'::jsonb
  );
  if (select value->>'crudAudit' from public.tks_settings where key = 'operation_settings') <> 'true' then
    raise exception 'CRUD_AUDIT: operation settings RPC falhou';
  end if;

  delete from public.tks_complements where id = v_complement_id;
  delete from public.tks_products where id = v_product_id;
  if exists(select 1 from public.tks_complements where id = v_complement_id)
     or exists(select 1 from public.tks_products where id = v_product_id) then
    raise exception 'CRUD_AUDIT: product/complement delete falhou';
  end if;

  raise notice 'CRUD_AUDIT_OK';
end
$audit$;

rollback;
