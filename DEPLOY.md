# Deploy Tokyo Sushi

## 1. Supabase

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Cole e execute o conteúdo atualizado de `supabase-schema.sql`.
   - Em um banco já existente, execute o arquivo completo novamente para remover
     policies antigas de `tks_orders`, criar `tks_create_order(jsonb)` e
     criar as tabelas/RPCs relacionais do caixa.
   - Não use somente o schema antigo: ele permitia que o navegador enviasse
     preço, total e itens diretamente.
4. Copie:
   - Project URL
   - anon/public key

O projeto usa exclusivamente o namespace `tks_` (`tks_products`, `tks_orders`,
`tks_admins` etc.). O schema não renomeia, altera ou exclui tabelas antigas
`tokyo_*` ou de outros projetos. Se houver dados antigos que devam continuar,
faça uma importação controlada para as tabelas `tks_*` após confirmar a origem.

## 2. Configurar autenticação e administrador

1. No Supabase, habilite Email/Password em `Authentication > Providers`.
2. Crie o usuário do painel em `Authentication > Users`.
3. Copie o UUID desse usuário.
4. Após executar o schema, registre o UUID no SQL Editor:

```sql
insert into tks_admins (user_id)
values ('UUID_DO_USUARIO_AUTH');
```

Somente usuários registrados em `tks_admins` conseguem operar o painel.

### Login por e-mail e senha

1. No Supabase, habilite `Email` em `Authentication > Providers`.
2. Em `Authentication > URL Configuration`, inclua as URLs do Admin local e de produção:
   - `http://localhost:4173/admin.html`
   - `https://tokyo-sushi-7fu.pages.dev/admin.html`
   - `https://tokyosushi.estudiofernandes.com.br/admin.html`
   O código envia explicitamente o callback do Admin no pedido de recuperação.
   Isso é necessário porque o projeto Supabase é compartilhado com a Audiometria:
   não use o Site URL global da Audiometria como destino do Tokyo Sushi.
3. No primeiro acesso ao Admin, use `Criar uma conta nova`.
4. Se a confirmação de e-mail estiver habilitada, confirme o e-mail recebido e
   entre novamente com a senha.
5. Se for transformar um usuário existente em acesso por senha, use
   `Esqueci minha senha` com o mesmo e-mail e defina uma senha pelo link recebido.
   O link deve abrir `/admin.html`, nunca a Audiometria.
6. Copie o UUID do usuário em `Authentication > Users` e registre-o no SQL Editor:

```sql
insert into tks_admins (user_id)
values ('UUID_DO_USUARIO_AUTH');
```

O cadastro cria a conta no Supabase Auth, mas não concede acesso administrativo
automaticamente. O usuário precisa estar em `tks_admins`.

O fluxo Google não é usado pelo Tokyo Sushi. O provedor Google do projeto
Supabase compartilhado não deve ser desabilitado sem avaliar o sistema de
Audiometria que utiliza o mesmo projeto.

## 3. Configurar o app

Edite `config.js`:

```js
window.TOKYO_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_PUBLICAVEL_ANON",
  tables: {
    products: "tks_products",
    orders: "tks_orders",
    promos: "tks_promos",
    complements: "tks_complements",
    cashSessions: "tks_cash_sessions",
    cashMovements: "tks_cash_movements"
  }
};
```

## 4. Cloudflare

1. O projeto Pages criado para este sistema é `tokyo-sushi`; a URL provisória atual é
   `https://tokyo-sushi-7fu.pages.dev`.
2. Publique somente os arquivos públicos da raiz no Cloudflare Pages/Sites; não envie
   `supabase/.temp`, `.playwright-cli` ou arquivos de ambiente.
3. Use configuração estática: sem build command e com a raiz do projeto como output.
4. Cadastre o domínio personalizado `tokyosushi.estudiofernandes.com.br` no projeto.
5. Confirme o DNS/CNAME indicado pelo Cloudflare e aguarde o certificado SSL.
6. Após publicar, valide `/`, `/admin.html`, PWA e o login por e-mail usando a URL HTTPS
   definitiva.

## Links

- Cardápio: `/`
- Admin: `/admin.html`

## PWA e alertas

- O cardápio e o Admin possuem manifest e podem ser instalados no celular ou no desktop quando publicados em HTTPS; `localhost` também é aceito para testes.
- No Admin, use `Instalar app` para instalar e `Ativar alertas` para permitir avisos de novos pedidos enquanto o painel/PWA estiver ativo.
- O service worker já suporta notificações Push e clique para retornar ao Admin. O projeto agora inclui a inscrição de dispositivos e o Worker `tokyo-sushi-push` para alertas com o aplicativo totalmente fechado. Para ativar o fluxo, aplique a migration `supabase/migrations/20260811090000_tks_push_notifications.sql` e grave o endpoint/segredo do Worker em `tks_push_config` pelo SQL Editor; não coloque secrets no site.

O painel não possui senha fixa no código. O acesso usa a conta criada no Supabase Auth.

## Importante

- A chave `anon/public` pode aparecer no cliente; ela não substitui RLS.
- Nunca coloque a chave `service_role` em `config.js` ou em qualquer arquivo público.
- Execute o schema atualizado para remover policies antigas e criar a função
  transacional `tks_create_order(jsonb)`.
- Depois da migração, teste anonimamente que pedidos não podem ser lidos,
  alterados ou excluídos diretamente. A criação pública deve ocorrer somente
  pela função, com preço e adicionais recalculados no banco.
- Faça o teste em uma janela controlada e sem dados pessoais reais. Não remova
  pedidos de produção para validar segurança.
- Antes de publicar o PDV/caixa atualizado, confirme que o schema completo foi
  aplicado e que um administrador consegue abrir caixa, registrar movimento,
  criar pedido pelo PDV e fechar o caixa com valor contado.
