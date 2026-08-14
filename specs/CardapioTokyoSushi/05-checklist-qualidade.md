# Checklist de Qualidade

## Conversao

- [ ] Hero ou tela inicial explica a oferta em ate 3 segundos.
- [ ] CTA principal aparece cedo.
- [ ] Canal de conversao tem contexto correto.

## Visual

- [ ] Mobile legivel sem zoom.
- [ ] Textos nao sobrepoem elementos.
- [ ] Contraste suficiente.
- [ ] Botoes tem area confortavel de toque.
- [ ] Checkout apresenta itens, campos, total, CTA e aviso de confirmação em hierarquia clara.
- [ ] Carrinho não depende de coluna lateral; abre pela barra fixa inferior e pode ser fechado por botão, fundo ou Escape.
- [ ] Tipografia diferencia marca/títulos de controles sem depender de fonte externa.
- [ ] Foco visível e movimento reduzido respeitado.
- [ ] Toque/clique em categorias, produtos, adicionais e ações do pedido tem feedback visual.
- [ ] PDV mostra subtotal, desconto, cupom, acréscimo, total e troco com hierarquia clara.
- [ ] Pagamento em dinheiro impede confirmação quando o valor recebido é insuficiente.
- [ ] Animações não impedem leitura nem interação no celular.

## Tecnico

- [ ] Lint passa.
- [ ] Build passa.
- [ ] Testes passam, se existirem.
- [ ] Rotas principais respondem.
- [ ] Links e assets funcionam.
- [ ] Push: com permissão liberada, o dispositivo inscrito recebe novo pedido com o Admin fechado; inscrição inválida é removida sem interromper a criação da venda.

## Segurança

- [ ] Painel administrativo exige Supabase Auth.
- [ ] Nenhuma senha de admin fica no JavaScript público.
- [ ] Usuários anônimos não conseguem ler, atualizar ou excluir pedidos.
- [ ] Apenas administradores registrados em `tks_admins` conseguem operar o painel.
- [ ] Dados dinâmicos renderizados no HTML são escapados ou inseridos com `textContent`.
- [ ] A chave `service_role` não aparece no cliente, no repositório ou na documentação.
- [ ] A chave privada VAPID, o segredo do emissor e a chave `service_role` ficam somente nos secrets server-side.

## Publicacao

- [ ] Deploy realizado no destino correto.
- [ ] Dominio ou preview testado.
- [ ] Cache considerado.

