-- Push real de novos pedidos para dispositivos autorizados.
-- A chave privada VAPID e o segredo do webhook ficam fora do banco público.

create extension if not exists pg_net with schema extensions;

create table if not exists public.tks_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.tks_push_config (
  id boolean primary key default true check (id),
  endpoint_url text not null default '',
  webhook_secret text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.tks_push_subscriptions enable row level security;
alter table public.tks_push_config enable row level security;

revoke all on public.tks_push_subscriptions from anon;
revoke all on public.tks_push_config from public, anon, authenticated;

drop policy if exists "tks push subscriptions admin own all" on public.tks_push_subscriptions;
drop policy if exists "tks push subscriptions own device" on public.tks_push_subscriptions;
create policy "tks push subscriptions own device" on public.tks_push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tks_push_subscriptions to authenticated;

-- O emissor conhece apenas este segredo rotacionável; não é necessário expor
-- service_role em um Worker. A tabela continua sem grants para o navegador.
create or replace function public.tks_get_push_subscriptions(p_secret text)
returns table(endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select subscription.endpoint, subscription.p256dh, subscription.auth
  from public.tks_push_subscriptions subscription
  join public.tks_push_config config on config.id = true
  where config.webhook_secret = p_secret;
$$;

create or replace function public.tks_remove_push_subscription(p_secret text, p_endpoint text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.tks_push_subscriptions subscription
  using public.tks_push_config config
  where config.id = true
    and config.webhook_secret = p_secret
    and subscription.endpoint = p_endpoint;
$$;

create or replace function public.tks_set_push_subscription_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tks_push_subscriptions_updated_at on public.tks_push_subscriptions;
create trigger tks_push_subscriptions_updated_at
before update on public.tks_push_subscriptions
for each row execute function public.tks_set_push_subscription_updated_at();

create or replace function public.tks_queue_new_order_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  push_config public.tks_push_config%rowtype;
begin
  select * into push_config
  from public.tks_push_config
  where id = true;

  if coalesce(push_config.endpoint_url, '') = '' or coalesce(push_config.webhook_secret, '') = '' then
    return new;
  end if;

  perform net.http_post(
    url := push_config.endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-TKS-Webhook-Secret', push_config.webhook_secret
    ),
    body := jsonb_build_object(
      'order', jsonb_build_object(
        'id', new.id,
        'customer_name', new.customer_name,
        'total', new.total,
        'created_at', new.created_at
      )
    )
  );
  return new;
exception when others then
  -- A falha de Push não pode impedir a criação do pedido.
  raise warning 'Falha ao enfileirar Push do pedido %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.tks_set_push_subscription_updated_at() from public, anon, authenticated;
revoke all on function public.tks_queue_new_order_push() from public, anon, authenticated;
revoke all on function public.tks_get_push_subscriptions(text) from public, authenticated;
revoke all on function public.tks_remove_push_subscription(text, text) from public, authenticated;
grant execute on function public.tks_get_push_subscriptions(text) to anon;
grant execute on function public.tks_remove_push_subscription(text, text) to anon;

drop trigger if exists tks_orders_push_after_insert on public.tks_orders;
create trigger tks_orders_push_after_insert
after insert on public.tks_orders
for each row execute function public.tks_queue_new_order_push();
