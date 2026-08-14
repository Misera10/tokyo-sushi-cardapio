-- Public cardapio needs only the weekly schedule, never internal operation settings.
drop policy if exists "public tks store schedule read" on public.tks_settings;
create policy "public tks store schedule read" on public.tks_settings
  for select to anon, authenticated using (key = 'store_schedule');

insert into public.tks_settings (key, value)
values ('store_schedule', '{"enabled":false,"weekly":[]}'::jsonb)
on conflict (key) do nothing;

create or replace function public.tks_store_is_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  schedule jsonb;
  today jsonb;
  previous jsonb;
  weekday integer := extract(dow from (now() at time zone 'America/Sao_Paulo'))::integer;
  current_time_value time := (now() at time zone 'America/Sao_Paulo')::time;
  opening time;
  closing time;
begin
  select value into schedule from public.tks_settings where key = 'store_schedule';
  if coalesce((schedule->>'enabled')::boolean, false) is not true then
    return coalesce((select value->>'mode' from public.tks_settings where key = 'store_status'), 'open') = 'open';
  end if;
  select value into today
  from jsonb_array_elements(coalesce(schedule->'weekly', '[]'::jsonb)) item(value)
  where (value->>'day')::integer = weekday
  limit 1;
  select value into previous
  from jsonb_array_elements(coalesce(schedule->'weekly', '[]'::jsonb)) item(value)
  where (value->>'day')::integer = ((weekday + 6) % 7)
  limit 1;
  if today is not null and coalesce((today->>'enabled')::boolean, false) is true then
    opening := nullif(today->>'open', '')::time;
    closing := nullif(today->>'close', '')::time;
    if opening is not null and closing is not null and opening <> closing then
      if opening < closing then
        return current_time_value >= opening and current_time_value < closing;
      end if;
      if current_time_value >= opening then
        return true;
      end if;
    end if;
  end if;
  if previous is not null and coalesce((previous->>'enabled')::boolean, false) is true then
    opening := nullif(previous->>'open', '')::time;
    closing := nullif(previous->>'close', '')::time;
    if opening is not null and closing is not null and opening > closing and current_time_value < closing then
      return true;
    end if;
  end if;
  return false;
exception when others then
  return false;
end;
$$;

revoke all on function public.tks_store_is_open() from public;
grant execute on function public.tks_store_is_open() to anon, authenticated;

-- Keep the existing pricing and validation body, changing only the public gate
-- so the RPC enforces the same schedule used by the two frontends.
do $$
declare
  definition text;
  old_clause text := 'if not is_admin and coalesce((select value->>''mode'' from public.tks_settings where key = ''store_status''), ''open'') <> ''open'' then';
  new_clause text := 'if not is_admin and not public.tks_store_is_open() then';
begin
  select pg_get_functiondef('public.tks_create_order(jsonb)'::regprocedure) into definition;
  if position(old_clause in definition) = 0 then
    raise exception 'Não foi possível atualizar a proteção de horário do tks_create_order.';
  end if;
  execute replace(definition, old_clause, new_clause);
end;
$$;
