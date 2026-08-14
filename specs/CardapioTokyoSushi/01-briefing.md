# Briefing

## Objetivo

Evoluir o cardápio digital da Tokyo Sushi para um canal próprio de vendas e uma plataforma operacional do restaurante, reduzindo a dependência do InstaDelivery. A primeira entrega segura mantém retirada e WhatsApp; as próximas fases incluem delivery, PDV, cozinha, caixa, financeiro, estoque, CRM e relatórios.

## Público

- Cliente ideal: Tokyo Sushi; detalhes comerciais ainda precisam ser confirmados.
- Usuário: pessoa que consulta o cardápio localmente e quer fazer um pedido para retirada.
- Dor principal: depender de atendimento manual e de uma plataforma paga para consultar itens, montar pedidos, operar a cozinha e controlar o resultado financeiro.
- Objeções comuns: horário, disponibilidade dos itens, tempo de preparo e confirmação do pedido.
- Nível de consciência: usuário já interessado em pedir da Tokyo Sushi.

## Oferta

- Produto ou serviço: cardápio digital com carrinho, complementos e pedido via WhatsApp.
- Diferenciais reais: canal próprio sem comissão de marketplace, complementos configuráveis, dados sob controle da loja e evolução integrada do pedido até o caixa.
- Prova disponível: código existente no repositório; depoimentos, fotos comerciais e dados de atendimento ainda pendentes.
- Região ou nicho: Tokyo Sushi em Tuntum; endereço e dados comerciais devem ser confirmados antes da publicação oficial.

## Ação Principal

Enviar o pedido montado pelo usuário para o WhatsApp da Tokyo Sushi.

## Restrições

- Banco de dados: Supabase via REST; cardápio, pedidos, complementos, promoções, configurações e financeiro usam tabelas com prefixo `tks_`.
- Integrações: WhatsApp, Supabase Auth/REST/Realtime, impressão, pagamentos e futuras integrações de entrega e fiscal.
- Prazo: não informado.
- Conteúdo fornecido: cardápio e identidade visual já presentes no código.
- Conteúdo pendente: dados comerciais oficiais, credenciais do administrador, política de privacidade e confirmação do fluxo de retirada.

## Fora da primeira fase operacional

- Pagamento online.
- Financeiro completo, estoque, fiscal, marketplace e IA.
- Aplicativo nativo separado.
- Multiempresa/SaaS para terceiros.
- Publicação em produção antes da confirmação dos dados comerciais e da configuração do Supabase.

## Evolução financeira

- O Financeiro também incorpora compras/despesas e receitas históricas do aplicativo Gestão Tóquio.
- O histórico importado permanece no projeto antigo e recebe a origem `Gestão Tóquio` neste projeto.
- A receita de períodos com pedidos válidos do cardápio usa os pedidos reais; a receita histórica é usada como complemento quando não há pedido válido correspondente.

