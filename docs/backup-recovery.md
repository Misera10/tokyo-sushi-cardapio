# Backup e recuperação do Tokyo Sushi

## O que fica protegido

- O schema e as regras ficam versionados em `supabase-schema.sql` e `supabase/migrations/`.
- Os dados operacionais `tks_*` podem ser exportados com `scripts/export-tks-backup.ps1`.
- O diretório local `backups/` é ignorado pelo Git para não publicar nome, celular, pedidos ou dados financeiros.

## Fazer um backup manual

Use uma chave de servidor somente no ambiente local seguro. Ela não deve ser colocada em `config.js`, `.env` versionado, issue, log ou GitHub.

```powershell
$env:TKS_SUPABASE_SERVICE_ROLE_KEY = Read-Host "Chave de servidor temporária"
powershell -ExecutionPolicy Bypass -File .\scripts\export-tks-backup.ps1
Remove-Item Env:TKS_SUPABASE_SERVICE_ROLE_KEY
```

O script pagina as tabelas, grava JSON por tabela e cria `backup-manifest.json`. Ele não altera o banco.

## Recuperação

1. Preserve o backup original e confirme o `project_ref` no manifesto.
2. Recupere o código na versão do commit registrada no Git.
3. Reaplique schema e migrações em um ambiente de restauração antes de tocar a produção.
4. Valide RLS, autenticação, produtos, pedidos e totais.
5. Faça a restauração dos dados com uma rotina supervisionada e idempotente; não execute `DELETE` ou `TRUNCATE` como etapa automática.
6. Só depois de conferir contagens e amostras, faça a recuperação em produção.

Este projeto não possui a senha do banco nem uma chave `service_role` disponível no ambiente atual; por isso o backup real não foi executado automaticamente nesta auditoria. A rotina está preparada para ser executada no notebook seguro da operação ou em CI com secret manager.

## Rotina recomendada

Faça um backup antes de cada migração e ao final de cada dia de operação. Para recuperação ponto-a-ponto e retenção automática, confirme no painel do Supabase se o plano contratado oferece backups/PITR; o projeto atual está no plano Free, então o export local deve ser tratado como a cópia operacional principal.
