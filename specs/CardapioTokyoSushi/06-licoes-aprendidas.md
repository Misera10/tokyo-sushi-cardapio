# Licoes Aprendidas

## O que funcionou

- Testes end-to-end automatizados via Playwright com navegador real (MCP e headless) permitindo reprodução exata dos cliques operacionais e inspeção do estado no DOM e no localStorage.
- Arquitetura vanilla desacoplada onde funções utilitárias puras (`customerKey`, `normalizeOrder`, `dateOnlyValue`) facilitam a correção cirúrgica sem efeitos colaterais em cascata.
- Chaveamento dinâmico por ID único imutável em operações de debounce assíncrono.

## O que deu problema

- A RPC retorna as chaves Push em colunas planas (`p256dh` e `auth`), enquanto a biblioteca `web-push` exige essas chaves agrupadas em `subscription.keys`. Sem o mapeamento explícito, o Worker localizava as inscrições, mas todas as entregas falhavam.
- O cálculo de horário tratava `mode = "closed"` como fechamento manual mesmo quando `manualOverride = false`. A regra precisa distinguir o estado calculado pela agenda do fechamento manual explícito.
- O fechamento manual precisava de uma data local; sem `manualOverrideDate`, ele podia atravessar dias e impedir a abertura automática seguinte.
- No Financeiro, clicar em "Editar" de uma despesa disparava `renderReports()` sem `{ preserveExpenseDraft: false }`, fazendo a rotina restaurar o rascunho em branco anterior e esvaziar os inputs recém-preenchidos.
- Em Marketing / Promoções, o formulário usava o índice posicional do array (`dataset.editIndex = index`) em vez do ID. Se a lista sofresse `unshift` (duplicação) ou `splice` (exclusão), a edição sobrescrevia a promoção errada. Além disso, a ausência de botão de cancelamento deixava o operador preso no modo de edição.
- Em Clientes, a chave identificadora no mapa deriva do telefone. Ao editar e alterar o telefone, a chave antiga era mantida (`existingKey`), gravando o número novo dentro da chave velha e quebrando a recuperação do perfil em novos pedidos pelo novo número.
- Em Complementos, os checkboxes de ativo/inativo ouviam apenas o evento `input`. Em navegadores onde cliques em checkbox disparam prioritariamente `change`, o auto-save não era acionado.
- No salvamento assíncrono com debounce de 500ms (`scheduleProductSave` e `scheduleComplementSave`), a passagem de índice numérico volátil em vez do ID do item causava risco de salvar o item errado se a lista recebesse `unshift` antes do timeout disparar.

## Padroes para repetir

- Validar o contrato do retorno da RPC contra o formato esperado pela biblioteca de entrega antes de publicar integrações server-side.
- Testar horários com datas fixas em UTC convertidas para `America/Sao_Paulo`, incluindo o instante exato de abertura, o instante exato de fechamento e o fechamento manual.
- Persistir a data do override manual e validar sua expiração na virada do dia antes de publicar a agenda.
- Sempre identificar e editar entidades por ID único persistente (`id`), nunca por índice de array posicional (`index`).
- Todo formulário com modo de edição deve fornecer: rolagem suave até os campos (`scrollIntoView`), indicação visual no botão ("Atualizar X" vs "Salvar X"), destaque no item em edição (`.is-editing`) e botão explícito de "Cancelar edição" (`resetForm`).
- Ao atualizar o atributo identificador de uma entidade em mapas de chave-valor (ex.: telefone em `customerProfiles`), migrar os dados para a nova chave e deletar a chave anterior para evitar registros órfãos.
- Em controles de formulário nativos como `<input type="checkbox">`, escutar tanto `change` quanto `input` para compatibilidade universal entre navegadores desktop, mobile e WebViews.
- Em funções de debounce com `setTimeout`, indexar os timers pelo ID único do item e recalcular o índice no array no momento da execução (`findIndex`).

## Padroes para evitar

- Nunca usar índices numéricos de array (`array[index]`) como identificador em formulários ou timers assíncronos.
- Nunca re-renderizar formulários sem parametrizar se o rascunho atual deve ser preservado ou descartado.
- Nunca manter dados antigos sob chaves obsoletas quando o identificador de negócio for alterado.
- Nunca confiar que caixas de seleção disparam `input` de forma idêntica a campos de texto em todos os navegadores.
