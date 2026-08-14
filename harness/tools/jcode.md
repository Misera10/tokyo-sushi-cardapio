# Tool: Jcode

Repositorio: https://github.com/jcode-ai/jcode

## Quando Usar

- Sessao simultanea com varios agentes no mesmo repositorio.
- Swarm controlado para comparar abordagens.
- Memoria historica vetorial sem gastar contexto demais.

## Como Usar No Fluxo

1. Defina tarefas pequenas e independentes.
2. Use branch/worktree por agente quando houver escrita.
3. Consolide resultados em uma decisao final humana.
4. Nao misture edicoes concorrentes no mesmo arquivo sem coordenacao.

## Criterios

- Cada agente tem escopo claro.
- Conflitos sao revisados antes de merge.
- Resultado final passa por lint/build/test.

## Nao Usar Para

- Tarefa simples que um agente resolve em poucos minutos.
- Fazer varios agentes editarem o mesmo arquivo sem controle.
