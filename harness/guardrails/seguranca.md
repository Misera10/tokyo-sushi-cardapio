# Guardrails: Seguranca

- Nao executar comando destrutivo sem autorizacao clara.
- Nao apagar ou reverter mudancas do usuario sem pedido explicito.
- Nao expor secrets, tokens, chaves ou dados sensiveis.
- Nao colocar `service_role` no client.
- Em backend, validar input no servidor.
- Em Next.js, tratar Server Actions como endpoints publicos.
- Em banco, revisar tenant, role, ownership, RLS e policies.
- Em deploy, conferir ambiente, dominio e variaveis antes de publicar.
- Em auditoria de seguranca, seguir o fluxo `harness/workflows/seguranca-mantis.md`.
- Nao rodar payload, reproducer ou patch autonomo direto na maquina principal.
- Nao executar testes ofensivos contra producao, rede interna, dados reais ou contas de cliente sem autorizacao explicita.
- Achado de IA nao e bug confirmado ate passar por revisao, critic/falso positivo e evidencia reproduzivel em ambiente seguro.
