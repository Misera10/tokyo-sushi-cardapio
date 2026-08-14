# Workflow: Deploy Cloudflare

Use para publicar sites no Cloudflare Pages ou Workers.

## Passos

1. Confirmar destino: Pages ou Workers.
2. Rodar lint e build.
3. Conferir pasta de saida.
4. Publicar no projeto correto.
5. Conferir preview do deploy.
6. Conferir dominio com cache novo.
7. Informar URL final e possivel atraso de cache.

## Comando Pages Estatico

```powershell
npx wrangler pages deploy out --project-name NOME_DO_PROJETO --branch main
```

## Guardrails

- Nao publicar sem build passar.
- Nao confundir preview com dominio de producao.
- Nao dizer que dominio atualizou sem testar.
- Considerar cache do Cloudflare.
