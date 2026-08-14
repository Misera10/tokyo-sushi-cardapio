<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ponytail-rules -->
# Ponytail Full Por Padrao

Use Ponytail em modo full em qualquer implementacao, auditoria ou refatoracao.

Antes de escrever codigo, aplique esta escada:

1. Isso precisa existir nesta entrega?
2. Ja existe no projeto?
3. A biblioteca padrao resolve?
4. O browser, HTML, CSS, banco ou plataforma resolve nativamente?
5. Uma dependencia ja instalada resolve?
6. Da para resolver com menos codigo?
7. So entao escreva o minimo correto.

Regras:

- Nao criar abstracao, interface, factory, provider ou service "para o futuro".
- Nao instalar dependencia para algo que a plataforma ou dependencias existentes ja resolvem.
- Preferir reutilizar, simplificar e deletar antes de adicionar.
- Menor solucao correta vence.
- Em auditoria, aponte o que pode ser deletado, simplificado ou trocado por recurso nativo/stdlib.

Nunca simplifique fora: seguranca, validacao em fronteiras de confianca, permissoes, RLS/multi-tenant, protecao de dados sensiveis, acessibilidade, tratamento de erro que evita perda de dados e checks minimos para logica nao trivial.
<!-- END:ponytail-rules -->

<!-- BEGIN:spec-driven-rules -->
# Spec-Driven Development

Regra-base universal para agentes: `docs/agentes/BASE-SPEC-DRIVEN-ESTUDIO-FERNANDES.md`.

Antes de qualquer mudanca relevante neste projeto:

1. Leia `CONTEXT.md` para usar a linguagem correta do negocio.
2. Leia a spec correspondente em `specs/`.
3. Leia o workflow relevante em `harness/workflows/`.
4. Aplique os guardrails relevantes em `harness/guardrails/`.
5. Sempre aplique `harness/guardrails/ponytail.md` quando existir.
6. Consulte `harness/tools/README.md` antes de instalar ou acionar ferramenta externa.
7. Se a mudanca alterar objetivo, regra, copy principal, rota, dados, visual importante, deploy, ferramenta externa ou criterio de aceite, atualize a spec antes do codigo.
8. Nao assuma regra de negocio ausente. Pare e pergunte quando faltar informacao que mude escopo, preco, integracao, conversao ou arquitetura.
9. Depois de implementar, valide contra `05-checklist-qualidade.md` da spec e os checks em `harness/checks/`.
10. Nao declare pronto com relatorio generico: informe arquivos alterados, validacoes reais, pendencias reais e resultado dos comandos executados.

Para novos projetos, copie `specs/_template/` para `specs/nome-do-projeto/` e preencha pelo menos briefing, user stories, design tecnico e checklist antes de implementar. Use `harness/workflows/novo-projeto.md` como roteiro.

Para auditoria de seguranca, use `harness/workflows/seguranca-mantis.md` e `harness/checks/seguranca.md`. Quando existirem skills locais em `.agents/skills/mantis-*`, use-as junto do fluxo. Nao aplique patch antes de mapear, modelar ameacas, pesquisar, deduplicar, revisar, criticar falsos positivos e calibrar severidade. Nao rode payloads, reproducoes ou patches autonomos fora de ambiente isolado.
<!-- END:spec-driven-rules -->
<!-- BEGIN:operational-flow-rules -->
# Fluxo Operacional Geral

Para tarefas relevantes, siga o ciclo:
`Observar -> Classificar -> Especificar -> Planejar -> Executar -> Validar -> Auditar -> Aprender`.

Consulte:
- `harness/workflows/fluxo-geral-estudio-fernandes.md`
- `harness/tools/caixa-de-ferramentas.md`
- `harness/checks/entrega.md`

Use Harness Engineering e Fable Method como metodos de trabalho. Use No AI Slop para copy e documentacao, design/acessibilidade para interfaces, React Micro Transitions somente quando houver justificativa e Mantis + scanner de dependencias quando o risco exigir. Nao instale repositorios ou dependencias por tendencia: verifique necessidade, licenca, manutencao, permissao e custo antes.

Nunca declare uma etapa pronta sem evidencia recente de escopo, validacoes tecnicas, QA visual quando aplicavel, seguranca quando aplicavel e riscos restantes.
Para conduzir o projeto sem retrabalho e fechar uma etapa antes da proxima, use `harness/workflows/entrega-rapida-estudio-fernandes.md.
<!-- END:operational-flow-rules -->



