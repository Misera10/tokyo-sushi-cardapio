# Workflow: Sistema Web

Use para CRMs, ERPs, dashboards, portais, areas do cliente e ferramentas internas.

## Passos

1. Modelar usuarios, permissoes, entidades e fluxos.
2. Definir regra de negocio antes da UI.
3. Definir banco, prefixos, RLS, roles e integracoes.
4. Criar tarefas por fatias verticais.
5. Implementar fluxo principal primeiro.
6. Criar estados: vazio, loading, erro, sucesso e permissao negada.
7. Validar seguranca chamando endpoints/actions fora da UI quando houver backend.

## Guardrails

- Nunca confiar em IDs vindos do browser.
- Nunca expor secrets no client.
- Nunca criar tabela sem prefixo definido em banco compartilhado.
- Nunca deixar botao fake sem indicar "em breve" ou desabilitado.
