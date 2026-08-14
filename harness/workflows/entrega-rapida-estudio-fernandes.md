# Workflow: Entrega Rapida Estudio Fernandes

Use este workflow para terminar projetos com velocidade sem sacrificar qualidade.
O objetivo e reduzir voltas, retrabalho e etapas abertas por tempo indefinido.

## Regra central

Cada etapa deve entregar uma parte verificavel do produto. Nenhuma etapa termina
com promessa, placeholder critico ou relato sem evidencia. O proximo passo so
comeca depois da auditoria da etapa atual.

## Fase 0 — Contrato de entrega

Antes de codificar, registrar em uma pagina:

- comprador, usuario principal e problema comercial;
- fluxo principal que precisa funcionar para vender;
- escopo desta versao e fora de escopo;
- stack, banco, integracoes, dominio e ambiente de deploy;
- criterios de aceite mensuraveis;
- decisoes que nao serao reabertas sem nova aprovacao.

Se preco, permissao, integracao, dado legal ou regra de negocio estiver indefinido,
registrar a decisao pendente antes de implementar.

## Fase 1 — Fundacao executavel

Preparar contexto, spec, identidade visual, shell, ambiente, auth e persistencia
minima. Ao final, o projeto precisa instalar, iniciar, compilar e ter o primeiro
fluxo de acesso funcionando.

Gate: lint, typecheck, build, rota inicial e ambiente documentado.

## Fase 2 — Fatia vertical vendavel

Implementar primeiro um fluxo completo de ponta a ponta, por exemplo:

`entrar -> configurar -> compartilhar link -> usuario executar acao -> dono ver resultado`

Usar dados reais quando a infraestrutura ja existir. Mock somente quando isso
estiver explicitamente marcado e nao esconder uma funcao essencial para a venda.

Gate: fluxo completo no navegador, desktop e mobile, com estados de sucesso,
erro, vazio e carregamento.

## Fase 3 — Operacao e seguranca

Adicionar os fluxos secundarios necessarios para operar: permissoes, equipe,
cancelamento, notificacoes, isolamento de tenant, auditoria de inputs e recovery.

Gate: testes de autorizacao fora da UI, RLS/policies quando houver banco,
auditoria de secrets, Mantis quando o risco exigir e QA dos perfis.

## Fase 4 — Venda e confianca

Finalizar landing, copy, planos, CTA, legal, SEO basico, suporte, onboarding,
metricas e mensagens de produto. Toda promessa comercial precisa existir no
produto ou estar marcada como futura.

Gate: primeira dobra clara, CTA funcional, links legais sem 404, copy mobile,
preco coerente com a cobranca e nenhuma promessa de recurso inexistente.

## Fase 5 — Publicacao

Configurar envs de producao, banco, migrations, dominio, email, integracoes,
backup, observabilidade e rollback. Fazer smoke test no dominio real.

Gate: deploy no destino correto, fluxo principal em producao, logs sem secrets,
rotas criticas respondendo, rollback conhecido e relatorio final com riscos.

## Regras para nao voltar e refazer

- Uma etapa tem um objetivo e um dono de decisao.
- Mudanca nova entra no backlog; nao entra silenciosamente na etapa em curso.
- Nao instalar ferramenta ou dependencia durante a implementacao sem decisao.
- Nao expandir escopo para "deixar mais completo" antes do gate atual.
- Nao marcar mock como pronto, nem QA citado por outro agente como validado.
- Bloqueio deve ser reportado em ate uma rodada, com a decisao necessaria.
- O agente implementador entrega comandos, arquivos e evidencias; o auditor
  confere o resultado real antes de liberar a etapa seguinte.

## Divisao de trabalho

- Codex: define escopo, escolhe ordem, audita codigo, banco e evidencias.
- Zcode/Hermes: implementa exatamente o prompt da etapa e executa os checks.
- Usuario: decide preco, promessa, integracoes, dados legais e aprovacao de gate.

## Relatorio obrigatorio

Toda etapa termina separando:

- feito;
- validado com comando/evidencia;
- parcialmente validado;
- nao testado;
- pendencias e riscos;
- proximo passo unico.

O projeto so pode ser chamado de pronto quando as fases aplicaveis estiverem
fechadas e o gate de entrega em `harness/checks/entrega.md` estiver preenchido.
