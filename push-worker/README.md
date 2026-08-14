# Tokyo Sushi Push

Worker server-side que recebe a fila de novos pedidos e envia Web Push para os dispositivos inscritos.

Secrets obrigatórios:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ex.: `mailto:fernandes.fabiano@gmail.com`)
- `TKS_WEBHOOK_SECRET`

A chave privada VAPID e o segredo do webhook nunca podem ir para o cliente, para o Git ou para o HTML. O Worker usa a chave pública do Supabase somente para chamar duas RPCs protegidas pelo segredo do webhook; `service_role` não é necessário.

Depois de publicar o Worker, aplique a migration `20260811090000_tks_push_notifications.sql` e configure, no SQL Editor do projeto Supabase, somente o endpoint e o segredo do Worker:

```sql
insert into public.tks_push_config (id, endpoint_url, webhook_secret)
values (true, 'https://tokyo-sushi-push.fernandes-fabiano.workers.dev', 'COLE_O_MESMO_TKS_WEBHOOK_SECRET_DO_WORKER')
on conflict (id) do update set endpoint_url = excluded.endpoint_url,
  webhook_secret = excluded.webhook_secret,
  updated_at = now();
```

O segredo deve ser colado apenas no SQL Editor e no secret `TKS_WEBHOOK_SECRET` do Worker. Não coloque esse valor em `config.js`, HTML, Git ou documentação pública.
