# Tarefas

## A Fazer

- [ ] Confirmar dados comerciais, endereço, horário, telefone e política de retirada.
- [ ] Aplicar o `supabase-schema.sql` atualizado no projeto Supabase e registrar o UUID do administrador em `tks_admins`.
- [x] Validar anonimamente que `tks_orders` não possui leitura direta e que a criação ocorre por `tks_create_order(jsonb)`.
- [ ] Validar fluxo completo no navegador em desktop e mobile.
- [ ] Revisar checklist de segurança, entrega e publicação.
- [ ] Validar abertura, movimento e fechamento do caixa com as RPCs relacionais.
- [x] Migrar despesas e receitas históricas do Gestão Tóquio para `tks_expenses` e `tks_finance_daily_revenues`, preservando origem e idempotência.
- [x] Disponibilizar CRUD de compras/despesas no Financeiro e calcular lucro operacional por período.
- [x] Retirar Google OAuth do fluxo do Tokyo Sushi e manter o provedor compartilhado disponível para a Audiometria.

## Em Andamento

- [x] Validar edição operacional de pedido ativo: itens, quantidades, adicionais, cliente, observações, recálculo server-side e bloqueio de finalizado/cancelado.
- [ ] Validar edição de desconto/acréscimo em reais e percentual, preservação de cupom e recálculo de total/troco.

- [ ] Ativar a migração de Auth/RLS no projeto Supabase externo.
- [ ] Aprovar a nova direção visual do Admin antes de iniciar os testes de CRUD.
- [ ] Validar o fluxo de retirada com três etapas e operação de operador único.
- [x] Bloquear baixa de pedido não pago no Admin e no banco, mantendo o valor pendente fora do faturamento recebido.
- [x] Reforçar `search_path` das funções `SECURITY DEFINER` e criar rotina versionada de exportação dos dados `tks_*`.
- [ ] Executar e testar um backup real com chave de servidor fornecida por ambiente seguro; nunca versionar o arquivo gerado.
- [ ] Validar busca de clientes no PDV e seleção de adicionais vinculados com regras de quantidade.
- [ ] Validar descontos, acréscimos, cupons, pagamento em dinheiro e cálculo de troco no PDV.
- [ ] Aplicar a migração de atributos ampliados de produtos e validar o CRUD do editor de cardápio.
- [ ] Validar arquivamento/restauração, grupos, filtros, dias/canais, etiquetas e estoque rápido.
- [ ] Validar o Financeiro: períodos, filtro por cliente, indicadores, gráficos por dia/mês/ano, produtos, descontos, exportação e controle diário de compras/despesas.
- [ ] Validar configurações operacionais: templates de WhatsApp, impressão de teste, impressão automática, cópias, largura/margem do papel, conteúdo da comanda e alertas de novos pedidos.
- [ ] Ativar Push real para novos pedidos: VAPID, inscrição por dispositivo, `tks_push_subscriptions`, emissor server-side, limpeza de endpoints expirados e teste com o Admin fechado.
- [x] Criar o agente Windows próprio de impressão com fila local, descoberta da impressora padrão, impressão de pedido, teste e endpoints locais protegidos.
- [x] Integrar o Admin ao agente local com pareamento, fallback nativo e reimpressão.
- [x] Criar instalador Inno Setup autocontido, inicialização com Windows e desinstalação limpa.
- [ ] Validar impressão física no notebook da operação com a impressora instalada como padrão no Windows.
- [x] Validar horário de funcionamento: domingo a sábado, dia habilitado/desabilitado, abertura, fechamento, janela atravessando meia-noite e bloqueio automático do cardápio fora do horário.
- [ ] Validar arquivamento de venda pelo Financeiro, confirmação, remoção do relatório e rollback quando o banco falhar.
- [x] Validar CRUD operacional de linhas do pedido no carrinho: adicionar, alterar quantidade, remover e limpar.

## Concluido

- [x] Sincronizar o branch `main` do GitHub para a pasta local.
- [x] Completar briefing inicial com pendências explícitas.
- [x] Completar design técnico baseado no código existente.
- [x] Completar user story inicial e critérios de aceite.
- [x] Implementar Supabase Auth e verificação de papel de administrador.
- [x] Preparar policies RLS separando público e administrador.
- [x] Corrigir renderizações dinâmicas expostas e bloquear envio quando o pedido não sincroniza.
- [x] Definir política de falha para pedido não sincronizado no Supabase.
- [x] Recalcular preços e adicionais no banco e adicionar idempotência por `client_request_id`.
- [x] Trocar limpeza destrutiva de pedidos por arquivamento.
- [x] Preparar Kanban operacional no PDV com avanço por status.
- [x] Implementar confirmação online do PDV antes de limpar o formulário.
- [x] Criar base relacional do caixa com abertura, movimentos e fechamento.
- [x] Completar CRUD do pedido em montagem no PDV com quantidade, remoção e limpeza rápida.
- [x] Implementar primeira fatia do editor de cardápio com grupos, filtros, ordenação, arquivamento reversível, disponibilidade, etiquetas, imagens secundárias e estoque.
- [x] Definir a arquitetura do módulo Financeiro orientada a vendas, caixa, DRE e contas.

