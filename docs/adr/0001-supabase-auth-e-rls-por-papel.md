# Supabase Auth e RLS por papel para o painel

O app permanece estático no Vercel, então a autenticação do painel usa Supabase Auth e a autorização real fica no banco, por meio da relação `tokyo_admins` e policies RLS. O fluxo público continua podendo ler o cardápio ativo e criar pedidos de retirada, mas não pode ler ou alterar dados operacionais; essa escolha evita manter senha administrativa no cliente e preserva a arquitetura sem backend próprio nesta etapa.
