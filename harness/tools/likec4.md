# Tool: LikeC4

Repositorio: https://github.com/likec4/likec4

## Quando Usar

- Projetos com backend, SaaS, multi-tenant, filas, workers, banco e integracoes.
- Documentar arquitetura que vai durar mais de uma sprint.
- Explicar limites entre frontend, backend, banco, auth, storage, terceiros e deploy.

## Como Usar No Fluxo

1. Modele containers, componentes e relacoes importantes.
2. Registre decisoes em `docs/adr/` quando forem relevantes.
3. Atualize o diagrama quando mudar rota, modulo, banco ou integracao.
4. Use o diagrama como apoio para Mantis, auditoria e onboarding de agente.

## Criterios

- Mostra fronteiras de confianca.
- Mostra origem e destino dos dados.
- Mostra dependencias externas.
- Ajuda a entender impacto de mudanca.

## Nao Usar Para

- Landing page simples sem backend.
- Diagrama bonito sem utilidade operacional.
