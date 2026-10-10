drop policy if exists "public tks settings read" on public.tks_settings;

create policy "public tks settings read" on public.tks_settings
  for select to anon
  using (key in ('store_status', 'whatsapp_contact', 'store_schedule', 'menu_groups'));
