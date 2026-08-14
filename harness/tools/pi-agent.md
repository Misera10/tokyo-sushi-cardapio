# Tool: PI Web / PI Agent Harness

Repositorios:

- https://github.com/pi-agent/pi-web
- https://github.com/pi-agent/pi-harness

## Quando Usar

- Explorar harness alternativo com isolamento.
- Navegar sessoes antigas e bifurcar contexto.
- Testar agentes em microVM/Docker sem tocar projeto real.

## Como Usar No Fluxo

1. Use como laboratorio, nao como executor principal sem teste.
2. Conecte apenas uma copia ou worktree do projeto.
3. Compare resultado com nosso harness antes de adotar.

## Criterios

- Isolamento funcionando.
- Historico e forks ajudam, nao confundem.
- Sem acesso amplo ao Windows ou dados sensiveis.

## Nao Usar Para

- Substituir Git, spec ou backup.
- Rodar com acesso total ao workspace principal sem necessidade.
