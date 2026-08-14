# Tool: Playwright

Repositorio: https://github.com/microsoft/playwright

## Quando Usar

- Validar site, landing page, dashboard, formulario, menu mobile, CTA e fluxo principal.
- Reproduzir bug visual ou comportamento de navegador.
- Conferir console, screenshots, responsividade e navegacao real.
- Fazer auditoria antes de publicar.

## Como Usar No Fluxo

1. Rode a aplicacao localmente.
2. Abra as rotas principais.
3. Teste desktop e mobile.
4. Capture screenshot quando houver mudanca visual.
5. Verifique console e erros de rede.
6. Registre o resultado em `05-checklist-qualidade.md`.

## Criterios

- Texto legivel no celular.
- Nenhum menu transparente sobre conteudo.
- Botao e CTA clicaveis.
- Sem erro no console.
- Fluxo principal termina sem travar.

## Nao Usar Para

- Substituir teste unitario de regra de negocio.
- Simular seguranca ofensiva sem fluxo Mantis/Strix.
