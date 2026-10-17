# Flix Android · Cinema

Versão 0.2: navegação integrada ao site, sem barra nativa duplicada. O site
mantém favoritos e histórico no armazenamento local do WebView.

O observador de mídia usa AndroidX WebKit para receber somente posição,
duração e estado do vídeo, inclusive em frames de outros provedores. Não
extrai URLs de vídeo, cookies nem HTML. A API de comandos é restrita ao
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
downloads e os domínios publicitários identificados são bloqueados.

Não existe interface JavaScript/nativa de propósito geral. Certificados TLS são verificados
normalmente. Cookies de terceiros permanecem disponíveis para o player e
suas verificações. Só é solicitada a permissão de internet.

O workflow Android APK gera um APK de teste e executa testes de navegação,
toques que abrem popups no documento e em iframe, e reprodução de um vídeo
local após o bloqueio. Esses testes não confirmam que o provedor aceitará
a reprodução no dispositivo do usuário.

Build local: JDK 17, Gradle 8.9, Android SDK 35; executar
`gradle :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` nesta pasta.
O APK debug pode precisar ser desinstalado antes de uma atualização gerada
por outra máquina de build, devido à assinatura temporária de testes.
