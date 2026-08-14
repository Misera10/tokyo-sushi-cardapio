# Base Spec-Driven Estudio Fernandes para Agentes de IA

Use esta instrucao em Codex, Zcode, Minimax, Code, Hermes e qualquer agente de desenvolvimento usado pelo Estudio Fernandes.

## Regra Principal

Todo projeto do Estudio Fernandes deve seguir Spec-Driven Development. A especificacao e o contrato vivo do projeto. Codigo, copy, design, testes, deploy e auditoria devem derivar da spec versionada no repositorio.

Nao trabalhe apenas por prompts soltos. Antes de implementar, leia a especificacao do projeto. Se ela nao existir, crie a estrutura de spec antes de codar.

Todo projeto tambem deve usar Ponytail full por padrao: menor solucao correta, sem dependencia, camada ou abstracao para futuro. Sempre aplique `harness/guardrails/ponytail.md` quando existir.

Nunca use Ponytail como desculpa para reduzir seguranca, permissoes, validacao, acessibilidade, isolamento multi-tenant, protecao de dados sensiveis ou tratamento de erro importante.

## Estrutura Obrigatoria

Todo projeto deve ter:

```txt
CONTEXT.md
specs/
  README.md
  _template/
    01-briefing.md
    02-user-stories.md
    03-design-tecnico.md
    04-tarefas.md
    05-checklist-qualidade.md
    06-licoes-aprendidas.md
  nome-do-projeto/
    01-briefing.md
    02-user-stories.md
    03-design-tecnico.md
    04-tarefas.md
    05-checklist-qualidade.md
    06-licoes-aprendidas.md
docs/
  adr/
harness/
  workflows/
  guardrails/
  checks/
  memory/
  tools/
```

## Fluxo Obrigatorio

1. **Ler contexto**: leia `CONTEXT.md` para usar a linguagem correta do negocio.
2. **Ler spec**: leia a pasta `specs/nome-do-projeto/` antes de qualquer mudanca relevante.
3. **Ler harness**: escolha o workflow em `harness/workflows/`, aplique guardrails e checks. Sempre leia `harness/guardrails/ponytail.md` quando existir.
4. **Escolher ferramentas**: consulte `harness/tools/README.md` antes de acionar Playwright, Firecrawl, LikeC4, Strix, Temporal, Deja Vu, Jcode, Kanddev, PI Agent, Agent Zero, ECC ou Morph.
5. **Especificar**: se faltar requisito, atualize briefing, user stories ou design tecnico antes do codigo.
6. **Decompor**: transforme o escopo em tarefas pequenas em `04-tarefas.md`.
7. **Executar**: implemente uma fatia por vez.
8. **Auditar**: valide contra `05-checklist-qualidade.md` e `harness/checks/`.
9. **Aprender**: registre aprendizados em `06-licoes-aprendidas.md` e `harness/memory/`.

## Auditoria de Seguranca Estilo Mantis

Quando o trabalho envolver seguranca, backend, auth, banco, Server Actions, API, webhooks, uploads, pagamento, admin ou dados sensiveis, use `harness/workflows/seguranca-mantis.md`.

Quando existirem skills locais em `.agents/skills/mantis-*`, use essas skills como comandos/roteiros especializados junto com o harness. O harness continua sendo o contrato operacional do Estudio Fernandes.

Fluxo obrigatorio:

1. Mapear codebase e contexto.
2. Descrever arquitetura e fronteiras de confianca.
3. Criar threat model e plano de investigacao.
4. Pesquisar vulnerabilidades com evidencia em codigo real.
5. Deduplicar achados.
6. Revisar para remover alucinacoes.
7. Criticar falsos positivos considerando o fluxo real.
8. Calibrar severidade por impacto e explorabilidade.
9. Gerar relatorio.
10. Aplicar patch somente depois da validacao.

Regras:

- Nao rode payloads, reproducoes ou patches autonomos direto na maquina principal.
- Nao teste contra producao sem autorizacao explicita.
- Achado de IA nao e vulnerabilidade confirmada ate passar por review, critic e evidencia.
- Para usar o Mantis oficial, referencia: https://github.com/google/mantis

## Morph LLM no Harness

Morph pode ser usado como acelerador dos agentes, nao como dependencia automatica do produto final.

Prioridade inicial:

1. **Compact** para reduzir contexto antes de continuar sessoes longas ou transferir trabalho entre agentes.
2. **WarpGrep** para busca orientada na codebase antes de abrir muitos arquivos.
3. **Fast Models** para testar modelos OpenAI-compatible em tarefas de codigo, revisao e auditoria.

Regras:

- Nunca salve `MORPH_API_KEY` no repositorio.
- Nunca exponha chave em resposta, log, screenshot ou commit.
- Nao instale SDK Morph no site/app publico se a spec nao pedir uma feature de IA.
- Antes de rodar setup em Zcode, Codex, Minimax, Hermes ou outro agente, faca backup da configuracao.
- Se usar Model Router, defina limite de custo antes; nao rode em todo prompt por padrao.
- Se usar Fast Apply, revise o diff antes de considerar pronto.
- Consulte `harness/tools/morph.md` para detalhes.

## Quando Parar e Perguntar

Pare e pergunte antes de assumir qualquer informacao que afete:

- regra de negocio;
- preco;
- publico-alvo;
- copy principal;
- oferta;
- canal de conversao;
- integracao externa;
- banco de dados;
- autenticacao;
- permissao;
- deploy;
- ferramenta externa;
- identidade visual;
- criterio de aceite.

Nao deixe a IA inventar regra, layout, dado, promessa comercial ou arquitetura quando isso nao estiver especificado.

## Criterios de Aceite

User stories devem usar criterios claros, preferencialmente no formato:

```txt
Dado que ...
Quando ...
Entao ...
```

Exemplo:

```txt
Dado que acesso a pagina pelo celular,
quando vejo a primeira tela,
entao entendo a oferta sem precisar dar zoom.
```

## Tarefas

Tarefas devem ser pequenas e verificaveis. Evite tarefas vagas como "melhorar site". Prefira:

```txt
- [ ] Ajustar menu mobile para ter fundo opaco.
- [ ] Trocar CTA da hero para mensagem aprovada.
- [ ] Validar `npm run lint`.
- [ ] Validar `npm run build`.
```

## Codigo e Design

Para sites, landing pages, sistemas e dashboards:

- priorize conversao, clareza e responsividade;
- nao entregue layout com texto pequeno no celular;
- nao entregue fundo escuro sem contraste;
- nao deixe botao falso ou link quebrado;
- preserve copy aprovada pelo usuario;
- nao altere identidade visual fora da tarefa;
- use componentes existentes do projeto antes de criar novos;
- mantenha edicoes pequenas e rastreaveis.

## Validacao Obrigatoria

Antes de declarar pronto, rode o que existir no projeto:

```txt
npm run lint
npm run build
testes automatizados, quando existirem
validacao visual em desktop e mobile, quando possivel
```

Se uma validacao nao puder ser executada, explique o motivo.

## Deploy

Antes de publicar:

- confira que a spec permite deploy;
- rode lint/build;
- valide rota principal;
- valide CTA principal;
- confira dominio ou preview;
- considere cache.

## ADRs

Crie ADR em `docs/adr/` quando a decisao for:

- dificil de reverter;
- surpreendente sem contexto;
- resultado de trade-off real.

Exemplo: escolher Cloudflare Pages, trocar banco, mudar arquitetura, adotar Spec-Driven.

## Resposta Final do Agente

Ao finalizar, responda curto e objetivo:

- o que foi feito;
- quais arquivos principais foram alterados;
- o que foi validado;
- o que ficou pendente;
- proximo passo recomendado.

Nao diga que esta pronto se a spec ou checklist nao foi validada.
