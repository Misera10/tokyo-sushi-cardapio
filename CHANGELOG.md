# Changelog — Tokyo Sushi Cardápio & Painel Administrativo

Todas as alterações notáveis, correções e atualizações deste projeto são documentadas neste arquivo.

O formato baseia-se em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2026-09-08] — Redesign Estético do Cartão Pix & Correção de Cópia Multi-Camada

### ✨ Melhorias de UX & Design (Skills `emil-design-eng`, `frontend-design`, `impeccable`)

#### 1. Redesign Estético de Alto Padrão do Cartão Pix
- **Problema**: O bloco Pix anterior possuía visual de formulário básico verde-claro genérico, com layout apertado e sem feedback visual perceptível em alguns dispositivos móveis.
- **Solução Visual**:
  - Transformado em cartão fintech/izakaya de luxo (`.pix-card`), com fundo escuro em degradê obsidiana/jade (`#161c1b` a `#0d1413`), bordas sutis em verde esmeralda translúcido e o logo vetorial oficial do Pix em teal (`#00BDAE`).
  - Badge de "Chave E-mail" e selo "Aprovação Imediata".
  - Chave Pix destacada em tipografia monospace limpa e de alto contraste em container tracejado com resposta a toque.
  - Botão de ação full-width no mobile (`.pix-action-btn`) com gradiente esmeralda, micro-interação no clique (`scale(0.97)`) e transição de ícone suave para checkmark de sucesso.
  - Selo de segurança com ícone de escudo e verificação destacando o titular **Fabiano R Fernandes**.

#### 2. Cópia Infalível & Feedback Multi-Camadas
- **Problema**: Em alguns navegadores mobile (iOS Safari / WebViews), o método `navigator.clipboard.writeText` pode falhar por restrição de contexto ou foco, sem disparar o fallback. Além disso, o toast global (`.feedback-region`) estava com `z-index: 30`, ficando oculto atrás da gaveta do pedido (`.cart`, `z-index: 60`).
- **Soluções Implementadas**:
  - **Fallback Robusto**: Implementada função `copyTextToClipboard` com `navigator.clipboard.writeText` prioritário e fallback síncrono com `document.execCommand('copy')` em `textarea` temporário estilizado para contornar restrições do iOS Safari (`setSelectionRange`, `contentEditable`).
  - **Banner de Confirmação Inline**: Criado o elemento `#pixFeedbackBanner` dentro do próprio cartão Pix, que desliza suavemente (`cubic-bezier(0.23, 1, 0.32, 1)`) exibindo checkmark verde e a mensagem *"Chave Pix copiada com sucesso! Abra seu app do banco e cole na opção 'Transferir via Pix'"*.
  - **Toque no Box Inteiro**: O usuário pode clicar tanto no botão quanto em qualquer área do container da chave (`#pixKeyBox`) para copiar imediatamente.
  - **Haptics Nativo**: Disparo de vibração sutil (`navigator.vibrate([35, 25, 35])`) em smartphones compatíveis para confirmação tátil do toque.
  - **Ajuste de Z-Index**: `z-index` de `.feedback-region` elevado de 30 para `99999`, garantindo que toasts globais flutuem acima de qualquer modal ou gaveta aberta.
  - **Duração Ágil (2.0s) & Toque para Fechar**: Reduzido o tempo de permanência da mensagem e do estado copiado de 4.5s/5.2s para 2.0s com fade-out suave (`.animate-out`), além de permitir toque em qualquer lugar do banner para fechamento instantâneo.
- **Arquivos**: [`index.html`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/index.html), [`styles.css`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/styles.css), [`app.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/app.js).

---


### ✨ Adicionado & Melhorado

#### 1. Mensagem de Pedido no WhatsApp com Bloco Pix de Cópia em 1 Toque
- **Problema**: Ao finalizar um pedido com forma de pagamento "Pix" no cardápio público, a mensagem enviada pelo cliente no WhatsApp continha apenas `Pagamento: Pix`. O cliente precisava perguntar manualmente a chave Pix, gerando atrito e demora no atendimento.
- **Correção**:
  - Em `app.js` (`buildMessage`), quando o pagamento selecionado for "Pix", a mensagem formata automaticamente um bloco destacado:
    ```text
    *DADOS PARA PAGAMENTO PIX*
    Chave Pix (E-mail):
    tokiosushituntum@gmail.com

    Valor a transferir: R$ XX,XX
    Beneficiário: Fabiano R Fernandes
    _(Copie a chave acima para pagar no aplicativo do seu banco e envie o comprovante nesta conversa)_
    ```
  - A chave `tokiosushituntum@gmail.com` é inserida em linha limpa e isolada, permitindo que no WhatsApp mobile (Android/iOS) o cliente copie a chave com um simples toque ou pressione/segure, sem selecionar pontuações ou textos indesejados.

#### 2. Bloco Visual de Pagamento Pix com Botão "Copiar Chave" no Carrinho
- **Melhoria**: No cardápio público (`index.html` e `styles.css`), quando o cliente seleciona a opção "Pix" no formulário de finalização do pedido, é exibido um container elegante (`#pixPaymentFields`) contendo:
  - Título com ícone e badge "E-mail";
  - Exibição visual da chave `tokiosushituntum@gmail.com`;
  - Exibição visual do titular `Beneficiário: Fabiano R Fernandes`;
  - Botão interativo **[Copiar chave]** com feedback visual imediato ("Copiado! ✓"), troca de classe de sucesso e notificação toast;
  - Orientação ao cliente de que a chave também acompanhará o pedido no WhatsApp para envio do comprovante.
- **Arquivos**: [`index.html`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/index.html), [`styles.css`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/styles.css), [`app.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/app.js).

#### 3. Gestão e Exibição de Pix no Painel Administrativo
- **Melhoria**:
  - No formulário de configurações do Admin (`admin.html`), foram adicionados os campos "Chave Pix da loja (E-mail)" (`#settingsPixKey`) e "Nome do beneficiário Pix" (`#settingsPixBeneficiary`), com valor inicial `Fabiano R Fernandes` e sincronização online.
  - Disponibilizadas as variáveis `{pix}` e `{beneficiario}` nos templates customizáveis de WhatsApp (`settingsWhatsappOrderTemplate` e `settingsWhatsappReadyTemplate`).
  - No resumo do pedido (`orderSummary` em `admin.js`), pedidos com forma de pagamento Pix e status pendente agora incluem automaticamente os dados do Pix e o beneficiário ao enviar mensagens de confirmação ao cliente.
- **Arquivos**: [`admin.html`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.html), [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js).

### 🔍 Validações Realizadas
- **Sintaxe**: `node --check app.js admin.js menu-data.js` validado com sucesso.
- **Playwright em Navegador Real**:
  - Verificação de exibição e alternância de estado de `#pixPaymentFields` no carrinho.
  - Teste de clique do botão de cópia com transição para "Copiado! ✓".
  - Verificação do texto gerado por `buildMessage()`, confirmando a chave Pix isolada na linha exata.
  - Verificação da aba Configurações no Admin (`#settingsPixKey`), salvamento de preferências e substituição da variável `{pix}` em templates.

---

## [2026-09-07] — Correções de Fluxos de Edição, Estado e Integridade de Índices

### 🐛 Corrigido

#### 1. Financeiro — Edição de Despesas
- **Problema**: Ao clicar no botão "Editar" de um lançamento de despesa, a re-renderização disparava `restoreExpenseFormDraft`, que sobrescrevia imediatamente os campos recém-preenchidos com os valores em branco do rascunho anterior.
- **Correção**:
  - Parâmetro `{ preserveExpenseDraft: false }` passado explicitamente nas chamadas de `edit` e `cancel-edit` em `renderReports()`.
  - Adicionada rolagem suave automática (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) até o formulário `#expenseForm` e foco no campo de descrição (`expenseDescription`).
- **Arquivos**: [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js) (L3112-L3122), [`admin.html`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.html).

#### 2. Marketing / Promoções — Edição Segura por ID e Botão Cancelar
- **Problema**: O formulário armazenava o índice posicional do array (`dataset.editIndex = index`). Caso uma promoção fosse duplicada (`unshift`) ou excluída (`splice`), a ordem dos índices mudava e o submit sobrescrevia a promoção errada. Além disso, não havia botão para cancelar a edição e a tela não rolava até o formulário.
- **Correção**:
  - Promoções agora possuem ID único persistente (`promo.id`).
  - A edição passa a operar por `dataset.editId = promoId`.
  - O botão de submit muda para "Atualizar promoção" durante a edição.
  - Adicionado botão explícito "Cancelar edição" (`#cancelPromoEdit`) que reseta o formulário e restaura os botões ao estado padrão via `resetPromoForm()`.
  - Adicionado realce visual no card em edição com a classe `.promo-card.is-editing`.
  - Adicionada rolagem suave até `#promoForm` e foco no título da promoção.
- **Arquivos**: [`admin.html`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.html), [`admin.css`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.css), [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js).

#### 3. Clientes — Migração de Chave ao Alterar Telefone
- **Problema**: A chave identificadora do perfil deriva dos dígitos do telefone. Ao editar um cliente e alterar seu número de telefone, o código mantinha `existingKey`, gravando o número novo sob a chave do número antigo. Novos pedidos feitos pelo novo número geravam nova chave e não encontravam o histórico nem as anotações do cliente.
- **Correção**:
  - No submit de `#customerForm`, o sistema calcula a nova chave `customerKey(name, phone)`.
  - Se `existingKey` for diferente da nova chave, o perfil anterior é migrado, a chave antiga é deletada do mapa (`delete customerProfiles[existingKey]`) e a lista `hiddenCustomerKeys` é atualizada.
  - O botão "Cancelar" do cliente limpa o campo oculto `customerKey`.
- **Arquivos**: [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js).

#### 4. Complementos — Suporte a Eventos `change` e `input` em Checkboxes
- **Problema**: Os checkboxes para ativar/desativar uma lista ou item adicional (`data-complement-field="active"` e `data-complement-item-field="active"`) estavam registrados exclusivamente no listener do evento `input`. Em navegadores ou webviews mobile onde caixas de seleção disparam prioritariamente o evento `change`, o auto-save não era executado e o estado era revertido ao recarregar a página.
- **Correção**:
  - Criada a função unificada `handleComplementInput(event)`.
  - Conectada tanto ao ouvinte de `input` quanto ao de `change`, garantindo persistência imediata no `localStorage` e agendamento de sincronização com o banco em qualquer dispositivo ou navegador.
- **Arquivos**: [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js).

#### 5. Cardápio e Complementos — Debounce Seguro por ID Contra Deslocamento de Array
- **Problema**: As funções `scheduleProductSave` e `scheduleComplementSave` recebiam o índice numérico do array e aguardavam 500ms. Se o operador adicionasse um novo item (`unshift`), todos os índices no array eram deslocados em +1 antes do temporizador expirar, resultando na gravação de dados do item errado no Supabase.
- **Correção**:
  - Os temporizadores de debounce agora são indexados pelo ID único do produto (`product.id`) ou da lista de complementos (`group.id`).
  - Quando os 500ms expiram, o índice do item no array é recalculado dinamicamente via `findIndex`, assegurando que o item exato enviado ao banco seja o que sofreu a alteração.
- **Arquivos**: [`admin.js`](file:///f:/EstudioFernandes/Projetos/CardapioTokyoSushi/admin.js).

### 🔍 Validações Realizadas
- **Sintaxe**: `node --check admin.js` executado sem erros (código 0).
- **Testes automatizados com Playwright em navegador real**:
  - Fluxo de criação, cancelamento e salvamento de promoções por ID validado.
  - Migração de chave de cliente na troca de telefone validada.
  - Disparo de evento `change` em checkboxes de complementos validado.
  - Resiliência de `scheduleProductSave` contra deslocamento de array por `unshift` validada.
  - Regressão do Financeiro na edição de despesas validada.
