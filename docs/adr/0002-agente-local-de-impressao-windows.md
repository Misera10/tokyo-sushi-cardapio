# ADR 0002 — Agente local próprio para impressão

## Status

Aceito para a primeira implementação.

## Contexto

O cardápio é web e o operador precisa imprimir comandas automaticamente em uma
impressora instalada no notebook. O navegador não pode imprimir silenciosamente
de forma confiável: ele abre o diálogo nativo e depende de permissão do usuário.

## Decisão

Criar um agente Windows próprio em .NET 8/WPF. O agente usa o spooler do Windows,
descobre as impressoras instaladas, mantém uma fila local recuperável e oferece
uma interface de operação com status, teste e reimpressão. O Admin se comunica
com o agente por loopback, usando a origem permitida do Tokyo Sushi; uma chave
local continua aceita apenas como compatibilidade de versões antigas.

## Consequências

- O operador instala o agente uma vez no notebook que possui a impressora.
- A solução funciona primeiro com impressoras reconhecidas pelo Windows, sem
  depender de um protocolo específico de fabricante.
- ESC/POS direto e impressão por rede podem ser adicionados depois como adapters
  reais, quando a impressora térmica e o modo de conexão forem confirmados.
- O Admin mantém fallback para a impressão nativa quando o agente estiver
  desligado ou não pareado.

## Fora desta fatia

- instalador assinado digitalmente;
- impressão direta ESC/POS;
- envio remoto de trabalhos com o agente totalmente desligado;
- multiusuário e múltiplas lojas.
