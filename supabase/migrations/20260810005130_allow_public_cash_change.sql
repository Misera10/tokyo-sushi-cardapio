-- Permite que o checkout público informe somente o valor recebido em dinheiro.
-- Descontos, acréscimos e cupons continuam sendo processados apenas no PDV autenticado.
do $$
declare
  definition text;
  old_clause text := 'pricing := case when is_admin then coalesce(p_order->''pricing'', ''{}''::jsonb) else ''{}''::jsonb end;';
  new_clause text := 'pricing := case when is_admin then coalesce(p_order->''pricing'', ''{}''::jsonb) else jsonb_build_object(''amount_received'', coalesce(p_order->''pricing''->>''amount_received'', '''')) end;';
begin
  select pg_get_functiondef('public.tks_create_order(jsonb)'::regprocedure) into definition;
  if position(old_clause in definition) = 0 then
    raise exception 'Trecho esperado da função tks_create_order não encontrado.';
  end if;
  execute replace(definition, old_clause, new_clause);
end;
$$;
