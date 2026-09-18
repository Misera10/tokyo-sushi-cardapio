-- Quando todos os dias da semana estiverem desmarcados (0 dias habilitados),
-- a loja e considerada estritamente FECHADA e nao aceita pedidos,
-- mesmo se a chave 'enabled' da agenda estiver como false ou se status.mode anterior for 'open'.
-- Abertura so ocorre se houver override manual explicito de abertura feito HOJE.

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

  -- 1. Verifica se existe pelo menos um dia habilitado na agenda semanal
  select exists (
    select 1
    from jsonb_array_elements(coalesce(schedule->'weekly', '[]'::jsonb)) item(value)
    where coalesce((value->>'enabled')::boolean, false) is true
  ) into has_any_enabled_day;

  -- 2. Se NENHUM dia da semana estiver habilitado (0 dias ativados):
  -- O cardapio so pode abrir se houver um override manual explicito de abertura feito HOJE.
  -- Em todos os outros casos, permanece FECHADO.
  if not has_any_enabled_day then
    return lower(coalesce(status->>'mode', 'closed')) = 'open'
      and coalesce((status->>'manualOverride')::boolean, (status->>'manual_override')::boolean, false) is true
      and coalesce(status->>'manualOverrideDate', status->>'manual_override_date', '') = current_date_key;
  end if;

  -- 3. Se a agenda automatica estiver desativada (schedule.enabled = false),
  -- mas existem dias na tabela: vale o controle manual (padrao fechado caso ausente).
  if coalesce((schedule->>'enabled')::boolean, false) is not true then
    return lower(coalesce(status->>'mode', 'closed')) = 'open';
  end if;

  -- 4. Agenda automatica ativada com dias configurados:
  -- O fechamento/abertura manual pelo admin sobrescreve a agenda no dia em que foi acionado.
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

  -- 5. Avaliacao da janela do dia atual e da virada da noite (dia anterior)
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
