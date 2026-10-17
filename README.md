# Flix

Aplicativo pessoal Next.js/Android. Catálogo e busca de filmes e séries via TMDB
(`TMDB_TOKEN`, somente no servidor); reprodução e programação via SuperFlixAPI.

## Player

Um único embed oficial, sem modos experimentais nem entrada de URL direta.
Séries usam `/serie/{TMDB}/{temporada}/{episodio}#noEpList`, com apenas um
seletor de episódios no Flix. Filmes usam `/filme/{TMDB}#noLink`.
A escolha de servidores tem altura maior; ao detectar vídeo no Android,
a área volta à proporção de reprodução. As permissões do iframe seguem a
integração documentada pelo provedor. Pop-ups são contidos pelo cliente Android.
O navegador comum usa o iframe oficial e as próprias regras de pop-up do navegador.

## Canais e esportes

`/ao-vivo` é uma aba principal e tem acesso destacado no início.
`/api/live` consulta `/lista?category=canais&format=json` e
`/lista?category=eventos&format=json`, com cache de 60 segundos e timeout.
Busca por canal/time/competição, categorias derivadas dos canais, canais
favoritos locais, agenda e filtro de eventos explicitamente marcados ao vivo.
Horários com offset são exibidos em Brasília; datas sem fuso ficam como texto
do provedor. Nunca inferimos que um jogo está ao vivo só pelo horário.

URLs de reprodução vêm da resposta oficial e precisam pertencer ao domínio
SuperFlixAPI HTTPS. `play_event_url` preserva os canais vinculados ao evento.
Nenhum endpoint de vídeo é adivinhado e não há proxy de HTML/stream.
Respostas inválidas ou recusas não se tornam listas vazias silenciosas.
Se a consulta falhar, o usuário pode tentar a página de canais/agenda do próprio
provedor dentro do player protegido do app. A disponibilidade e a permissão de
embed dessas páginas dependem do provedor.

Limite de validação: as consultas do ambiente de desenvolvimento retornaram
HTTP 403. Os testes de normalização usam fixtures baseadas na documentação,
não respostas reais gravadas. Conferir formato e reprodução do catálogo real
em um dispositivo/conexão aceitos pelo provedor. O servidor alternativo é
controlado pelo provedor; testes sintéticos de compatibilidade não comprovam
sua disponibilidade real.

## Publicação e validação

Importar o repositório na Vercel e configurar `TMDB_TOKEN` com um Read Access
Token da TMDB. O token nunca deve ir para o cliente ou para o GitHub.
`npm test` e `npm run build` (Node.js 22.6+). O workflow Android também executa
unitários, lint, testes de pop-ups síncronos/assíncronos, retomada, PiP e duração
de transmissão ao vivo; gera APK e relatórios. Ver `android/README.md` para assinatura.
