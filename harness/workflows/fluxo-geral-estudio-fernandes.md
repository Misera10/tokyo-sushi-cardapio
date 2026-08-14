# Workflow: Fluxo Geral Estudio Fernandes

Use este workflow em qualquer projeto: site, landing page, SaaS, SST, dashboard,
automacao, integracao ou ferramenta com IA.

## Principio

O agente executa; a pessoa define objetivo, limites e criterio de aceite.
Nenhuma entrega e considerada pronta apenas porque o agente informou que terminou.
Cada afirmacao importante precisa de evidencia recente.

## Ciclo Fable

1. **Observar**
   - Ler `CONTEXT.md`, `AGENTS.md`, a spec e o workflow do tipo de projeto.
   - Mapear arquitetura, rotas, dados, integracoes e estado do repositorio.
   - Identificar o objetivo comercial e a conversao principal.

2. **Classificar**
   - Definir se o trabalho e produto, copy, visual, backend, banco, seguranca,
     deploy, manutencao ou auditoria.
   - Selecionar somente as skills, ferramentas e guardrails necessarios.

3. **Especificar**
   - Registrar objetivo, usuario, regra de negocio, escopo, fora de escopo e
     criterios de aceite antes de alterar codigo.
   - Se houver preco, permissao, integracao, banco, deploy ou copy principal
     indefinidos, parar e pedir decisao.

4. **Planejar**
   - Dividir em fatias pequenas e verificaveis.
   - Definir os comandos e evidencias que provarao cada criterio.
   - Escolher o agente adequado: Codex para auditoria/decisao, Zcode ou Hermes
     para implementacao conforme o fluxo combinado.

5. **Executar**
   - Fazer uma fatia por vez.
   - Preservar mudancas do usuario e evitar refatoracao fora do escopo.
   - Nao instalar ferramenta externa ou dependencia sem registrar a decisao.

6. **Validar**
   - Rodar lint, typecheck, testes e build disponiveis.
   - Testar o fluxo principal no navegador quando houver interface.
   - Validar desktop e mobile quando houver UI.
   - Para auth, banco, permissoes, API ou dados sensiveis, seguir o pipeline
     Mantis e o check de seguranca.

7. **Auditar**
   - Comparar o relatorio do agente com o diff, codigo real, banco e evidencias.
   - Separar feito, validado, parcialmente feito, pendente e falso positivo.
   - Nao aceitar "passou" sem comando, resultado ou evidência correspondente.

8. **Aprender**
   - Registrar somente decisoes permanentes, erros recorrentes e guardrails
     reutilizaveis em `06-licoes-aprendidas.md` ou `harness/memory/`.
   - Atualizar a spec com o estado real e o proximo passo.

## Gate de parada

O ciclo so termina quando:

- os criterios de aceite foram verificados um a um;
- lint, testes, typecheck e build aplicaveis foram executados;
- riscos restantes foram escritos sem esconder pendencias;
- nenhum agente esta afirmando QA que nao foi executado;
- o proximo passo esta claro.

Se uma verificacao nao puder ser feita, o status e `pendente`, nunca `aprovado`.
