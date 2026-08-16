# User Stories

## História 1 — Fazer pedido para retirada

Como usuário, quero consultar o cardápio, escolher complementos e enviar meu pedido pelo WhatsApp.

### Critérios de Aceite

- Dado que acesso pelo celular, quando vejo a primeira tela, então entendo que o pedido é para retirada sem dar zoom.
- Dado que escolho um item com complemento obrigatório, quando tento adicioná-lo sem cumprir o mínimo, então o sistema impede a confirmação.
- Dado que informo nome e celular válidos, quando envio um carrinho com itens pelo celular, então o aplicativo do WhatsApp é acionado com o resumo e contexto do pedido; se não puder ser acionado, o link oficial web é usado como fallback.
- Dado que informo nome e celular válidos em um dispositivo, quando retorno ao cardápio, então esses dados são preenchidos automaticamente para agilizar o próximo pedido.
- Dado que o cardápio está pausado ou fechado, quando tento adicionar ou enviar, então a ação é bloqueada.

## História 2 — Operar pedidos com segurança

Como administrador autorizado, quero acessar o painel com minha conta para acompanhar e atualizar pedidos sem expor os dados operacionais ao público.

### Critérios de Aceite

- Dado que não estou autenticado, quando acesso `/admin.html`, então vejo apenas a tela de login.
- Dado que informo credenciais inválidas, quando tento entrar, então o painel permanece bloqueado.
- Dado que estou autenticado e registrado como administrador no Supabase, quando entro, então consigo carregar pedidos e módulos operacionais.
- Dado que sou apenas um usuário público, quando tento consultar ou alterar pedidos pela API do Supabase, então a policy nega a operação.

## História 3 — Operar retirada em uma única tela

Como operador único da Tokyo Sushi, quero receber, aceitar, preparar, comunicar pelo WhatsApp e dar baixa nos pedidos de retirada sem sair do fluxo principal.

### Critérios de Aceite

- Dado que trabalho somente com retirada, quando abro Pedidos ou PDV, então vejo três etapas visíveis: Recebidos, Aceitos e Prontos.
- Dado que existe um pedido em Recebidos, quando clico em Aceitar pedido, então ele passa para Aceitos sem exigir outra tela.
- Dado que um pedido está em Aceitos, quando clico em Marcar pronto, então ele passa para Prontos e fica disponível para aviso ao cliente.
- Dado que entreguei um pedido pronto no balcão, quando clico em Dar baixa, então ele sai do fluxo ativo e permanece no histórico como finalizado.
- Dado que um pedido pronto está como Não pago, quando tento dar baixa, então o sistema bloqueia a ação, informa que o pagamento precisa ser marcado como Pago e mantém o pedido em Prontos.
- Dado que preciso consultar pedidos encerrados, quando clico no resumo de Saíram ou Cancelados, então filtro o histórico sem perder o fluxo principal.
- Dado que o pagamento pode acontecer antes ou na retirada, quando crio um pedido no PDV, então registro a forma e o status `Pago` ou `Não pago` sem sair do formulário.
- Dado que o pagamento muda depois da criação, quando alterno `Pago` ou `Não pago` no próprio card, então o status é salvo sem abrir outra tela.
- Dado que preciso retirar um pedido da operação, quando clico em Cancelar, então ele sai das vendas válidas, permanece no histórico como cancelado e pode ser encontrado pelo filtro de cancelados do Financeiro.
- Dado que chegam vários pedidos, então as ações ficam compactas e não ocupam mais espaço visual que os dados essenciais do pedido.
- Dado que compartilho ou consulto o painel em público, quando aciono o olho do resumo, então os valores das métricas ficam mascarados e os nomes dos indicadores continuam visíveis.

## História 8 — Consolidar compras e resultado financeiro

Como operador único da Tokyo Sushi, quero registrar compras e consultar o resultado junto com as vendas para tomar decisões no dia, mês e ano.

### Critérios de Aceite

- Dado que existem despesas e receitas no Gestão Tóquio, quando a migração é executada, então todos os registros são preservados no Financeiro deste projeto com origem identificável e sem duplicação.
- Dado que estou no Financeiro, quando cadastro uma compra, então consigo informar data, descrição, categoria, fornecedor, valor e observação e o lançamento aparece no resultado do período.
- Dado que seleciono um período, então vejo receita, despesas e lucro operacional, excluindo pedidos cancelados por padrão.
- Dado que um dia possui pedidos válidos no cardápio, então o relatório usa a receita desses pedidos; se não possui, então pode usar a receita histórica importada para manter o histórico do Gestão Tóquio.
- Dado que uma despesa importada foi corrigida, quando edito ou excluo o lançamento, então o resultado do Financeiro é atualizado sem alterar o banco de origem.

### Edição operacional de pedidos

- Dado que um pedido ativo recebeu uma informação incompleta, quando abro Editar pedido, então consigo adicionar/remover itens, alterar quantidades, adicionais, observações, nome e celular sem criar um novo número de pedido.
- Dado que salvo uma edição, então o servidor recalcula os produtos, adicionais, subtotal e total, preserva o status e registra a alteração no mesmo pedido; pedidos finalizados ou cancelados não podem ser editados.
- Dado que preciso corrigir o valor de um pedido ativo, quando informo desconto em reais ou percentual no editor, então o total é recalculado sem apagar o cupom já aplicado; acréscimos seguem a mesma regra e o troco é atualizado quando necessário.

## História 4 — Montar pedidos recorrentes no PDV

Como operador único, quero reencontrar clientes pelo nome ou celular e selecionar adicionais cadastrados no PDV para lançar pedidos sem redigitação e sem erro de preço.

### Critérios de Aceite

- Dado que um cliente já fez um pedido ou foi salvo no cadastro, quando começo a digitar seu nome ou celular no PDV, então vejo sugestões reutilizáveis.
- Dado que seleciono uma sugestão de cliente, então o nome e o celular são preenchidos automaticamente e podem ser ajustados antes de criar o pedido.
- Dado que crio um pedido no PDV, então o nome e o celular ficam disponíveis para a próxima busca, sem exigir cadastro manual separado.
- Dado que escolho no PDV um produto com adicionais vinculados, então vejo os grupos e itens ativos desse produto antes de adicioná-lo ao pedido.
- Dado que lanço no PDV uma peça avulsa que não é bebida nem combo, então posso escolher Cream Cheese ou Flambado como adicional operacional padrão mesmo quando o adicional não estiver vinculado ao item no cardápio público.
- Dado que lanço vários itens no PDV, quando abro a lista rápida de produtos, então cada linha mostra nome, preço, quantidade e ação de adicionar sem exigir um seletor separado.
- Dado que um grupo de adicionais exige quantidade mínima ou máxima, quando tento adicionar o item fora da regra, então o PDV impede a inclusão e informa o que falta.
- Dado que adiciono um adicional com preço, então o subtotal e o total do pedido refletem a quantidade e o preço validados no banco.
- Dado que ajusto o pedido no PDV, quando escolho desconto ou acréscimo em reais ou porcentagem, então o resumo mostra o subtotal, o ajuste e o total final.
- Dado que o pagamento é em dinheiro, quando informo um valor recebido suficiente, então o sistema mostra o troco; se for insuficiente, impede a criação do pedido.
- Dado que existe um cupom ativo e válido, quando informo seu código no PDV, então o desconto aparece no resumo e é recalculado no banco.
- Dado que um cupom está inválido, expirado ou inativo, quando tento aplicá-lo, então o pedido permanece sem o desconto e o motivo é informado.

## História 9 — Controlar horário de retirada

Como operador único da Tokyo Sushi, quero configurar os dias e horários de funcionamento para que o cardápio e o painel mostrem o status correto e parem de aceitar pedidos fora do horário.

### Critérios de Aceite

- Dado que acesso Configurações, quando abro Horário de funcionamento, então vejo domingo a sábado com habilitação e campos de abertura e fechamento.
- Dado que um dia está desabilitado, quando o modo automático está ativo naquele dia, então a loja aparece fechada para retirada e o cardápio não permite adicionar ou enviar pedido.
- Dado que o horário atual está dentro da janela configurada, quando consulto o painel ou o cardápio, então a loja aparece aberta para retirada.
- Dado que o horário atual está fora da janela configurada, quando consulto o painel ou o cardápio, então a loja aparece fechada para retirada e o fluxo público fica bloqueado.
- Dado que a agenda automática está ativa, quando clico em Fechar na operação, então o status manual sobrescreve a agenda imediatamente e o cardápio para de aceitar pedidos até o fim do dia local.
- Dado que existe uma sobreposição manual de Fechar, quando clico em Abrir, então a sobreposição é removida imediatamente; se eu não clicar, ela expira na virada do dia e a agenda automática volta a ser considerada.
- Dado que um turno atravessa a meia-noite, quando configuro fechamento menor que abertura, então o sistema considera a janela noturna corretamente.
- Dado que o modo automático está desligado, quando altero o status manual, então o comportamento atual permanece preservado.

## Direção de produto aprovada

O projeto será ampliado por fatias verticais, nesta ordem:

1. Segurança, integridade do pedido e atualização operacional.
2. PDV, KDS, impressão, retirada e delivery.
3. Caixa, pagamentos, financeiro e relatórios confiáveis.
4. Estoque, ficha técnica, compras e CMV.
5. CRM, fidelidade, cupons e campanhas.
6. Mesas, entregadores, pagamentos online, fiscal e integrações.

Cada fase deve manter o fluxo público funcionando e não pode apagar histórico operacional.
