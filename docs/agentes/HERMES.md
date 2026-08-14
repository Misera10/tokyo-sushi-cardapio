# Hermes

Cole o conteudo de `docs/agentes/INSTRUCOES-PARA-COLAR-NOS-AGENTES.md` nas instrucoes fixas do Hermes.

Quando o Hermes trabalhar em varios repositorios, garanta que cada repositorio tenha:

- `CONTEXT.md`
- `MEMORY.md`, quando o projeto usar memoria persistente
- `specs/`
- `AGENTS.md` ou arquivo equivalente de instrucao local

## Loop obrigatorio

Antes de implementar, siga o ciclo:

`Observar -> Planejar -> Executar -> Validar -> Auditar -> Corrigir -> Aprender`

Leia `MEMORY.md` antes de rodadas relevantes. Registre somente decisoes permanentes, erros recorrentes, restricoes confirmadas e aprendizados que evitem retrabalho. Nunca registre credenciais, dados pessoais, hipoteses ou relatorios completos.

O Hermes deve ler `AGENTS.md`, `CONTEXT.md`, a spec da tarefa, os workflows e guardrails relevantes antes de alterar codigo. Use Ponytail full e informe evidencias reais de lint, typecheck, build e testes aplicaveis.

## Morph

No Hermes, use Morph para reduzir lentidao em tarefas de contexto:

- Compact antes de continuar sessoes longas.
- WarpGrep antes de leitura ampla de arquivos.
- Fast Models quando o provedor principal estiver lento.

Evite acionar muitos subagentes sem necessidade. Backup antes de mexer em provedores ou setup.
