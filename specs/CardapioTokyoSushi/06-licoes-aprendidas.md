# Licoes Aprendidas

## O que funcionou

- 

## O que deu problema

- A RPC retorna as chaves Push em colunas planas (`p256dh` e `auth`), enquanto a biblioteca `web-push` exige essas chaves agrupadas em `subscription.keys`. Sem o mapeamento explícito, o Worker localizava as inscrições, mas todas as entregas falhavam.

## Padroes para repetir

- Validar o contrato do retorno da RPC contra o formato esperado pela biblioteca de entrega antes de publicar integrações server-side.

## Padroes para evitar

- 
