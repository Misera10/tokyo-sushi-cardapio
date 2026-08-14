# Caixa de Ferramentas Geral

Esta e a selecao enxuta para os projetos do Estudio Fernandes. Ela define
metodos e pontos de decisao; nao significa instalar todos os repositorios.

## 1. Harness Engineering — sempre

Use para organizar contexto, regras, memoria, checks e feedback dos agentes.
Arquivos principais: `AGENTS.md`, `CONTEXT.md`, `specs/`, `harness/` e testes.

Aplicar quando:

- houver mais de uma rodada de agente;
- o projeto tiver regras de negocio ou banco;
- um erro puder voltar a acontecer;
- o trabalho exigir auditoria ou handoff.

## 2. Fable Method — sempre em tarefas relevantes

Use o ciclo `Observar -> Classificar -> Especificar -> Planejar -> Executar ->
Validar -> Auditar -> Aprender`. O roteiro oficial esta em
`harness/workflows/fluxo-geral-estudio-fernandes.md`.

## 3. No AI Slop — copy, documentacao e mensagens

Aplicar `harness/guardrails/copy.md` antes de aprovar:

- hero, CTA, oferta e FAQ;
- mensagens de erro e sucesso;
- textos de onboarding;
- README, propostas e relatorios.

Regra: texto claro, especifico e humano. Nao remover a voz aprovada pelo usuario.

## 4. Design e acessibilidade — qualquer interface

Usar as skills de frontend, design e acessibilidade quando disponiveis e validar:

- `harness/guardrails/visual.md`;
- `harness/checks/acessibilidade.md`;
- `harness/checks/mobile.md`;
- `harness/checks/seo.md` quando a pagina for indexavel.

`React Micro Transitions` entra apenas quando a interface ganhar com feedback
visual. Nao adicionar animacao decorativa, dependencia ou WebGL sem necessidade.

## 5. Seguranca — Mantis + OSV Scanner quando aplicavel

Para auth, banco, permissoes, API, uploads, webhooks, pagamentos ou dados
sensíveis, usar `harness/workflows/seguranca-mantis.md` e
`harness/checks/seguranca.md`.

Para vulnerabilidades conhecidas em dependencias, preferir OSV-Scanner ou o
scanner oficial disponivel no CI. Isso complementa o Mantis; nao substitui
revisao de autorizacao, RLS e isolamento de tenant.

## Matriz rapida

| Necessidade | Caixa recomendada |
|---|---|
| Contexto e handoff entre agentes | Harness + Fable |
| Copy e documentacao | No AI Slop + guardrail de copy |
| UI vendavel | Frontend/design + visual + mobile |
| Acessibilidade | Accessibility + check de acessibilidade |
| Animacao de interface | React Micro Transitions, somente quando justificar |
| Auth, banco, permissoes e dados | Mantis + check de seguranca |
| Dependencias vulneraveis | OSV-Scanner ou scanner CI equivalente |

## Regras de adocao

- Nao instalar ferramenta so porque apareceu em tendencia.
- Avaliar licença, manutencao, superficie de permissao e custo de operacao.
- Fazer backup antes de mudar configuracao de agente.
- Nao colocar chaves de ferramentas no repositorio.
- Registrar nova dependencia em `03-design-tecnico.md` quando ela virar parte
  da arquitetura do produto.
