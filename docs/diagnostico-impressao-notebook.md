# Diagnóstico da impressão automática no notebook

## Resultado

Em 14/08/2026, o notebook confirmou que os pedidos chegavam ao Admin e que a impressora
`POS-80` estava online e definida como padrão. A falha era operacional: o Tokyo Print não
estava disponível na porta local `127.0.0.1:4242` e havia registro anterior de conflito de
listener, compatível com duas instâncias concorrentes.

A versão 0.4.1 corrige esse cenário com instância única via mutex, `AppMutex` no instalador,
fechamento controlado durante atualização e inicialização explícita da janela. O Admin e o
Supabase não foram alterados.

## Evidências

- Health da versão 0.4.1 respondeu HTTP 200 quando o agente estava ativo.
- A fila local registrou quatro trabalhos concluídos na `POS-80`.
- O spooler do Windows informou a impressora padrão online.
- `printOnNewOrder` continua sendo a pré-condição do Admin para impressão automática.
- O histórico local passou a mostrar somente as impressões do dia e limpar na virada.

## Operação

Antes de iniciar o atendimento, confirme:

```powershell
Get-Process TokyoSushi.PrintAgent -ErrorAction SilentlyContinue
Invoke-WebRequest http://127.0.0.1:4242/health -UseBasicParsing
```

Se a porta estiver indisponível, abra o Tokyo Print e não execute uma segunda cópia do agente.
Não copie `settings.json`, `agent.log` ou chaves entre notebooks.
