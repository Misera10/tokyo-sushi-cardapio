# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JavaScript with Supabase REST/Auth

## Users

- Administradores e operadores da Tokyo Sushi que trabalham no balcão, na cozinha e no caixa.
- Usuários públicos que consultam o cardápio pelo celular e fazem pedidos para retirada.

## Product Purpose

Ser o canal próprio de pedidos e a plataforma operacional da Tokyo Sushi, conectando cardápio, PDV, pedidos, KDS e caixa sem depender de uma plataforma paga.

## Positioning

Um fluxo próprio e integrado do pedido à retirada e à conferência do caixa, com dados operacionais sob controle da loja.

## Operating Context

- O painel é usado em desktop no balcão e em celular quando a equipe está em movimento.
- O operador precisa escanear pedidos, alterar status rapidamente e reconhecer o caixa aberto ou fechado sem abrir telas técnicas.
- A cozinha usa o KDS para preparar e concluir pedidos.

## Capabilities and Constraints

- Cardápio público, carrinho, adicionais, pedidos, PDV, Kanban, KDS, caixa, cardápio, complementos, clientes, relatórios, marketing e configurações.
- Login administrativo por e-mail e senha via Supabase Auth, com recuperação retornando ao Admin do Tokyo Sushi e autorização pela relação `tks_admins`.
- Dados próprios do projeto usam o prefixo `tks_` no Supabase.
- O projeto mantém HTML, CSS e JavaScript sem framework ou bundler.
- O design precisa ser moderno, profissional, premium, responsivo e funcional em toque e teclado.
- O visual deve preservar a identidade Tokyo Sushi e a clareza operacional; efeitos não podem atrasar ações.

## Brand Commitments

- Nome: Tokyo Sushi.
- Identidade já existente: logo Tokyo Sushi, referências visuais de restaurante japonês e paleta vinho/preto, dourado discreto, creme e verde operacional.
- O administrador pediu explicitamente que o painel deixe de parecer amador e ganhe acabamento premium.

## Evidence on Hand

- Cardápio e imagens reais em `menu-data.js` e `assets/`.
- Implementação existente em `admin.html`, `admin.css`, `admin.js`, `db.js` e `config.js`.
- Dados operacionais persistidos no projeto Supabase informado pelo cliente.
- Não inventar preços, dados comerciais, depoimentos ou integrações que não estejam confirmados.

## Product Principles

1. Operação rápida primeiro: estado e ação principal precisam ser reconhecidos em segundos.
2. Uma linguagem visual consistente entre pedidos, PDV, cozinha e caixa.
3. Densidade útil sem aparência de planilha crua.
4. Feedback visual claro para cada mudança de estado.
5. Mobile é um ambiente de operação real, não apenas uma versão reduzida do desktop.

## Accessibility & Inclusion

- Alvo mínimo WCAG 2.2 AA para contraste, foco, labels e navegação por teclado.
- Alvos de toque confortáveis, feedback que não dependa somente de cor e respeito a `prefers-reduced-motion`.
