# Nome Do Projeto

Contexto comercial e de produto deste projeto. Este glossario define a linguagem usada em specs, copy, tarefas, revisoes e implementacao.

## Language

**Cliente**:
Pessoa ou empresa que contrata o projeto.
_Avoid_: usuario final quando o contexto for comercial

**Usuario**:
Pessoa que usa o site, sistema, landing page ou ferramenta entregue.
_Avoid_: cliente quando cliente e usuario forem pessoas diferentes

**Lead**:
Pessoa ou empresa que demonstra interesse e pode virar conversa comercial.
_Avoid_: visitante qualificado, prospect frio

**Oferta**:
Promessa comercial principal apresentada ao usuario.
_Avoid_: servico quando o contexto for a mensagem de venda

**CTA**:
Chamada clara para o proximo passo comercial ou funcional.
_Avoid_: botao generico, link solto

**Conversao**:
Acao principal que o projeto precisa gerar, como WhatsApp, formulario, compra, cadastro ou agendamento.
_Avoid_: clique quando o clique nao for a acao de valor

**Prova visual**:
Elemento que ajuda a transmitir confianca, como fotos reais, mockups, resultados, cards, depoimentos ou exemplos.
_Avoid_: enfeite, decoracao

**Pedido**:
Solicitação feita pelo usuário ou operador com itens, complementos, dados de contato, modalidade, pagamento e histórico de status.
_Avoid_: compra concluída quando a loja ainda não confirmou o recebimento

**Status de pagamento**:
Registro operacional separado do status do pedido que indica se o valor está `Não pago` ou `Pago`, sempre exibido junto da forma de pagamento.
_Avoid_: confundir pagamento com aceite, preparo, cancelamento ou baixa

**Retirada**:
Entrega do pedido ao usuário no balcão da Tokyo Sushi.
_Avoid_: delivery quando o cliente escolheu retirada

**Aceite**:
Momento em que o operador assume o pedido recebido e inicia sua preparação.
_Avoid_: preparo como nome da etapa visível do operador

**Baixa**:
Registro de que o pedido pronto foi entregue ao usuário no balcão.
_Avoid_: exclusão do pedido ou cancelamento

**Fluxo de retirada**:
Sequência operacional Recebidos, Aceitos e Prontos, com a baixa registrada depois da entrega.
_Avoid_: quadro com etapas de delivery quando a loja trabalha somente com retirada

**Entrega**:
Modalidade em que a Tokyo Sushi envia o pedido ao endereço do usuário, com área e taxa configuráveis.
_Avoid_: retirada quando houver endereço e entregador

**PDV**:
Frente de caixa para registrar pedidos do balcão, telefone, delivery, retirada ou mesa.
_Avoid_: cardápio público quando o pedido é lançado pela equipe

**Memória do cliente**:
Cadastro reutilizável de nome, celular e observações para localizar rapidamente quem já pediu e preencher o PDV.
_Avoid_: obrigar o operador a redigitar dados conhecidos a cada pedido

**Adicional**:
Item opcional ou obrigatório vinculado a um produto, com quantidade e preço próprios, escolhido durante a montagem do pedido.
_Avoid_: observação livre quando o item precisa ser validado e somado ao total

**Ajuste de preço**:
Desconto ou acréscimo aplicado pelo operador no PDV, em valor fixo ou porcentagem, com subtotal, total e motivo visíveis.
_Avoid_: alterar o preço do produto no cardápio para resolver uma exceção de atendimento

**Troco**:
Valor devolvido ao cliente quando o pagamento em dinheiro excede o total final do pedido.
_Avoid_: registrar valor recebido como se fosse o total da venda

**Cupom**:
Código promocional cadastrado no Marketing, com desconto, validade e status próprios, validado antes de entrar no total do PDV.
_Avoid_: texto promocional sem regra de preço

**KDS**:
Tela operacional da cozinha para receber, priorizar e concluir itens de pedidos.
_Avoid_: relatório histórico de vendas

**Caixa**:
Sessão financeira aberta por um operador, com abertura, movimentos, recebimentos, conferência e fechamento.
_Avoid_: faturamento bruto sem conferência

**Administrador**:
Pessoa autorizada conforme seu papel a operar pedidos, cardápio, caixa, cozinha, clientes ou configurações.
_Avoid_: qualquer usuário autenticado

**Despesa**:
Compra ou gasto operacional lançado pela Tokyo Sushi, com data, categoria, valor e origem.
_Avoid_: conta a pagar quando o gasto já aconteceu e precisa entrar no resultado realizado

**Receita histórica**:
Faturamento diário importado de uma fonte anterior, usado para completar o histórico antes do início das vendas registradas neste cardápio.
_Avoid_: pedido quando não existe um pedido individual correspondente neste sistema

**Lucro operacional**:
Receita considerada no período menos as despesas realizadas no mesmo período.
_Avoid_: saldo de caixa quando não representa o resultado econômico do período

**Horário de funcionamento**:
Agenda semanal da loja, com cada dia habilitado ou desabilitado e horário de abertura e fechamento para retirada.
_Avoid_: status manual quando o modo automático está ativo

**Status manual do cardápio**:
Controle operacional com somente dois estados: `Aberto` e `Fechado`. Fechar interrompe novos pedidos; abrir libera a operação ou devolve o controle à agenda automática.
_Avoid_: pausa temporária como terceiro estado da loja

**Modo automático**:
Regra que calcula o status da loja a partir do horário de funcionamento e bloqueia pedidos fora da janela configurada.
_Avoid_: tratar a agenda como um terceiro estado da loja
