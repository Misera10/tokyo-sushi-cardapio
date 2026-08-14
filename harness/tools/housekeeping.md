# Tool: Housekeeping

## Quando Usar

- Pasta de projetos ficando pesada.
- Muitos backups, caches, `.next`, `node_modules`, logs ou temporarios acumulados.
- Antes de copiar projeto, compactar, arquivar ou limpar disco.
- Depois de testes com agentes/ferramentas que criam muitas pastas.

## Ferramentas

- Script local: `scripts/auditar-lixo-projetos.ps1`
- Modo seguro automatico: `-AutoCleanSafe`
- PowerShell nativo.
- Opcional: TreeSize/WinDirStat para inspecao visual, mas nao e obrigatorio.

## Como Usar No Fluxo

1. Rode relatorio primeiro.
2. Revise candidatos.
3. Nunca apague configs, envs ou codigo fonte automaticamente.
4. Limpe por categoria e idade.
5. Registre o que foi apagado.

## AutoCleanSafe

Pode apagar automaticamente:

- `.next`
- `dist`
- `build`
- `coverage`
- `.turbo`
- `.vite`
- `.cache`
- `.parcel-cache`
- `*.log`
- `*.tmp`
- `*.temp`

Nao apaga automaticamente:

- `node_modules`
- backups
- `.env*`
- `.git`
- codigo fonte
- docs/specs/harness
- migrations/configs

## Criterios

- Nenhuma exclusao sem lista previa.
- Nenhum segredo impresso no relatorio.
- Nenhum projeto ativo quebrado.
- Espaco liberado registrado.

## Nao Usar Para

- Apagar repositorios antigos sem confirmacao humana.
- Limpar `.git`, `.env`, migrations, specs ou docs.
- Executar `git clean -xfd` de forma ampla.
