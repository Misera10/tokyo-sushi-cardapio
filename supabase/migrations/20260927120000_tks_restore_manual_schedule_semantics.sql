-- Restaura a semântica aprovada do controle manual de funcionamento.
-- Se o modo automático estiver desligado, a agenda semanal nunca altera o status manual.
-- Se o automático estiver ligado e não houver dias habilitados, a loja permanece fechada.

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
  has_any_enabled_day boolean := false;
  manual_override boolean := false;
  current_date_key text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
  weekday integer := extract(dow from (now() at time zone 'America/Sao_Paulo'))::integer;
  current_time_value time := (now() at time zone 'America/Sao_Paulo')::time;
  opening time;
  closing time;
begin
  select value into schedule from public.tks_settings where key = 'store_schedule';
  select value into status from public.tks_settings where key = 'store_status';

  -- Com o automático desligado, o status manual é a única fonte de verdade.
  if coalesce((schedule->>'enabled')::boolean, false) is not true then
    return lower(coalesce(status->>'mode', 'closed')) = 'open';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(schedule->'weekly', '[]'::jsonb)) item(value)
    where coalesce((value->>'enabled')::boolean, false) is true
  ) into has_any_enabled_day;

  -- Com o automático ligado, uma agenda sem dias ativos mantém a loja fechada.
  if not has_any_enabled_day then
    return false;
  end if;

  manual_override := case
    when status ? 'manualOverride' then coalesce((status->>'manualOverride')::boolean, false)
      and coalesce(status->>'manualOverrideDate', '') = current_date_key
    when status ? 'manual_override' then coalesce((status->>'manual_override')::boolean, false)
      and coalesce(status->>'manual_override_date', '') = current_date_key
    else false
  end;

  if manual_override then
    return lower(coalesce(status->>'mode', 'closed')) = 'open';
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

create or replace function public.tks_save_operation_settings(
  p_operation_settings jsonb,
  p_whatsapp_contact jsonb,
  p_pix_key jsonb,
  p_pix_beneficiary jsonb,
  p_store_schedule jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.tks_is_admin() then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  insert into public.tks_settings (key, value, updated_at)
  values
    ('operation_settings', coalesce(p_operation_settings, '{}'::jsonb), now()),
    ('whatsapp_contact', coalesce(p_whatsapp_contact, '""'::jsonb), now()),
    ('pix_key', coalesce(p_pix_key, '""'::jsonb), now()),
    ('pix_beneficiary', coalesce(p_pix_beneficiary, '""'::jsonb), now()),
    ('store_schedule', coalesce(p_store_schedule, '{"enabled":false,"weekly":[]}'::jsonb), now())
  on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.tks_save_operation_settings(jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.tks_save_operation_settings(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

