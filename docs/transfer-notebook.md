# Transferência para o notebook da operação

## Pacote

O arquivo `TokyoSushi-Codex-Notebook-20260814.zip` contém:

- `projeto/`: código, `AGENTS.md`, documentação, specs, harness, migrations, Admin, cardápio, fonte do Tokyo Print e skills locais em `.agents/skills/`.
- `instalador-notebook/`: instalador `TokyoPrintSetup-v0.4.1.exe` e pacote ZIP do agente.
- `LEIA-ME.txt`: instruções de extração e abertura no Codex.

## Segurança

O pacote não contém `.env`, chave `service_role`, senha, perfil do navegador, token do Codex ou `settings.json` do agente. A chave local do Tokyo Print deve ser criada/gerenciada no notebook.

As skills globais do Codex não são copiadas: elas são instaladas pelo próprio ambiente. Apenas as skills específicas deste projeto ficam dentro de `projeto/.agents/skills/`.

## Diagnóstico no notebook

Depois de instalar e abrir o Tokyo Print, o Codex deve verificar:

```powershell
Get-Process TokyoSushi.PrintAgent -ErrorAction SilentlyContinue
Invoke-WebRequest http://127.0.0.1:4242/health -UseBasicParsing
Get-Content "$env:LOCALAPPDATA\TokyoSushi\PrintAgent\agent.log" -Tail 100 -ErrorAction SilentlyContinue
```

O pedido precisa aparecer no Admin antes de a impressão automática ser acionada. A configuração `printOnNewOrder` deve estar ativa no painel.
