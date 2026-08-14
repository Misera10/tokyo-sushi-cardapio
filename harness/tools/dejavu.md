# Tool: Deja Vu

Repositorio: https://github.com/dejavu-memory/dejavu

## Quando Usar

- Agente ou projeto repetindo erro ja resolvido.
- Debug longo com tentativas anteriores.
- Recuperar aprendizados de Codex, Hermes, Zcode, MiniMax ou outros agentes.

## Como Usar No Fluxo

1. Consulte memoria antes de repetir investigacao cara.
2. Procure por erro, stack trace, arquivo, tecnologia ou decisao.
3. Se encontrar solucao antiga, valide contra o contexto atual.
4. Registre nova licao em `harness/memory/` e `specs/*/06-licoes-aprendidas.md`.

## Criterios

- Evita retrabalho real.
- Nao aplica solucao antiga sem checar versao e contexto.
- Mantem aprendizados curtos e acionaveis.

## Nao Usar Para

- Substituir leitura do codigo atual.
- Reaplicar patch antigo cegamente.
