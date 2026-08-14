# Check: Entrega Com Evidencias

Use antes de dizer que uma etapa esta pronta ou aprovada.

## Escopo

- [ ] Objetivo e criterios de aceite foram lidos na spec.
- [ ] O diff nao contem arquivo ou refatoracao fora do escopo.
- [ ] Regras, copy aprovada e decisoes do usuario foram preservadas.

## Evidencia tecnica

- [ ] Lint executado e resultado registrado.
- [ ] Typecheck executado quando existir.
- [ ] Testes executados quando existirem.
- [ ] Build executado quando existir.
- [ ] Rotas ou comandos principais testados.

## Evidencia visual

- [ ] Desktop validado quando houver interface.
- [ ] Mobile 375px validado quando houver interface.
- [ ] Estados loading, vazio, erro, sucesso e permissao negada revisados.
- [ ] Sem overflow, texto cortado ou sobreposicao incoerente.
- [ ] Console e overlay de desenvolvimento investigados; nenhum erro e chamado
      de artefato sem evidencia.

## Evidencia de seguranca

- [ ] Server Actions e endpoints validam input no servidor.
- [ ] Auth e permissao foram testadas fora da UI quando aplicavel.
- [ ] Tenant/business_id e ownership foram verificados.
- [ ] RLS, policies e grants foram revisados quando houver banco.
- [ ] Secrets nao aparecem em codigo client, logs, relatorio ou screenshot.

## Relatorio final

- [ ] Separar `feito`, `validado`, `parcial`, `pendente` e `nao testado`.
- [ ] Todo resultado positivo tem comando, evidencia ou captura correspondente.
- [ ] Riscos restantes estao claros.
- [ ] Proximo passo recomendado esta definido.
