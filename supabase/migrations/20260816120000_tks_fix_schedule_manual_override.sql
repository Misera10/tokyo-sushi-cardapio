-- A agenda automatica deve abrir/fechar pela janela salva.
-- Apenas um fechamento manual explicito (manualOverride=true) sobrescreve a agenda.
create or replace function public.tks_store_is_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  schedule jsonb;
  status jsonb;
  today jsonb;
  previous jsonb;
  manual_override boolean;
  current_date_key text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
  weekday integer := extract(dow from (now() at time zone 'America/Sao_Paulo'))::integer;
  current_time_value time := (now() at time zone 'America/Sao_Paulo')::time;
  opening time;
  closing time;
begin
  select value into schedule from public.tks_settings where key = 'store_schedule';
  select value into status from public.tks_settings where key = 'store_status';

  manual_override := case
    when status ? 'manualOverride' then coalesce((status->>'manualOverride')::boolean, false)
      and (coalesce((schedule->>'enabled')::boolean, false) is not true or status->>'manualOverrideDate' = current_date_key)
    when status ? 'manual_override' then coalesce((status->>'manual_override')::boolean, false)
      and (coalesce((schedule->>'enabled')::boolean, false) is not true or status->>'manual_override_date' = current_date_key)
    else lower(coalesce(status->>'mode', 'open')) in ('paused', 'closed')
      and coalesce((schedule->>'enabled')::boolean, false) is not true
  end;

  if manual_override then
    return lower(coalesce(status->>'mode', 'open')) = 'open';
  end if;

  if coalesce((schedule->>'enabled')::boolean, false) is not true then
    return lower(coalesce(status->>'mode', 'open')) = 'open';
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
