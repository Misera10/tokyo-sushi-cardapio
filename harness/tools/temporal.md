# Tool: Temporal

Repositorio: https://github.com/temporalio/temporal

## Quando Usar

- Workflows duraveis com retry, estado, agendamento, filas ou tarefas longas.
- Automacoes que nao podem se perder com falha de rede/servidor.
- Cobranca, notificacoes, processamento em lote, sincronizacao e integracoes externas.

## Como Usar No Fluxo

1. Confirme na spec que existe workflow duravel real.
2. Modele eventos, retries, timeouts e idempotencia.
3. Documente arquitetura em LikeC4 ou design tecnico.
4. Teste falhas e retomada.

## Criterios

- Cada workflow tem estado claro.
- Operacoes externas sao idempotentes.
- Erros sao rastreaveis.
- Retry nao duplica cobranca, mensagem ou registro.

## Nao Usar Para

- Site institucional, landing page ou CRUD simples.
- Substituir cron simples quando Worker/cron basico resolve.
