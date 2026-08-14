# Check: Seguranca

Use antes de publicar, depois de mexer em backend, auth, banco, Server Actions, API routes, uploads, webhooks, pagamento, admin ou automacoes.

## Aplicacao

- [ ] `harness/workflows/seguranca-mantis.md` foi seguido quando a mudanca teve risco medio/alto.
- [ ] Input de usuario e validado no servidor.
- [ ] Server Actions tratadas como endpoints publicos.
- [ ] Rotas admin exigem permissao adequada.
- [ ] Tenant nunca vem confiavel do client.
- [ ] Queries filtram por tenant/owner quando aplicavel.
- [ ] RLS/policies revisadas quando houver Supabase/Postgres.
- [ ] `service_role` fica apenas no server.
- [ ] Secrets nao aparecem em client, repo, logs ou prints.
- [ ] Upload valida tipo, tamanho e destino.
- [ ] Webhooks validam assinatura/secret.
- [ ] Endpoint publico sensivel tem rate limit ou protecao equivalente.
- [ ] Erros nao vazam stack, token, query sensivel ou estrutura interna.
- [ ] Dependencias e configs criticas foram revisadas.

## Auditoria

- [ ] Achados duplicados foram consolidados.
- [ ] Achados passaram por review contra codigo real.
- [ ] Falsos positivos foram descartados ou marcados como pendencia.
- [ ] Severidade foi calibrada por impacto e explorabilidade.
- [ ] Patch foi validado com teste, build ou verificacao manual.
