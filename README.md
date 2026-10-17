# Flix

Projeto Next.js para Vercel sem login. Catálogo e busca TMDB ativados por `TMDB_TOKEN`.

## Publicação
1. Importe o repositório na Vercel.
2. Faça deploy e copie o domínio gerado `.vercel.app`.
3. Crie sua chave TMDB em https://www.themoviedb.org/settings/api.
4. Em Vercel > Project > Settings > Environment Variables, adicione `TMDB_TOKEN` com o API Read Access Token.
5. Faça Redeploy.

O catálogo TMDB não fornece vídeos. Reprodução requer fontes autorizadas. Não envie o token ao GitHub.

## Player filtrado (experimental)

O modo Filtrado busca somente documentos HTML de reprodução da SuperFlixAPI,
remove as assinaturas de publicidade observadas e mantém o documento isolado
por sandbox no iframe e na resposta HTTP. Não encaminha cookies nem credenciais
do visitante ao provedor. Verificações humanas e recusas de acesso encerram a
tentativa; o modo não tenta contorná-las. O provedor pode bloquear requisições
do servidor ou depender de recursos incompatíveis com essa filtragem.

Os demais modos continuam disponíveis no seletor do player. A filtragem não
garante a reprodução nem remove anúncios embutidos no próprio vídeo.

Validação (Node.js 22.6 ou superior): `npm test` e `npm run build`.
