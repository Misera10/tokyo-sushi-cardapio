# Harness Estudio Fernandes

Harness e a camada operacional ao redor dos agentes de IA: regras, specs, workflows, guardrails, checks, memoria e integracoes. Ele existe para reduzir retrabalho, economizar tokens e fazer os agentes acertarem mais cedo.

## Como Usar

Antes de iniciar qualquer trabalho:

1. Leia `CONTEXT.md`.
2. Leia `AGENTS.md`.
3. Leia a spec em `specs/`.
4. Escolha o workflow certo em `harness/workflows/`.
5. Aplique os guardrails relevantes em `harness/guardrails/`.
6. Valide com os checks em `harness/checks/`.
7. Registre aprendizados em `harness/memory/` e na spec.

Para o ciclo completo e universal, use `harness/workflows/fluxo-geral-estudio-fernandes.md`.
Para terminar projetos em etapas curtas, use `harness/workflows/entrega-rapida-estudio-fernandes.md`.
Para a selecao de ferramentas, consulte `harness/tools/caixa-de-ferramentas.md`.
Antes de declarar uma etapa pronta, execute `harness/checks/entrega.md`.

## Estrutura

```txt
harness/
  workflows/   passo a passo por tipo de trabalho
  guardrails/  limites e regras de seguranca/qualidade
  checks/      listas de verificacao antes de entregar
  memory/      padroes reutilizaveis do Estudio Fernandes
  tools/       matriz de decisao para ferramentas externas
```

## Ferramentas Externas

Use `harness/tools/README.md` antes de instalar ou acionar ferramentas como Playwright, Firecrawl, LikeC4, Strix, Temporal, Deja Vu, Housekeeping, Jcode, Kanddev, PI Agent, Agent Zero ou ECC.

A regra e simples: ferramenta so entra quando resolve um gargalo real de contexto, validacao, seguranca, automacao, memoria ou orquestracao. Ferramenta que muda arquitetura, exige token, Docker, permissao ampla, CI, deploy ou acesso a dados sensiveis deve ser registrada na spec antes de virar dependencia.

## Seguranca Com Pipeline Estilo Mantis

Para auditoria de seguranca, use `harness/workflows/seguranca-mantis.md`.

Esse fluxo segue a ideia do Google Mantis: mapear arquitetura, modelar ameacas, pesquisar vulnerabilidades, deduplicar, revisar, criticar falsos positivos, calibrar severidade, relatar e so entao corrigir.

Regra importante: reproducoes, payloads e patches de seguranca nao devem rodar direto na maquina principal nem contra producao. Use modo interativo, aprovacao humana e ambiente isolado.

## Regra De Ouro

Nenhum agente deve implementar, publicar ou alterar regra importante sem spec, checklist e validacao.


