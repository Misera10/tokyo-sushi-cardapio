# Design Técnico

## Stack

- Framework: HTML, CSS e JavaScript sem framework ou bundler.
- Estilo: CSS próprio, interface responsiva e PWA básica.
- Deploy: Vercel como hospedagem estática.
- Banco: Supabase REST com tabelas `tks_*`.
- Autenticação: Supabase Auth por e-mail/senha para o painel administrativo; o cliente público usa somente a chave publicável.
- Recuperação administrativa: o callback usa explicitamente `/admin.html` no mesmo domínio que iniciou o pedido, sem depender do Site URL global do projeto Supabase compartilhado.
- Integrações: WhatsApp para envio e aviso de pedidos; Supabase Auth e REST.

## Rotas

- `/`: cardápio público, busca, carrinho, complementos e envio do pedido.
- `/admin.html`: painel protegido para pedidos, PDV, cozinha, caixa, cardápio, complementos, clientes, financeiro e promoções.

## Dados

- `menu-data.js`: dados padrão do restaurante e fallback local.
- `localStorage`: cache do cardápio, carrinho e fallback operacional do navegador.
- Supabase: `tks_products`, `tks_orders`, `tks_promos`, `tks_complements`, `tks_settings`, `tks_cash_sessions`, `tks_cash_movements`, `tks_expenses`, `tks_finance_daily_revenues` e `tks_admins`. A antiga `tks_finance_entries`, se existir no projeto, permanece legada e não é usada pelo painel.
- Editor de cardápio: produtos mantêm grupo, ordem, disponibilidade por dia/canal, etiquetas, destaque, imagens secundárias, estoque e arquivamento; grupos auxiliares ficam em `tks_settings` com a chave `menu_groups` para preservar a compatibilidade do schema atual.
- `tks_admins`: relação explícita entre usuários do Supabase Auth e administradores autorizados.
- Público: pode ler apenas itens ativos, complementos ativos e o status público da loja; cria pedidos somente pela função transacional `tks_create_order(jsonb)`.
- Admin: pode operar os dados através de token do Supabase Auth e policies RLS.
- Pedidos: o servidor recalcula produtos, adicionais, quantidades e total; `client_request_id` evita duplicidade; `payment_status` (`pending`/`paid`) fica separado de `payment`; e pedidos finalizados usam arquivamento, não exclusão.
- Caixa: produção usa sessão relacional, movimentos de entrada/saída e fechamento com valor contado, saldo esperado e diferença; o JSON em `tks_settings` é somente fallback de migração.
- Financeiro: substitui a aba isolada de relatórios por uma visão de resultado com períodos rápidos, filtro de vendas do dia, opção explícita sem cancelados, status, pagamento, origem (cardápio/PDV), desconto e acréscimo, faturamento bruto/líquido, ticket médio, gráficos diários, mensais e anuais, formas de pagamento na visão geral, itens, complementos, margem quando houver custo, exportação e histórico de caixa. Compras e despesas realizadas usam `tks_expenses`, com controle diário, categoria, fornecedor, valor, observação e origem. O financeiro não exige abertura de caixa e considera retirada/PDV como os canais principais do negócio.
- Compras/despesas: `tks_expenses` registra gastos realizados com data, descrição, categoria, fornecedor, valor, observação e origem. `tks_finance_daily_revenues` preserva receitas diárias importadas, com quantidade de pedidos e origem. O resultado usa pedidos válidos quando houver receita individual no dia e recorre à receita histórica quando não houver pedido válido correspondente.
- Configurações operacionais: `operation_settings` em `tks_settings` guarda número de atendimento, templates de WhatsApp, largura/cópias da impressão, impressão automática, alertas de novos pedidos e o modo automático com a agenda semanal. O número separado em `whatsapp_contact` pode ser lido pelo cardápio público; mensagens e preferências internas continuam protegidas ao administrador. A agenda pública mínima fica em `store_schedule`, com `enabled` e `weekly` contendo apenas dia, habilitação, abertura e fechamento, e possui policy de leitura pública restrita à chave.
- Correção financeira: a venda pode ser excluída da operação por arquivamento reversível, com confirmação; ela sai dos pedidos e relatórios, mas permanece arquivada no banco para preservar auditoria e permitir recuperação futura.
- Operação: o PDV e a aba de pedidos usam o mesmo fluxo visível de retirada (`Recebidos`, `Aceitos`, `Prontos`). O status persistido `Preparando` é apresentado como `Aceito`; `Finalizado` continua como baixa/histórico. As ações rápidas são aceitar pedido, marcar pronto, dar baixa, cancelar e alternar pagamento, persistidas antes de confirmar a mudança na interface. A baixa é permitida somente quando `payment_status = paid`, com bloqueio no painel e trigger no banco; pedido não pago permanece em `Prontos` até a confirmação. Cancelar é a única ação destrutiva visível: grava `Cancelado`, tira a venda das válidas e mantém o registro disponível no filtro de cancelados do Financeiro. O arquivamento técnico continua reservado para limpeza administrativa, sem duplicar o botão no fluxo. As ações ficam compactas em linha para preservar a área do pedido. O caixa é opcional, não bloqueia pedidos e não exige valor de abertura; o resumo financeiro permanece disponível para consulta.
- Financeiro: pedidos válidos não cancelados continuam no filtro operacional, mas somente pedidos com pagamento `paid` entram no faturamento recebido, ticket médio, formas de pagamento, produtos, gráficos e lucro; pedidos pendentes aparecem separadamente como “A receber”.
- Privacidade do painel: as métricas superiores de vendas, pedidos, abertos e ticket médio possuem um controle local de ocultação; os rótulos permanecem visíveis, enquanto os números são mascarados no navegador até o operador revelar novamente.
- CRUD operacional: produtos, listas de adicionais, clientes/memória, cupons e promoções possuem criação, leitura, edição e remoção/ocultação compatíveis com o histórico. A aba de Clientes mantém somente o cadastro; o filtro por cliente e o consumo ficam no Financeiro. O pedido possui criação, leitura, atualização de status, cancelamento e arquivamento; enquanto está em montagem no PDV, suas linhas permitem adicionar, alterar quantidade, remover e limpar o carrinho.
- Especificações de edição segura e formulários:
  - **Financeiro**: Ao entrar em modo de edição de uma despesa, a interface rola suavemente até `#expenseForm`, foca na descrição e bloqueia a limpeza acidental de rascunhos passando `{ preserveExpenseDraft: false }` para `renderReports()`. O botão "Cancelar" desativa o modo de edição e restaura o formulário limpo.
  - **Promoções e Cupons**: A edição é indexada exclusivamente pelo ID único persistente da promoção (`dataset.editId = promo.id`), nunca por índice numérico posicional de array. O botão de submit alterna para "Atualizar promoção", o botão "Cancelar edição" é exibido, a tela rola suavemente até o formulário e o card em edição recebe a classe visual `.is-editing`. A função `resetPromoForm()` restaura o estado inicial do formulário ao cancelar ou ao concluir o salvamento.
  - **Clientes**: A chave de identificação do cliente (`customerKey`) é gerada a partir dos dígitos do telefone. Ao editar um cliente e alterar seu número de telefone, o sistema migra os dados atomicamente para a nova chave, preservando histórico e notas, e remove a chave antiga (`delete customerProfiles[existingKey]`), impedindo registros órfãos e garantindo que novos pedidos pelo novo número recuperem o perfil cadastrado.
  - **Complementos e Adicionais**: O gerenciamento de ativo/inativo dos adicionais e listas (`data-complement-field="active"` e `data-complement-item-field="active"`) utiliza um manipulador compartilhado `handleComplementInput(event)` registrado tanto em `input` quanto em `change`. Isso assegura compatibilidade universal com navegadores e webviews onde checkboxes disparam prioritariamente `change`.
  - **Debounce de Salvamento Seguro no Cardápio e Complementos**: `scheduleProductSave` e `scheduleComplementSave` chaveiam os timers assíncronos (`setTimeout` de 500ms) pelo ID do item, e não por índice numérico. Ao disparar o timer, o índice atualizado no array é recalculado dinamicamente via `findIndex`, tornando a sincronização imune a deslocamentos gerados por adições (`unshift`) ou reordenações concorrentes na interface.
- O editor administrativo de cardápio usa arquivamento reversível em vez de apagar produtos, permite filtrar e ordenar a operação, e só publica item ativo, não arquivado, disponível no dia e no canal de retirada.
- Horário de funcionamento: quando o modo automático está ativo, o status efetivo é calculado no fuso `America/Sao_Paulo`; dia desabilitado ou horário vazio mantém a loja fechada. Janelas que atravessam meia-noite são aceitas quando o fechamento é menor que a abertura. O status efetivo substitui o status manual no Admin e no cardápio público; com modo automático desligado, o status manual continua sendo a fonte de verdade.
- Prioridade operacional do status: existem somente os estados visíveis `open` e `closed`. O fechamento manual tem prioridade sobre a agenda automática somente no dia local em que foi acionado (`manualOverrideDate` em `America/Sao_Paulo`); abrir remove a sobreposição imediatamente, e a virada do dia a expira automaticamente. Valores legados diferentes de `open` são normalizados para `closed`.
- Configuração de horários: cada dia usa um controle de ativação em formato de chave e dois campos de hora com rótulos visíveis, linha independente, foco aparente e reflow para dia em uma linha e horários em duas colunas no celular.
- Agenda semanal: cada linha oferece a ação “Copiar para todos”, que replica apenas abertura e fechamento do dia escolhido nos demais dias, preservando a habilitação individual; a confirmação final acontece ao salvar as configurações.
- WhatsApp operacional: o cardápio envia uma solicitação de pedido objetiva para a loja; mantém um CTA de contato visível junto ao início do cardápio para dúvidas; em celulares, tenta abrir o aplicativo pelo esquema `whatsapp://` e usa `api.whatsapp.com` como fallback; no Admin, o botão usa o template de resumo nos pedidos em operação e muda automaticamente para o template de “pedido pronto” quando o status chega em `Pronto`.
- Impressão operacional: a configuração oferece uma comanda de teste sem criar venda, respeita largura, margem, quantidade de cópias e conteúdo selecionado (cliente, contato, pagamento, preços, observações e totais), enviando ao agente local quando conectado; novos pedidos imprimem uma comanda de produção compacta, sem valores, enquanto a impressão de um pedido pronto usa o comprovante completo para o cliente; o navegador continua como fallback explícito.
- Agente local de impressão: um EXE Windows próprio, em .NET 8/WPF, usa o spooler nativo para imprimir sem janela, seleciona automaticamente a impressora padrão do Windows, mantém uma fila local recuperável somente para o dia atual, limpa o histórico ao iniciar e à meia-noite, lista impressoras instaladas, permite teste/reimpressão até a virada e expõe endpoints somente locais protegidos pela origem permitida do Tokyo Sushi. Uma chave local permanece aceita apenas para compatibilidade com versões antigas. O agente impede instâncias duplicadas para evitar conflito na porta 4242. O instalador Inno Setup instala o agente, cria atalho opcional e inicialização automática sem exigir runtime prévio.

### Edição operacional de pedidos

O editor aparece progressivamente dentro do card do pedido, sem retirar o operador do Kanban. O resumo mostra o total recalculado pelo servidor e avisa quando a edição de um pedido pronto pode exigir reimpressão. A edição mantém o mesmo ID/status e é bloqueada para `Finalizado` e `Cancelado`. O operador pode aplicar desconto ou acréscimo em reais ou percentual; o cupom existente é preservado como linha separada e, para dinheiro, o troco é recalculado.

## Design Visual

- Cardápio público: balcão noturno de restaurante japonês — cabeçalho vinho/preto, superfície de papel quente e checkout com acabamento de recibo premium.
- Admin: faixa de comandas de balcão — tela de trabalho em cinza frio, superfícies claras, cabeçalho e navegação em grafite azulado como âncoras de orientação, dourado discreto, verde de operação e Kanban com três etapas explícitas.
- Status do fluxo: as barras de Recebidos, Aceitos e Prontos mantêm cores próprias para identificação, mas usam tipografia preta de forma consistente.
- Paleta: grafite azulado para assinatura e navegação, dourado discreto para assinatura, creme para leitura, verde profundo para ação operacional e vermelho-rosa para preparo/baixa; evitar tons vinho, marrom e terracota no painel.
- Tipografia: Manrope para leitura, controles e títulos, com fallback de sistema; sem serif pesada ou display ornamental em operação.
- Logo oficial do Admin: `assets/tokyo-logo-instagram.jpg`.
- Componentes-chave: cabeçalho com marca, métricas compactas, navegação persistente em faixa grafite de alto contraste, busca, categorias, cards de produto, carrinho, modal de complementos, rodapé institucional, Kanban de pedidos e módulos administrativos. A seção ativa da navegação é distinguida por superfície clara, texto e `aria-current`. O seletor de status do cardápio oferece somente Abrir e Fechar, com indicador pontual de cor; o estado efetivo selecionado usa preenchimento semântico forte, texto branco, sombra curta, leve mudança de tom no contêiner e `aria-pressed`, enquanto a opção inativa permanece neutra.
- Controles administrativos: filtros rápidos, visões financeiras, categorias e ações de operação mostram estado selecionado/pressionado por preenchimento, borda, sombra curta e `aria-pressed`/`aria-selected`; todo botão também tem feedback de pressão e foco visível.
- Checkout: não ocupa mais uma coluna lateral; usa uma barra fixa inferior com quantidade e total e abre o pedido em um painel inferior sobreposto, com itens separados, campos confortáveis, total destacado, CTA em verde profundo e aviso de confirmação visível. No celular, o painel é minimizado pelo gesto de arrastar para baixo, preservando o pedido no carrinho; fundo e Escape permanecem como alternativas de acessibilidade.
- Complementos: no cardápio público continuam condicionados ao produto por `linkedProductIds`; no PDV, os grupos ativos marcados com `pdv-global` também ficam disponíveis para peças avulsas que não sejam bebidas nem combos. Eles são escolhidos antes da inclusão e aparecem no resumo como adicionais com quantidade e preço.
- Editor de complementos: cada lista usa um cabeçalho próprio para nome e ações destrutivas, mantém regras de mínimo/máximo em uma faixa separada e organiza os itens em campos rotulados com espaçamento responsivo; ações de duplicar e excluir não ficam coladas aos campos de edição.
- Memória do cliente: o PDV usa o cadastro persistido em `customer_profiles` e os pedidos anteriores como fonte de sugestões por nome/celular; ao criar um pedido, atualiza o perfil sem exigir uma tela extra. No cardápio público, nome e celular válidos ficam somente no `localStorage` do dispositivo do cliente e são preenchidos no próximo acesso, sem expor cadastro público.
- PDV: ao selecionar um produto, exibe os grupos e adicionais ativos vinculados a ele e os grupos operacionais ativos marcados com `pdv-global` quando o produto não é bebida nem combo, aplica `minQty`/`maxQty` antes de incluir a linha e envia `groupId`, `itemId`, `qty` e preço-base do adicional para a RPC recalcular o total. A RPC aceita a regra global somente em pedidos administrativos.
- PDV: a entrada de itens usa uma lista rápida compacta com busca, quantidade e ação de adicionar por linha; selecionar o nome mantém o editor contextual de adicionais e a inclusão continua sujeita a `minQty`/`maxQty`.
- Preço do PDV: a ordem de cálculo é subtotal dos itens, desconto manual, desconto de cupom, acréscimo e total final; descontos nunca deixam o total abaixo de zero. Cada pedido registra os valores calculados para auditoria.
- Troco: somente pagamento em dinheiro usa `amount_received`; o banco recalcula `change_amount` e rejeita valor recebido menor que o total.
- Cupons: `tks_promos` mantém `code`, tipo/valor de desconto, status e validade. O PDV valida o código contra os cupons ativos antes de exibir o desconto, e `tks_create_order` repete a validação.
- Regras mobile: primeira tela compreensível sem zoom, carrinho acessível, barra fixa de resumo e controles com área confortável de toque.
- Motion: cards entram com deslocamento curto, produtos elevam com sombra ao passar/tocar, controles têm feedback de pressão e modal/carrinho usam transições de painel; `prefers-reduced-motion` desativa os efeitos não essenciais.
- PWA: cardápio e administração possuem manifests próprios, service worker com fallback offline para as rotas e instalação em desktop/celular. O Admin pode pedir permissão para alertas e exibir notificação de novo pedido enquanto estiver ativo; o controle de alertas deve comunicar visualmente os estados ativo, desativado nas configurações, aguardando permissão, bloqueado e indisponível, com orientação acionável quando o navegador bloquear a permissão e reconsulta ao retornar das configurações do navegador ou do sistema. O recebimento com o app totalmente encerrado usa Push API com VAPID: cada dispositivo autorizado grava sua inscrição na tabela protegida `tks_push_subscriptions`, e um emissor server-side dispara o Push quando `tks_orders` recebe um novo pedido. O polling permanece apenas como fallback para o painel aberto.
- Push fechado: o navegador só é considerado configurado depois que a permissão foi concedida, a inscrição Push foi criada e sua gravação autenticada no Supabase terminou sem erro. O emissor server-side consulta apenas inscrições protegidas, remove endpoints expirados (HTTP 404/410) e nunca expõe a chave privada VAPID ao cliente. A configuração do emissor fica fora do banco público, em secrets do runtime, e o gatilho usa segredo próprio para evitar chamadas externas arbitrárias.

## SEO e Performance

- Title: `Tokyo Sushi`.
- Meta description: pendente de aprovação comercial.
- Schema: pendente; adicionar somente quando os dados oficiais do restaurante forem confirmados.
- Requisitos de velocidade: manter app estático, evitar dependências novas e preservar cache do service worker sem cachear `sw.js`.

## Redesign público — 2026-08

- A primeira tela do cardápio prioriza a decisão do cliente: status de retirada, marca, busca, categorias e produtos aparecem em uma hierarquia curta e escaneável.
- A linguagem visual usa grafite, creme, dourado e verde operacional, com contraste alto, bordas suaves e profundidade discreta; não depende de fonte externa nem de biblioteca adicional.
- No celular, os produtos permanecem em lista compacta, as categorias rolam horizontalmente e o pedido abre por uma barra fixa inferior; no desktop, o pedido fica visível em uma coluna sticky sem retirar o foco do cardápio.
- Imagens de produto usam assets locais, carregamento lazy, `decoding="async"` e fallback visual para arquivo ausente ou indisponível. A imagem de capa é pré-carregada para melhorar o LCP.
- Ações de adicionar, abrir pedido, alterar quantidade e concluir pedido mantêm áreas de toque confortáveis, foco visível, feedback curto e suporte a `prefers-reduced-motion`.
- O cardápio não introduz dependências de runtime ou chamadas de fonte externa; os dados continuam vindo do fallback local e do Supabase quando disponível.
- A direção editorial “Tokyo After Dark” usa hero assimétrico com informações de retirada e pedido via WhatsApp; o CTA de contato fica destacado junto ao início do catálogo, que ocupa a tela inteira, e o carrinho abre como painel sobreposto, sem coluna lateral persistente.
- A página inclui uma faixa curta de orientação (“Escolha”, “Confira”, “Retire”) e um rodapé institucional com a marca, proposta de serviço e crédito do Estudio Fernandes. O acesso administrativo permanece disponível somente pela rota direta `/admin.html`, sem atalho no cardápio público.
- A copy de orientação usa linguagem direta do fluxo real: “Escolha agora. Retire quando estiver pronto.”, seguida de “Monte seu pedido”, “Confirme no WhatsApp” e “Retire no balcão”, sem slogans genéricos ou promessas não confirmadas.

## Riscos

- Risco: acesso público a dados operacionais por RLS permissivo.
  - Mitigação: policies por papel, `tks_admins` e Supabase Auth.
- Risco: pedido público com total adulterado no navegador.
  - Mitigação: `tks_create_order(jsonb)` recalcula valores e adicionais no banco e bloqueia inserção direta na tabela por usuários anônimos.
- Risco: XSS em dados de cardápio e pedidos renderizados em HTML.
  - Mitigação: escape consistente ou criação de nós DOM com `textContent`.
- Risco: falha de gravação online mascarada pelo fallback local.
  - Mitigação: pedido online só é considerado salvo após retorno da função; falhas ficam em `tokyoPendingOrder` e não entram no histórico operacional.
- Risco: fechamento de caixa sem conferência física.
  - Mitigação: sessão aberta e movimentos são persistidos no banco; o fechamento exige valor contado e registra diferença calculada no servidor.
- Risco: recuperação de senha ou login redirecionado para outro sistema no projeto Supabase compartilhado.
  - Mitigação: callback explícito por ambiente para `/admin.html`, URLs locais e de produção liberadas no Supabase e validação do usuário em `tks_admins` após o login.
- Backup e recuperação: o schema e as migrações ficam no Git; os dados `tks_*` possuem exportador REST autenticado em `scripts/export-tks-backup.ps1`. O backup local é ignorado pelo Git e nunca contém a chave de servidor. A recuperação deve ser testada primeiro em ambiente separado e não usa `DELETE`/`TRUNCATE` automático.

## Fluxo de Pagamento via Pix e Cópia em 1 Toque

- **Chave Pix Oficial**: `tokiosushituntum@gmail.com` (Tipo: E-mail, Beneficiário: Fabiano R Fernandes).
- **Interface Pública do Carrinho (`index.html`, `app.css`, `app.js`)**:
  - Exibe o container `#pixPaymentFields` automaticamente quando a forma de pagamento selecionada for "Pix".
  - Apresenta a chave, a identificação do titular ("Beneficiário: Fabiano R Fernandes") e um botão de ação com ícone e rótulo "Copiar chave".
  - O clique copia a chave para a área de transferência usando `navigator.clipboard.writeText` (com fallback robusto via elemento temporário) e altera o botão para "Copiado! ✓" com classe visual e alerta acessível.
- **Formatação de Mensagem WhatsApp (`buildMessage`)**:
  - Quando a forma de pagamento for Pix, inclui um bloco estruturado contendo a chave Pix em uma linha exclusiva e desprovida de caracteres de pontuação adjacentes (`tokiosushituntum@gmail.com`), acompanhada de `Beneficiário: Fabiano R Fernandes`.
  - Esse padrão possibilita a seleção/cópia com um único toque ou toque longo diretamente nos aplicativos móveis do WhatsApp (Android e iOS).
- **Painel Administrativo (`admin.html`, `admin.js`)**:
  - Permite configuração da chave Pix (`#settingsPixKey`) e do nome do titular (`#settingsPixBeneficiary`) na aba Configurações com sincronização online e persistência local.
  - Suporta as tags `{pix}` e `{beneficiario}` nos templates customizáveis de mensagens WhatsApp.
  - No resumo do pedido (`orderSummary`), pedidos pendentes com pagamento em Pix incluem os dados para facilitar o reenvio ao cliente.

