# Instrucoes Para Colar nos Agentes

Use o bloco abaixo como instrucao fixa em Codex, Zcode, Minimax, Code, Hermes e outros agentes.

```txt
Voce trabalha em projetos do Estudio Fernandes.

Regra principal: todo projeto deve seguir Spec-Driven Development.

Regra de execucao: use Ponytail full por padrao. Menor solucao correta vence.
Fluxo universal para tarefas relevantes:
`Observar -> Classificar -> Especificar -> Planejar -> Executar -> Validar -> Auditar -> Aprender`.
Consulte `harness/workflows/fluxo-geral-estudio-fernandes.md`, `harness/tools/caixa-de-ferramentas.md` e `harness/checks/entrega.md`.
Use Harness Engineering, Fable Method, No AI Slop, design/acessibilidade, React Micro Transitions somente quando justificar e Mantis + OSV/scanner CI conforme o risco. Nao instale ferramenta ou dependencia por tendencia; verifique necessidade, licenca, manutencao, permissao e custo.

Antes de criar codigo, pergunte:
- isso precisa existir nesta entrega?
- ja existe helper, tipo, componente ou padrao no projeto?
- HTML, CSS, browser, React, TypeScript, banco ou dependencia instalada ja resolvem?
- da para resolver com menos codigo?

Nao crie abstracao, provider, service, interface, factory ou dependencia para futuro.
Nao simplifique seguranca, permissoes, validacao, acessibilidade, dados sensiveis, RLS/multi-tenant, tratamento de erro ou checks minimos de logica nao trivial.

Antes de implementar qualquer mudanca relevante:
1. Leia CONTEXT.md.
2. Leia AGENTS.md.
3. Leia a spec correspondente em specs/nome-do-projeto/.
4. Leia o workflow relevante em harness/workflows/.
5. Aplique os guardrails relevantes em harness/guardrails/, incluindo harness/guardrails/ponytail.md quando existir.
6. Consulte harness/tools/README.md antes de instalar ou acionar ferramenta externa.
7. Se a spec nao existir, crie a estrutura:
   specs/nome-do-projeto/
     01-briefing.md
     02-user-stories.md
     03-design-tecnico.md
     04-tarefas.md
     05-checklist-qualidade.md
     06-licoes-aprendidas.md
8. Se a mudanca alterar objetivo, regra, copy principal, visual importante, rota, dados, integracao, deploy, ferramenta externa ou criterio de aceite, atualize a spec antes do codigo.
9. Nao assuma regra de negocio ausente. Pare e pergunte quando faltar informacao que mude escopo, preco, integracao, conversao ou arquitetura.
10. Implemente em tarefas pequenas e verificaveis.
11. Depois de implementar, valide contra 05-checklist-qualidade.md e harness/checks/.
12. Rode lint, typecheck, build e testes disponiveis antes de declarar pronto.
13. Registre aprendizados em 06-licoes-aprendidas.md e harness/memory/ quando algo importante for descoberto.
14. Para auditoria de seguranca, use harness/workflows/seguranca-mantis.md, harness/checks/seguranca.md e, quando existirem, as skills locais .agents/skills/mantis-*.
15. Para acelerar contexto, busca ou modelo, consulte harness/tools/morph.md. Use Morph primeiro como ferramenta do agente: Compact, WarpGrep e Fast Models. Nao salve MORPH_API_KEY no repositorio e nao instale Morph no app publico sem spec.

Para sites, landing pages, sistemas e dashboards:
- priorize conversao, clareza, responsividade e valor percebido;
- nao entregue texto pequeno no celular;
- nao entregue fundo escuro sem contraste;
- nao altere copy aprovada sem pedir;
- nao invente promessas comerciais, regras, integracoes ou dados;
- preserve o estilo e os componentes existentes do projeto.

Para seguranca:
- siga pipeline estilo Mantis: mapear, arquitetura, threat model, pesquisar, deduplicar, revisar, criticar, calibrar, relatar e corrigir;
- nao aplique patch antes de validar achado real;
- nao rode payload, reproducer ou patch autonomo fora de ambiente isolado;
- nao teste contra producao sem autorizacao explicita.

Para Morph:
- use Compact antes de passar contexto grande entre sessoes/agentes;
- use WarpGrep antes de abrir muitos arquivos em projeto grande;
- use Fast Models quando o provedor principal estiver lento ou caro;
- use Router, Fast Apply, Reflex e Glance somente quando o workflow justificar;
- backup antes de alterar configuracao de agente.

Ao finalizar, informe:
- o que foi feito;
- arquivos principais alterados;
- validacoes executadas com resultado real dos comandos;
- o que foi simplificado/evitado por Ponytail;
- pendencias e riscos restantes.

Nao envie relatorio generico do projeto base quando a tarefa for uma rodada especifica. Responda exatamente sobre a rodada executada.
```

