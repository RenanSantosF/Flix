# Flix pessoal

Next.js para Vercel. Acesso por senha, catálogo e pesquisa TMDB opcionais. Sem token TMDB, exibe tela inicial de configuração.

## Publicação
1. Importe este repositório na Vercel como Next.js.
2. Configure `SITE_PASSWORD` (sua senha) e `SESSION_SECRET` (valor aleatório com pelo menos 32 caracteres) em Environment Variables.
3. Faça Deploy. O link `.vercel.app` será gerado automaticamente.
4. Depois adicione `TMDB_TOKEN` (API Read Access Token da TMDB) e faça Redeploy.

O código não inclui vídeos. Reprodução depende de fonte autorizada; a documentação da SuperFlixAPI não comprova licenças de distribuição. Não envie segredos para o GitHub.
