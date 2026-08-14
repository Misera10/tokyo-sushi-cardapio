-- Explicita a ordem do search_path nas funções privilegiadas que não usam extensões.
-- Isso reduz o risco de resolução acidental de objetos temporários em SECURITY DEFINER.
alter function public.tks_is_admin() set search_path = public, pg_temp;
alter function public.tks_create_order(jsonb) set search_path = public, pg_temp;
alter function public.tks_open_cash_session(numeric) set search_path = public, pg_temp;
alter function public.tks_record_cash_movement(bigint, text, numeric, text) set search_path = public, pg_temp;
alter function public.tks_close_cash_session(bigint, numeric) set search_path = public, pg_temp;
