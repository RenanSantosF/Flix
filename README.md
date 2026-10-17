# Flix

Aplicativo pessoal Next.js/Android. Catálogo e busca de filmes e séries via TMDB
(`TMDB_TOKEN`, somente no servidor); reprodução e programação via SuperFlixAPI.

## Player

Um único embed oficial, sem modos experimentais nem entrada de URL direta.
Séries usam `/serie/{TMDB}/{temporada}/{episodio}#noEpList`, com apenas um
seletor de episódios no Flix. Filmes usam `/filme/{TMDB}#noLink`.
A escolha de servidores tem altura maior; ao detectar vídeo no Android,
a área volta à proporção de reprodução. As permissões do iframe seguem a
integração documentada pelo provedor. Pop-ups são contidos pelo cliente Android. A partir da versão 0.4, uma fonte
HTTPS rejeitada pelo HTML com erro 4 pode ser tentada automaticamente pelo
motor Media3 local, sem trocar o provedor nem mostrar opções experimentais.
O APK bloqueia a abertura de janelas e navegação externa, preservando as
requisições internas que o provedor usa para preparar a mídia.
A versão 0.5 também aceita um manifesto HLS/DASH já solicitado pelo próprio
frame quando o vídeo falha com uma fonte `blob:`. A recuperação exige um único
vídeo e um único manifesto recente e tenta novamente por até cinco segundos
se a fonte chegar depois do erro. Não consulta endpoints extras nem adivinha links.
Fontes ambíguas e recusas HTTP continuam sendo apresentadas como falhas.
O aviso inclui diagnóstico copiável com versão do APK/WebView, domínio do frame,
tipo de fonte e motivo fixo; nenhum caminho, query, cookie ou token é exibido.
O navegador comum usa o iframe oficial e as próprias regras de pop-up do navegador.

## Canais e esportes

`/ao-vivo` é uma aba principal e tem acesso destacado no início.
`/api/live` consulta `/lista?category=canais&format=json` e
`/lista?category=eventos&format=json`, com cache de 60 segundos e timeout.
Busca por canal/time/competição, categorias derivadas dos canais, canais
favoritos locais, agenda e filtro de eventos explicitamente marcados ao vivo.
Horários com offset são exibidos em Brasília; datas sem fuso mantêm o horário
informado pelo provedor, com data e hora legíveis. Nunca inferimos que um jogo está ao vivo só pelo horário.

URLs de reprodução vêm da resposta oficial e precisam pertencer ao domínio
SuperFlixAPI HTTPS. `play_event_url` preserva os canais vinculados ao evento.
Nenhum endpoint de vídeo é adivinhado e não há proxy de HTML/stream.
Respostas inválidas ou recusas não se tornam listas vazias silenciosas.
Se a consulta falhar, o usuário pode tentar a página de canais/agenda do próprio
provedor dentro do player protegido do app. A disponibilidade e a permissão de
embed dessas páginas dependem do provedor.

Validação: a rota do backend consultou o catálogo público real com HTTP 200
(327 canais e 265 eventos em 17/10/2026). Os campos `logo_url`, `embed_url`,
`start_time`, `category` e `embeds[].provider` foram conferidos na resposta real
e têm teste de regressão. A disponibilidade do catálogo muda com a programação.
A página de reprodução exige verificação humana neste ambiente; não foi contornada. O servidor alternativo é
controlado pelo provedor; testes sintéticos de compatibilidade não comprovam
sua disponibilidade real.

## Publicação e validação

Importar o repositório na Vercel e configurar `TMDB_TOKEN` com um Read Access
Token da TMDB. O token nunca deve ir para o cliente ou para o GitHub.
`npm test` e `npm run build` (Node.js 22.6+). O workflow Android também executa
unitários, lint, testes de pop-ups síncronos/assíncronos, retomada, PiP e duração
de transmissão ao vivo; gera APK e relatórios. Ver `android/README.md` para assinatura.
