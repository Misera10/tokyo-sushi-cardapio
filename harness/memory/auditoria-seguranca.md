# Memoria: Auditoria de Seguranca

## Padrao Oficial

Auditorias de seguranca do Estudio Fernandes devem seguir pipeline estilo Mantis:

1. Mapeamento.
2. Arquitetura.
3. Threat model.
4. Pesquisa.
5. Deduplicate.
6. Review.
7. Critic.
8. Calibrate.
9. Report.
10. Patch.

## Regras Aprendidas

- Achado sem evidencia no codigo nao entra como vulnerabilidade confirmada.
- Falha teorica que o fluxo real bloqueia deve ser marcada como falso positivo ou hardening.
- Patch em auth, permissao, banco, RLS ou dados sensiveis exige revisao mais lenta.
- Reproducer e payload gerado por IA devem rodar apenas em ambiente isolado.
- Para MVPs do Estudio Fernandes, os riscos mais comuns sao Server Actions sem validacao, RLS incompleta, tenant vindo do client, webhooks sem assinatura e segredo exposto no client.
