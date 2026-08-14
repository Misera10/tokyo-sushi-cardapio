# Tool: Strix

Repositorio: https://github.com/strix-security/strix

## Quando Usar

- Auditoria de seguranca com backend, auth, banco, API, upload, webhook ou painel admin.
- Validar vulnerabilidades em ambiente controlado.
- Complementar Mantis quando for necessario reproduzir falha exploravel.

## Como Usar No Fluxo

1. Antes, siga `harness/workflows/seguranca-mantis.md`.
2. Rode apenas em Docker/CI/sandbox.
3. Nunca rode contra producao sem autorizacao explicita.
4. Revise exploits e patches antes de aceitar.
5. Registre achados confirmados em relatorio.

## Criterios

- Ambiente isolado.
- Dados reais protegidos.
- Evidencia reproduzivel.
- Patch revisado manualmente.

## Nao Usar Para

- Landing page sem backend.
- Teste ofensivo em producao.
- Rodar payload gerado por IA direto na maquina principal.
