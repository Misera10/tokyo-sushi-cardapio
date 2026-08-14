# Morph LLM

Use Morph como ferramenta de harness dos agentes, nao como dependencia padrao do site ou app.

Referencia:
- https://docs.morphllm.com
- https://github.com/morphllm/examples/tree/main

## Fase 1 recomendada

Use primeiro apenas quando houver ganho claro de velocidade, contexto ou busca:

1. **Fast Models**: testar modelos OpenAI-compatible para tarefas de codigo, revisao e auditoria controlada.
2. **Compact**: comprimir contexto longo antes de passar para outro agente ou continuar uma sessao extensa.
3. **WarpGrep**: buscar informacao na codebase por subagente quando o projeto for grande ou confuso.

## Opcionais com aprovacao

- **Model Router**: usar somente com limite de custo definido, porque cobra por classificacao.
- **Fast Apply**: usar somente quando houver diff review depois. Nunca aplicar mudancas cegamente.
- **Reflex**: usar para classificar risco de prompt, loop, frustracao ou politica em fluxos automatizados.
- **Glance**: usar quando houver PR, preview deploy e necessidade de evidencia visual com video/screenshots.

## Guardrails

- Nunca salve `MORPH_API_KEY` no repositorio.
- Nunca coloque Morph no bundle publico de site estatico.
- Nunca exponha token em chat, log, screenshot, commit ou arquivo de spec.
- Antes de rodar setup em agente, faca backup da configuracao do agente.
- Se o agente ja tiver provedores configurados, nao substitua tudo; adicione Morph como opcao separada.
- Para teste rapido, prefira chamada pequena e com `max_tokens` baixo.
- Para projetos do Estudio Fernandes, registre no design tecnico apenas se Morph virar dependencia real do projeto. Se for so ferramenta do agente, registre em `harness/tools/`.

## Configuracao segura

A chave deve ficar no ambiente do usuario ou no cofre do agente:

```powershell
[Environment]::SetEnvironmentVariable("MORPH_API_KEY", "SUA_CHAVE", "User")
```

Em sessoes que nao herdaram a variavel:

```powershell
$env:MORPH_API_KEY=[Environment]::GetEnvironmentVariable("MORPH_API_KEY","User")
```

## Uso em agentes

Quando estiver disponivel:

- use **Compact** antes de resumir contexto grande;
- use **WarpGrep** antes de ler muitos arquivos;
- use **Fast Models** para tarefas de raciocinio/codigo quando o provedor principal estiver lento ou caro;
- mantenha lint, typecheck, build, testes e revisao de diff como gates obrigatorios.
