-- Public cardápio needs only the configured business WhatsApp number.
drop policy if exists "public tks whatsapp contact read" on public.tks_settings;
create policy "public tks whatsapp contact read" on public.tks_settings
  for select to anon, authenticated using (key = 'whatsapp_contact');
