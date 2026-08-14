# Tool: Agent Zero

Repositorio: https://github.com/agent0ai/agent-zero

## Quando Usar

- Trabalho pesado em ambiente isolado com Linux, desktop, navegador e terminal.
- Pesquisa longa, automacao visual, multiagentes e testes de ferramentas.
- Auditoria ou experimento que nao deve tocar direto no Windows/projeto principal.

## Como Usar No Fluxo

1. Rode em Docker.
2. Monte apenas a pasta necessaria, nao o disco inteiro.
3. Aplique `AGENTS.md`, `CONTEXT.md`, `specs/` e `harness/` no projeto.
4. Comece com leitura/auditoria antes de liberar escrita.
5. Use Git/worktree para recuperar alteracoes.

## Criterios

- Isolamento ativo.
- Sem acesso amplo a secrets.
- Acoes visiveis e revisaveis.
- Saida final validada por agente principal ou humano.

## Nao Usar Para

- Mexer direto em producao.
- Substituir Hermes/Codex em projeto real sem teste.
