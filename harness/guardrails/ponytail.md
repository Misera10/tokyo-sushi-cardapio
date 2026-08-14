# Guardrails: Ponytail

Use Ponytail em modo full por padrao: a menor solucao correta vence.

## Escada Antes De Codar

1. Isso precisa existir nesta entrega?
2. Ja existe no projeto?
3. A biblioteca padrao resolve?
4. O browser, HTML, CSS, banco ou plataforma resolve nativamente?
5. Uma dependencia ja instalada resolve?
6. Da para resolver com menos codigo?
7. So entao escreva o minimo correto.

## Proibicoes

- Nao criar abstracao "para o futuro".
- Nao criar interface, factory, provider, service ou camada extra com uma implementacao/caller so.
- Nao instalar dependencia para algo que a plataforma, stdlib ou dependencia existente resolve.
- Nao criar componente generico se um componente especifico simples resolve melhor.
- Nao duplicar helper, tipo, hook ou componente que ja existe no projeto.

## Preferencias

- Reutilizar antes de criar.
- Deletar antes de adicionar.
- HTML/CSS nativo antes de JavaScript.
- Constraint de banco antes de regra duplicada na aplicacao, quando houver banco.
- Um check minimo para logica nao trivial.

## Nunca Simplificar Fora

- Seguranca.
- Validacao em fronteiras de confianca.
- Permissoes.
- RLS/multi-tenant.
- Protecao de dados sensiveis.
- Acessibilidade.
- Tratamento de erro que evita perda de dados.
- Checks minimos para logica nao trivial.

## Auditoria Ponytail

Antes de aprovar, pergunte:

- O que da para deletar?
- Que abstracao nasceu cedo demais?
- Que dependencia pode sair?
- Que componente pode ser especifico em vez de generico?
- Que logica pode usar recurso nativo, stdlib ou helper existente?
