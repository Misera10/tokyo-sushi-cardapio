# Tool: Code Review Graph

Repositorio: https://github.com/code-review-graph/code-review-graph

## Quando Usar

- Projeto grande em que ler tudo custa contexto demais.
- Revisao de impacto antes de alterar modulo compartilhado.
- Auditoria de funcoes, classes, chamadas e dependencias.

## Como Usar No Fluxo

1. Primeiro tente `codebase-memory-mcp`, se estiver indexado.
2. Use Code Review Graph como complemento quando precisar de grafo local por Tree-Sitter/SQLite.
3. Leia a zona de impacto antes de editar.
4. Valide chamadas inbound/outbound do arquivo alterado.

## Criterios

- O agente consegue nomear a zona de impacto.
- Mudancas em modulo compartilhado consideram callers e callees.
- Evita leitura desnecessaria de arquivos fora do caminho afetado.

## Nao Usar Para

- Buscar texto simples, copy, config ou env; use `rg`.
- Substituir entendimento da spec.
