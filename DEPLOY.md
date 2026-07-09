# Deploy Tokyo Sushi

## 1. Supabase

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Cole e execute o conteúdo de `supabase-schema.sql`.
4. Copie:
   - Project URL
   - anon/public key

## 2. Configurar o app

Edite `config.js`:

```js
window.TOKYO_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_PUBLICAVEL_ANON",
  tables: {
    products: "tokyo_products",
    orders: "tokyo_orders",
    promos: "tokyo_promos"
  }
};
```

## 3. Vercel

1. Envie a pasta `sushi-retirada` para o GitHub.
2. No Vercel, importe o repositório.
3. Se o repositório tiver mais projetos, defina o root directory como `sushi-retirada`.
4. Build command: deixe vazio.
5. Output directory: deixe vazio.
6. Deploy.

## Links

- Cardápio: `/`
- Admin: `/admin.html`

## Importante

As regras do Supabase estão abertas para teste do MVP.
Antes de usar oficialmente, o admin precisa de login e políticas fechadas.
