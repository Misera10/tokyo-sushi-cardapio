# Workflow: Housekeeping de Projetos e Agentes

Use este fluxo para auditar pastas de projetos, caches, backups, outputs temporarios e configuracoes de agentes sem apagar algo importante por acidente.

## Objetivo

Manter o ambiente leve, organizado e recuperavel, sem remover codigo, configs, secrets, backups recentes ou artefatos que ainda possam ser necessarios.

## Regra Principal

Primeiro gere relatorio. So apague depois de revisar os candidatos e confirmar.

## Categorias Seguras Para Relatorio

- `node_modules`
- `.next`
- `dist`
- `build`
- `coverage`
- `.turbo`
- `.vite`
- `.cache`
- logs (`*.log`)
- arquivos temporarios (`*.tmp`, `*.temp`)
- backups antigos gerados por agentes (`*.bak-*`, `*.broken-*`)
- pastas temporarias em `C:\tmp`

## Nunca Apagar Automaticamente

- `.env`, `.env.local`, `.env.production`
- `.git`
- `src`, `app`, `pages`, `components`, `lib`
- `supabase`, `migrations`, `prisma`, `drizzle`
- `specs`, `harness`, `docs`
- `AGENTS.md`, `CONTEXT.md`, `README.md`
- configs de agentes sem backup e confirmacao
- qualquer arquivo com segredo, token, chave ou dados de cliente

## Fluxo

1. Defina a raiz auditada.
2. Rode o script em modo relatorio.
3. Separe candidatos por risco:
   - baixo: cache/build geravel novamente;
   - medio: backup antigo;
   - alto: config, banco, docs, projeto ativo.
4. Revise o relatorio.
5. Se for limpar, limpe por categoria e com limite de idade.
6. Gere relatorio final com espaco liberado.

## Comando Recomendado

```powershell
.\scripts\auditar-lixo-projetos.ps1 -Root "C:\EstudioFernandes\Projetos" -MinAgeDays 7
```

Para exportar CSV:

```powershell
.\scripts\auditar-lixo-projetos.ps1 -Root "C:\EstudioFernandes\Projetos" -MinAgeDays 7 -CsvPath ".\housekeeping-report.csv"
```

Para limpar automaticamente apenas categorias seguras:

```powershell
.\scripts\auditar-lixo-projetos.ps1 -Root "C:\EstudioFernandes\Projetos" -MinAgeDays 7 -AutoCleanSafe
```

O modo `-AutoCleanSafe` apaga somente `.next`, `dist`, `build`, `coverage`, `.turbo`, `.vite`, `.cache`, `.parcel-cache`, `*.log`, `*.tmp` e `*.temp`.

Ele nao apaga automaticamente `node_modules`, backups, `.env`, `.git`, codigo fonte, docs, specs, migrations ou configs.

## Frequencia

- Projetos ativos: semanal, so relatorio.
- Pasta geral de projetos: quinzenal.
- Caches e temporarios: mensal.
- Configs globais de agentes: apenas sob demanda e com backup.
