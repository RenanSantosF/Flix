# Flix Android · Recuperação de vídeo

Versão 0.6: o motor mantém o Referer conforme a política declarada no documento
(sem fragmento), o Origin quando o vídeo declara CORS e a seleção de cookies
correspondente a `crossorigin`. O endereço do frame precisa ter a mesma origem
autenticada pelo WebView. Cabeçalhos são recalculados em cada destino/redirect;
nenhum caminho, query ou cookie é exibido no diagnóstico ou enviado ao site.

Quando uma URL HTTPS sem extensão fornece um manifesto HLS/DASH, o primeiro
decodificador pode interpretá-la como arquivo comum. O app reconhece o manifesto
pelos bytes já lidos nessa tentativa e seleciona o parser correto uma única vez.
Não realiza sondagens de endpoints nem repete recusas HTTP. MIME sozinho não
transforma HTML de erro/verificação em manifesto.

O erro HTTP/formato/codec nativo fica preservado: eventos repetidos do WebView
não podem trocá-lo por “esta fonte já foi tentada”. O diagnóstico mostra apenas
versões, domínios, tipo/formato e códigos/mensagens fixas, sem URLs assinadas.

Versão 0.5: uma fonte blob pode usar um manifesto recente já solicitado pelo
próprio frame, somente com um vídeo e uma fonte inequívoca; fontes tardias podem
ser reconhecidas nos cinco segundos posteriores ao erro.

Versão 0.4: remove a lista de bloqueio por domínio das requisições internas
à página do player. Ela também bloqueava scripts/frames que podem participar
da liberação da mídia. As novas janelas continuam nos mesmos WebViews
invisíveis, sem rede nem scripts; navegação principal externa, intents e
downloads continuam bloqueados. Não há carregamento de páginas de anúncio
em segundo plano. O teste de regressão carrega uma dependência de um host
antes bloqueado e comprova que o vídeo segue tocando e seu popup é contido.

Além disso, quando um HTMLVideoElement retorna MEDIA_ERR_SRC_NOT_SUPPORTED (4),
o app pode tentar o mesmo recurso de mídia com Media3/ExoPlayer, preservando
posição, histórico, pausa e PiP. A interface normal do site e os servidores que
já funcionam continuam com o WebView. Não há um seletor extra de reprodução.

O src/currentSrc ou source[src] já atribuído ao vídeo com erro é usado.
Não são descobertos endpoints, extraídos manifestos de páginas protegidas nem
contornadas verificações. Blobs sem uma fonte ou manifesto HTTPS inequívoco não são recuperados.
O link passa somente da página para o decodificador local; nunca vai ao site,
logs, analytics ou a um servidor de extração.

As requisições nativas mantêm TLS, rejeitam protocolos inseguros e destinos
locais/privados, inclusive em DNS, segmentos e redirecionamentos. Cookies são
selecionados novamente por domínio a cada requisição; não existe um cabeçalho
Cookie global. O Referer segue a política do documento; o destino recebe apenas o contexto permitido por ela.
Uma recusa HTTP não é contornada nem repetida automaticamente. Há no máximo
duas fontes diferentes tentadas por sessão, sem repetição após falha HTTP ou erro definitivo (há uma correção de parser quando os bytes comprovam um manifesto).

Validação: fixture local de vídeo real H.264, rejeitada pelo HTML por um MIME
incompatível, é reproduzida pelo motor nativo com retomada e PiP. Isso verifica
a recuperação de formato, não comprova que o servidor alternativo real esteja
disponível: ele pode responder com um erro HTTP ou uma fonte inválida.
Media3 1.6.1 mantém compatibilidade com o compileSdk 35 e AGP existentes.

Versão 0.3: canais e agenda, player simplificado, área de servidores maior e
suporte a duração infinita de transmissões ao vivo no observador/PiP.
Sessões ao vivo não recebem retomada de filmes nem entram no histórico VOD.
Os contextos de mídia continuam restritos à rota correspondente no Flix.

Fluxos de abertura assíncrona de janelas recebem o mesmo WebView invisível,
sem rede nem scripts, usado nos pop-ups de clique. Isso evita retornar uma
janela nula a provedores que aguardam essa abertura. A janela nunca é mostrada.
Os testes cobrem essa compatibilidade; não confirmam o servidor alternativo real.

Versão 0.2: navegação integrada ao site, sem barra nativa duplicada. O site
mantém favoritos e histórico no armazenamento local do WebView.

O observador de mídia usa AndroidX WebKit para receber somente posição,
duração e estado do vídeo, inclusive em frames de outros provedores. URLs de vídeo só passam ao
decodificador local no caso de erro 4; cookies e HTML não são expostos ao site. A API de comandos é restrita ao
documento principal do domínio Flix; frames externos só podem informar
números de reprodução. WebViews antigos sem scripts no início do documento
têm suporte limitado aos frames da mesma origem.

A posição salva é restaurada após o carregamento dos metadados. A janela
flutuante mantém o WebView ou a tela cheia existentes, sem recarregar o
player. Sair com o botão/gesto Home durante a reprodução abre PiP; também há
um botão no player. O Android precisa permitir PiP. Fechar a janela pausa a
reprodução. Não há serviço de reprodução com a tela bloqueada.

Os testes instrumentados incluem retomada da posição, observação de mídia
e vídeo continuando em PiP ao usar Home, além dos testes de pop-ups.

Cliente Android 8+ para o Flix pessoal, usando a mesma SuperFlixAPI. No app, o
site identifica o token `FlixAndroid/1.0` do user-agent e renderiza o iframe
direto. Esse token é apenas uma preferência de renderização, não autenticação.

Novas janelas são consumidas por WebViews invisíveis, sem JavaScript nem
acesso à rede, e destruídas em até dois segundos. Navegações da página
principal para fora do domínio Flix, protocolos de abertura de outros apps,
downloads são bloqueados. Requisições internas HTTPS não recebem mais
bloqueio indiscriminado por domínio.

Não existe interface JavaScript/nativa de propósito geral. Certificados TLS são verificados
normalmente. Cookies de terceiros permanecem disponíveis para o player e
suas verificações. Só é solicitada a permissão de internet.

O workflow Android APK gera um APK de teste e executa testes de navegação,
toques que abrem popups no documento e em iframe, e reprodução de um vídeo
local após o bloqueio. Esses testes não confirmam que o provedor aceitará
a reprodução no dispositivo do usuário.

Build local: JDK 17, Gradle 8.9, Android SDK 35; executar
`gradle :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` nesta pasta.
O APK do CI usa assinatura debug temporária. O APK distribuído da versão
0.2 em diante é reassinado com uma identidade persistente, mantida fora do
repositório. Para futuras entregas, reutilizar o backup privado
`Flix-Android-signing-private.zip`, que contém as instruções de assinatura,
e incrementar `versionCode`. Nunca publicar esse backup no GitHub.
O workflow também fornece `output/apksigner.jar` para verificar e assinar.
A primeira migração da versão 0.1 exige desinstalar a assinatura antiga;
atualizações assinadas com a identidade persistente preservam os dados.
