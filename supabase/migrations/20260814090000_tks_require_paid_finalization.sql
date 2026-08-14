-- Impede a baixa de um pedido enquanto o pagamento estiver pendente.
create or replace function public.tks_guard_order_finalization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'Finalizado' and coalesce(new.payment_status, 'pending') <> 'paid' then
    raise exception using errcode = '22023', message = 'Marque o pedido como pago antes de dar baixa.';
  end if;
  return new;
end;
$$;

revoke all on function public.tks_guard_order_finalization() from public, anon, authenticated;
drop trigger if exists tks_orders_require_paid_finalization on public.tks_orders;
create trigger tks_orders_require_paid_finalization
before update of status on public.tks_orders
for each row execute function public.tks_guard_order_finalization();
