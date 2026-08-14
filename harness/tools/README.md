# Matriz de Ferramentas do Harness

Use esta pasta como matriz de decisao. A regra nao e instalar tudo; e escolher a ferramenta certa para reduzir retrabalho, economizar tokens e validar melhor antes de entregar.

## Escolha Rapida

| Contexto | Ferramentas preferidas |
| --- | --- |
| Site, landing page, UI, mobile, formulario, CTA | Playwright, Firecrawl |
| Redesign baseado em site existente ou concorrente | Firecrawl, Playwright |
| SaaS, dashboard, backend, banco, integracoes | LikeC4, Playwright, Mantis |
| Auditoria de seguranca | Mantis, Strix em ambiente isolado |
| Projeto grande com muitas dependencias internas | codebase-memory-mcp, Code Review Graph |
| Agente repetindo erro antigo | Deja Vu |
| Pastas pesadas, caches, builds e backups acumulados | Housekeeping |
| Workflow longo com retry, filas, notificacoes | Temporal |
| Multiplos agentes em paralelo | Kanddev, Jcode |
| Padronizar agentes com papeis, regras, hooks e memoria | ECC |
| Acelerar agente, comprimir contexto ou buscar na codebase | Morph LLM: Compact, WarpGrep, Fast Models |

## Regras

- Primeiro leia `AGENTS.md`, `CONTEXT.md`, a spec e o workflow relevante.
- Use ferramenta externa somente quando ela resolver um gargalo real.
- Strix, pentest, reproducer e payload devem rodar apenas isolados em Docker/CI.
- Temporal so entra quando houver workflow duravel real, nao em landing page simples.
- Ferramentas novas precisam de registro em `specs/*/03-design-tecnico.md` quando virarem dependencia do projeto.
- Se a ferramenta exigir token, conta, Docker, deploy, permissao de escrita ampla ou acesso a dados sensiveis, pare e peca aprovacao.
- Harness externo como ECC nao deve ser empilhado com instalacoes duplicadas no mesmo agente. Escolha um metodo de instalacao por agente e faca backup antes.
- Housekeeping deve rodar primeiro em modo relatorio. Nunca apague configs, envs, `.git`, migrations, specs ou codigo fonte sem revisao humana.
- Morph deve ser usado como ferramenta do agente/harness. Nao coloque `MORPH_API_KEY` no repositorio nem instale SDK no site publico sem uma feature de IA especificada.

## Ordem Recomendada Por Trabalho

1. **Entender**: specs, contexto e arquitetura.
2. **Mapear**: codebase-memory, Code Review Graph ou LikeC4.
3. **Executar**: agente principal com skills adequadas.
4. **Validar**: Playwright, build, lint, testes e checks.
5. **Auditar**: Mantis/Strix quando houver seguranca.
6. **Aprender**: registrar decisoes e padroes em `harness/memory/`.
