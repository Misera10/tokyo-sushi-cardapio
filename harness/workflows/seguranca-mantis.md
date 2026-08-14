# Workflow: Auditoria de Seguranca Estilo Mantis

Use este fluxo para revisar sites, sistemas, SaaS, dashboards, APIs, bancos, automacoes, Workers e qualquer codigo que receba input de usuario, manipule dados, tenha autenticacao, permissao, pagamento, deploy ou integracao externa.

Inspirado no Google Mantis: https://github.com/google/mantis

Quando as skills locais estiverem disponiveis em `.agents/skills/`, prefira usa-las como comandos/roteiros especializados para cada etapa:

- `mantis-summarize`
- `mantis-architecture`
- `mantis-threat-model`
- `mantis-plan`
- `mantis-researcher`
- `mantis-dedupe`
- `mantis-review`
- `mantis-critic`
- `mantis-calibrate`
- `mantis-report`
- `mantis-patch`

Skills auxiliares disponiveis:

- `mantis-structural-index`
- `mantis-reproduce`
- `mantis-reflect`
- `mantis-history`
- `mantis-chain`
- `mantis-meta-agent`
- `mantis-pipeline-adapter`

## Objetivo

Trocar auditoria por prompt solto por um pipeline sequencial, com menos alucinacao, menos falso positivo e mais evidencia antes de aplicar patch.

## Regras De Seguranca

- Rode em modo interativo, com aprovacao humana para comandos sensiveis.
- Nao use modo yolo, auto-approve amplo ou skip de permissoes.
- Nao execute payloads, scripts gerados pela IA, reproducoes ou patches fora de ambiente isolado.
- Nunca teste contra producao sem autorizacao explicita.
- Nao publique achado de seguranca sem validacao manual e evidencia.
- Se houver segredo exposto, pare e oriente rotacao da chave antes de continuar.

## Pipeline Obrigatorio

1. **Mapeamento e entendimento**
   - Ler `CONTEXT.md`, `AGENTS.md`, spec e docs tecnicos.
   - Mapear rotas, APIs, Server Actions, auth, banco, storage, filas, webhooks, Workers e deploy.
   - Criar ou atualizar uma base local em Markdown quando a auditoria for grande.

2. **Arquitetura**
   - Identificar fronteiras de confianca: client, server, banco, terceiros, admin, publico.
   - Listar dados sensiveis, roles, tenants, tabelas, policies, tokens e variaveis de ambiente.

3. **Threat model e plano**
   - Listar ameacas provaveis por superficie:
     - auth quebrada;
     - acesso cross-tenant;
     - IDOR;
     - RLS/policy ausente;
     - Server Action sem validacao;
     - upload inseguro;
     - webhook sem assinatura;
     - XSS/HTML injection;
     - SSRF;
     - vazamento de secrets;
     - rate limit ausente;
     - permissao de admin fraca.
   - Transformar isso em plano de investigacao.

4. **Pesquisa**
   - Procurar evidencias no codigo, migrations, configs, actions, rotas e componentes.
   - Registrar cada achado com arquivo, linha, fluxo afetado, impacto e hipotese de exploracao.

5. **Deduplicate**
   - Unir achados repetidos.
   - Separar causa raiz de sintomas.

6. **Review**
   - Verificar se cada achado tem evidencia real no codigo.
   - Remover alucinacoes, arquivo inexistente, fluxo impossivel ou premissa sem base.

7. **Critic**
   - Tentar derrubar o proprio achado.
   - Checar se auth, middleware, RLS, schema, policy, validacao ou infraestrutura ja bloqueiam a exploracao.
   - Marcar como falso positivo quando a falha nao for exploravel no fluxo real.

8. **Calibrate**
   - Classificar severidade:
     - Critico: tomada de conta, vazamento massivo, escrita cross-tenant, execucao remota.
     - Alto: leitura cross-tenant, bypass admin, alteracao indevida de dados.
     - Medio: abuso limitado, rate limit ausente em endpoint sensivel, validacao parcial.
     - Baixo: hardening, informacao excessiva, melhoria defensiva.
   - Priorizar por explorabilidade + impacto no negocio.

9. **Report**
   - Entregar relatorio com:
     - resumo executivo;
     - achados confirmados;
     - falsos positivos descartados;
     - evidencias;
     - risco;
     - patch recomendado;
     - validacao necessaria.

10. **Patch**
   - Corrigir um achado por vez.
   - Atualizar testes e spec quando mudar comportamento.
   - Rodar `harness/checks/seguranca.md`, lint, build e testes.
   - Nao aplicar patch gerado por IA sem leitura humana quando tocar auth, permissao, banco ou dados sensiveis.

## Prompt Curto Para Agente

```txt
Execute uma auditoria de seguranca estilo Mantis.
Leia AGENTS.md, CONTEXT.md, specs/ e harness/.
Siga harness/workflows/seguranca-mantis.md etapa por etapa.
Nao aplique patch antes de passar por dedupe, review, critic e calibrate.
Nao execute payload ou reproducer fora de ambiente isolado.
Entregue achados confirmados, falsos positivos descartados e plano de patch.
```
