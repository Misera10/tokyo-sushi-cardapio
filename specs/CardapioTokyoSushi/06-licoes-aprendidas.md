# Licoes Aprendidas

## O que funcionou

- 

## O que deu problema

- A RPC retorna as chaves Push em colunas planas (`p256dh` e `auth`), enquanto a biblioteca `web-push` exige essas chaves agrupadas em `subscription.keys`. Sem o mapeamento explícito, o Worker localizava as inscrições, mas todas as entregas falhavam.
- O cálculo de horário tratava `mode = "closed"` como fechamento manual mesmo quando `manualOverride = false`. A regra precisa distinguir o estado calculado pela agenda do fechamento manual explícito.
- O fechamento manual precisava de uma data local; sem `manualOverrideDate`, ele podia atravessar dias e impedir a abertura automática seguinte.

## Padroes para repetir

- Validar o contrato do retorno da RPC contra o formato esperado pela biblioteca de entrega antes de publicar integrações server-side.
- Testar horários com datas fixas em UTC convertidas para `America/Sao_Paulo`, incluindo o instante exato de abertura, o instante exato de fechamento e o fechamento manual.
- Persistir a data do override manual e validar sua expiração na virada do dia antes de publicar a agenda.

## Padroes para evitar

- 
