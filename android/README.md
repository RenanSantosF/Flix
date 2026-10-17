# Flix Android (experimental)

Cliente Android 8+ para o Flix pessoal, usando a mesma SuperFlixAPI. No app, o
site identifica o token `FlixAndroid/1.0` do user-agent e renderiza o iframe
direto. Esse token é apenas uma preferência de renderização, não autenticação.

Novas janelas são consumidas por WebViews invisíveis, sem JavaScript nem
acesso à rede, e destruídas em até dois segundos. Navegações da página
principal para fora do domínio Flix, protocolos de abertura de outros apps,
downloads e os domínios publicitários identificados são bloqueados.

Não existe ponte JavaScript/nativa. Certificados TLS são verificados
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
