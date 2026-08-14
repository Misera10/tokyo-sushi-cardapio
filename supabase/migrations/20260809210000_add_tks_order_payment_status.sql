-- Status financeiro separado do fluxo operacional do pedido.
alter table public.tks_orders
  add column if not exists payment_status text not null default 'pending';

do $$
begin
  alter table public.tks_orders
    add constraint tks_orders_payment_status_check
    check (payment_status in ('pending', 'paid'));
exception when duplicate_object then
  null;
end;
$$;

-- Mantém pedidos públicos como não pagos e permite que o PDV administrativo
-- registre o pagamento já na criação, sem expor esse controle ao cardápio.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'tks_create_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_order jsonb';

  if function_definition is null then
    raise exception 'Função public.tks_create_order(jsonb) não encontrada.';
  end if;

  function_definition := replace(
    function_definition,
    E'payment_value text;\n  notes_value text;',
    E'payment_value text;\n  payment_status_value text := ''pending'';\n  notes_value text;'
  );
  function_definition := replace(
    function_definition,
    E'payment_value := trim(coalesce(p_order->>''payment'', ''''));\n  notes_value := trim(coalesce(p_order->>''notes'', ''''));',
    E'payment_value := trim(coalesce(p_order->>''payment'', ''''));\n  payment_status_value := case when is_admin and lower(coalesce(p_order->>''payment_status'', ''pending'')) = ''paid'' then ''paid'' else ''pending'' end;\n  notes_value := trim(coalesce(p_order->>''notes'', ''''));'
  );
  function_definition := replace(
    function_definition,
    'status, customer_name, customer_phone, payment, notes, subtotal, discount_amount,',
    'status, customer_name, customer_phone, payment, payment_status, notes, subtotal, discount_amount,'
  );
  function_definition := replace(
    function_definition,
    '''Recebido'', customer_name_value, customer_phone_value, payment_value, notes_value,',
    '''Recebido'', customer_name_value, customer_phone_value, payment_value, payment_status_value, notes_value,'
  );

  execute function_definition;
end;
$$;
