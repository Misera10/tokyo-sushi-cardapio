# Tokyo Sushi — Design System

## Direção

O Admin usa a metáfora de uma faixa de comandas do balcão: informação organizada como tickets de operação, com leitura rápida, estado explícito e ação seguinte evidente. A superfície é clara, limpa e tátil, enquanto o plum aparece apenas para marca, seleção e ação principal.

## Paleta

- `--plum-deep`: #1b1217 — contraste principal e texto sobre ação.
- `--plum`: #2f1d27 — marca, títulos, seleção e ação principal.
- `--page`: #f5f4f2 — fundo de trabalho.
- `--surface`: #ffffff — painéis e campos.
- `--surface-soft`: #f4f3f1 — áreas de formulário e colunas.
- `--saffron`: #c89a4c — destaque, abertura e atenção.
- `--green`: #26766a — ações operacionais e sucesso.
- `--coral`: #a95f4d — preparo pronto e informação de produção.
- `--red`: #a7474c — ações destrutivas e erro.

## Tipografia

Manrope é usada em toda a interface. A hierarquia vem de peso, escala curta e espaçamento, sem fonte decorativa em labels ou dados.

## Composição

- Cabeçalho plum fixo com logo oficial e ações globais.
- Métricas compactas no topo, com marcadores de cor discretos.
- Navegação de módulos persistente e rolável no celular.
- Painel principal em papel quente, com formulários, listas e Kanban em superfícies elevadas.
- PDV com pedido atual ao lado no desktop e empilhado no celular.
- Fluxo de pedidos em quatro etapas: Novos, Em preparo, Prontos e Entregues.

## Estados e movimento

Botões têm hover, foco, pressão visual e estado sem depender somente de cor. A troca de módulo usa uma entrada curta; cards elevam discretamente ao foco do ponteiro. `prefers-reduced-motion` reduz as transições sem remover contexto.

## Responsividade

- Desktop: shell central até 1280px, métricas em quatro colunas e Kanban em quatro colunas.
- Tablet: métricas e Kanban em duas colunas, formulários reorganizados.
- Celular: shell estreito, navegação horizontal, métricas em duas colunas, formulários e fluxo em uma coluna, alvos de toque confortáveis.

## Marca

O logo oficial é `assets/tokyo-logo-instagram.jpg`. Não usar `assets/tokyo-logo.svg` como marca principal do Admin.
