# Tool: ECC

Repositorio: https://github.com/affaan-m/ECC

## Quando Usar

- Padronizar agentes com papeis especializados, regras, hooks, memoria e workflows.
- Projetos longos com risco de retrabalho entre Codex, Hermes, Zcode, MiniMax, OpenCode ou outros agentes.
- Tarefas que precisam de loop: planejar, testar, implementar, revisar, verificar e registrar aprendizado.
- Times/frotas de agentes em que cada agente precisa seguir o mesmo sistema operacional de engenharia.

## Como Usar No Fluxo

1. Leia primeiro nosso `AGENTS.md`, `CONTEXT.md`, `specs/` e `harness/`.
2. Verifique se ECC nao esta duplicado no agente alvo.
3. Escolha um metodo de instalacao por agente.
4. Faca backup da pasta/config do agente antes de instalar.
5. Instale primeiro em um agente ou projeto de teste.
6. Compare com nosso Harness antes de tornar global.
7. Traga para `harness/memory/` apenas os padroes que realmente melhorarem entrega.

## Criterios

- Nao duplica skills, hooks, comandos ou regras.
- Preserva configuracoes existentes do agente.
- Ajuda a reduzir retrabalho, nao cria ruído.
- Mantem testes, review e verificacao como parte do fluxo.
- Tem rollback claro.

## Nao Usar Para

- Empilhar varios harnesses sem criterio.
- Trocar nossa base Spec-Driven sem teste.
- Instalar direto em todos os agentes de uma vez.
- Mexer em provider/modelo/API key.

## Observacao

O README oficial recomenda escolher um caminho de instalacao por harness/agente e evitar instalacoes duplicadas no mesmo agente. Para o Estudio Fernandes, ECC deve ser tratado como complemento/piloto, nao substituto automatico do nosso Harness.
