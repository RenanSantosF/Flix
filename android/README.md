# Flix Android · Recuperação de vídeo

Versão 0.16: compara e corrige o comportamento de conteúdo misto do WebView.
A versão anterior usava MIXED_CONTENT_NEVER_ALLOW; o teste sem bloqueios 0.14
usava ALWAYS_ALLOW. A nova configuração usa COMPATIBILITY_MODE, que permite
mídia passiva compatível com o navegador e mantém scripts/frames HTTP ativos
bloqueados. Quando o motor ativa WebViewMixedContentAutoupgrades, esse é o
modo que permite atualizar HTTP -> HTTPS; isso depende do WebView, não é uma
garantia do aplicativo. TLS, user-agent estável, cookies e contenção de pop-ups
são mantidos. about:srcdoc passa a ser aceito como about:blank, conforme a
integração WebView documentada pela Cloudflare.

O teste instrumentado compara o modo anterior com a configuração publicada:
um vídeo atribuído via HTTP falha sem conexão no NEVER_ALLOW, enquanto o
modo compatível solicita a mídia e reproduz H.264 real. O fixture aceita os
dois protocolos para não presumir uma flag do motor. Um script HTTP ativo
continua bloqueado e não recebe requisição. Isso comprova uma diferença do
app; ainda não demonstra que o bloqueio observado no provedor real era o
mesmo recurso. Pop-ups, PiP, retomada e recuperação 429 continuam cobertos.

O diagnóstico distingue atualização HTTPS de bloqueio HTTP e mostra tipo e
host do recurso bloqueado. CSP mostra diretiva/host quando presentes; avisos
Report-Only não são tratados como bloqueio. Somente 401 do caminho PAT da
Cloudflare e falhas DNS -2 de subdomínios de prova documentados vão para a
seção auxiliar; erros no domínio principal e outras respostas continuam
visíveis. Essas provas podem falhar durante uma verificação bem-sucedida.
Não são copiados URLs, caminhos, queries, tokens, cookies ou console bruto.

Versão 0.15: remove o checkbox e o modo sem bloqueios, pois a comparação no
aparelho também recebeu HTTP 429. A proteção de pop-ups volta a ser permanente.

O player alternativo observado no Chrome continha um handler de erro que chama
load/play novamente sobre a mesma fonte. O console repetiu erro 4 várias vezes
por segundo enquanto o vídeo permanecia em readyState 0. A espera da versão 0.13
controlava somente a tentativa do Flix; não segurava as tentativas do provedor.

Agora, quando um recurso GET já recebeu HTTP 429, novas solicitações
dessa mesma URL aguardam Retry-After no
worker de requisições do WebView. Ao final, retorna-se null para o Chromium
continuar a solicitação original: nenhum cliente, URL, Range, cookie, Referer,
UA ou corpo é substituído. Recursos sem 429 e fontes saudáveis não entram nessa
espera. O início da espera não depende do evento atrasado do vídeo; o
encerramento do iframe por recusa persistente exige a correlação com a mídia. A interface Android permanece livre; troca de fonte/contexto, saída do
app ou destruição cancelam o worker pendente. O prazo máximo aguardado é 5 min.

A tentativa do próprio player e a tentativa agendada pelo Flix compartilham o
mesmo orçamento: não é enviado load/play extra quando o provedor já aguarda.
Uma segunda recusa da fonte (ou prazo acima de 5 min) interrompe o iframe e
exibe Voltar aos servidores, sem novas requisições em loop nem fallback nativo.
A URL e o prazo ficam somente em memória para correlação; o limite por host
já existente do motor nativo continua persistido sem URLs/tokens.

Testes incluem um provedor simulado que recarrega o vídeo por conta própria
após cada erro: 429 -> espera -> H.264 real, e 429 -> espera -> 429 com iframe
encerrado e app responsivo. Isso corrige a repetição observada; não demonstra
que o provedor real aceitará a próxima requisição no aparelho.

Versão 0.13: uma fonte que recebe HTTP 429 pode ser retomada uma única vez no
próprio WebView, após o Retry-After observado (ou 60 s se ele estiver ausente).
O APK não precisa esperar um erro 4: relaciona o HTTP à fonte exata informada
pelo vídeo ainda em readyState 0. Antes, esse estado podia ficar carregando
indefinidamente, enquanto o tratamento de espera existia só no motor nativo.

A retomada preserva o documento e sua sessão. Não modifica URLs, cookies,
cabeçalhos ou anúncios; usa load/play do mesmo elemento após intenção de play.
Um 429 conhecido não é entregue ao decodificador como falha de codec.
Há no máximo uma tentativa automática por contexto, com espera de até 5 min.
Troca de fonte, vídeo pronto, pausa, anúncio visível, saída do app ou mudança
de contexto cancelam a retomada. A verificação final acontece no próprio frame.
Uma segunda recusa não inicia um loop nem outro cliente de rede.

Validação inclui 429 → espera → vídeo H.264 no mesmo documento; segunda recusa
sem loop nem abertura nativa; correlação exata e cancelamentos do observador.
Isso corrige o tratamento desse estado no app. Não comprova que o servidor
alternativo real vá liberar sua fonte após a espera; a validação no aparelho
continua necessária. A comparação no site parceiro retornou 404 e voltou a
exigir verificação humana ao renovar a sessão, portanto foi inconclusiva.


Versão 0.12 (diagnóstico): identifica host, tipo de recurso (quando observado),
código de conexão Chromium e templates específicos de erro JavaScript. O status
HTTP é relacionado à fonte atual mesmo sem erro 4. A fonte atribuída ao vídeo
passa somente à ponte Android local para correlação em memória, sem nova conexão.
Nenhum endereço completo, query, corpo, cookie, token ou mensagem bruta é exibido.
Símbolos de erro JavaScript são extraídos por padrões fechados; mensagens não
reconhecidas mantêm somente o tipo. Origem/linha são obtidas do próprio WebView.
Logs informativos não se tornam erros JavaScript por conter texto de exceção.

Esta versão melhora a evidência da 0.11, que estava genérica demais para localizar
o recurso com -6/429 e a exceção. Não altera motor, popup, sessão ou rede do player.

Versão 0.11 (diagnóstico): registra o estágio anterior ao motor nativo. O APK
mostra após 30 s sem início de reprodução o estado readyState/networkState
informado pelo vídeo, categorias de erros de console (HTTP misto, CORS, CSP,
interação, JavaScript) e erros de rede do WebView. HTTP de erro é associado à
fonte exata apenas em memória; o diagnóstico inclui o status, nunca a URL.
As categorias descrevem sinais observados, sem afirmar que são a causa.

O watchdog não recarrega, não inicia reprodução e não faz pedidos de rede.
Uma reprodução iniciada cancela o aviso; uma nova carga pode ser observada.
Contexto alterado invalida o timer. Recuperação nativa ativa ou falha definitiva
mantêm seu diagnóstico. No máximo 32 URLs de erro são retidas em memória por
contexto e cinco categorias aparecem. Não há gravação/exportação de HTML,
cookies, caminhos, queries, tokens ou mensagens brutas do console. O texto
copiado pelo site aceita até 1200 caracteres para não cortar essa evidência.

Quando um status visível mostra exatamente Loading ad, o observador registra
a etapa e não envia aquele vídeo ao fallback nem ao histórico do filme. Não
modifica, conclui ou pula o anúncio. Um rótulo oculto ou texto semelhante não
ativa essa proteção; a reprodução normal volta a ser observada após a transição.

Esta versão não é apresentada como correção do servidor alternativo: o teste
real no aparelho ainda é necessário para obter seu erro anterior ao fallback.

Versão 0.10: um erro 4 não entrega mais a fonte imediatamente ao motor nativo.
O observador aguarda cinco segundos de falha estável, deixando os handlers do
próprio player trocar uma fonte temporária ou retomar o carregamento. Uma nova
carga, metadados válidos ou reprodução cancelam a transferência pendente. Cada
nova carga recebe seu próprio prazo. O fallback só recebe uma fonte que ainda
esteja falhando ao final; não há novas requisições de sondagem nem liberação de
pop-ups. A recuperação de manifesto tardio continua após a primeira espera.

Testes cobrem a falha temporária recuperada pelo próprio player, o cancelamento
do timer antigo e uma falha persistente que só chega ao fallback após o prazo.
No emulador, um vídeo rejeitado pelo HTML é substituído pelo handler da página
e segue tocando sem nenhuma abertura nativa. Outros cenários mantêm a cobertura
do fallback, redirecionamentos, espera de 429 e PiP. O servidor alternativo real
continua dependendo de validação no aparelho; este ajuste não prova sua causa.

Versão 0.9: a transferência para o motor nativo descarrega todo o iframe do
provedor, em vez de apenas pausar seu HTMLVideoElement. O motor só inicia após
o documento principal confirmar o carregamento de about:blank, com token por
sessão. Scripts e pedidos periódicos do provedor deixam de concorrer com a
recuperação. O documento Flix mantém seus timers, histórico, controles e PiP.
Ao voltar, os servidores só recarregam por ação explícita do usuário.

Respostas HTTP 429 observadas pelo WebView compartilham o mesmo prazo por host
com o motor nativo: ele não faz um pedido imediato após a recusa original.
Respostas concorrentes não encurtam o prazo já conhecido. Contexto novo,
background ou destruição cancelam uma transferência pendente.

Testes instrumentados verificam o fim dos pedidos periódicos do iframe, a
continuidade do documento principal/histórico e 429 no WebView → espera sem
novo pedido → uma requisição nativa com vídeo H.264 real. São fixtures de
transporte; não comprovam disponibilidade do servidor alternativo real.

Versão 0.8: HTTP 429 é tratado como limite de requisições, com o domínio que
realmente respondeu após os redirects. Lê Retry-After em segundos ou HTTP-date
(com Date para compensar diferença de relógio). Se ausente/inválido, usa espera
inicial de 60 s, sem afirmar que o servidor será liberado nesse prazo.

O prazo por host é persistido em SharedPreferences (somente domínio e deadline).
Uma tentativa anterior ao prazo é interrompida localmente antes da conexão,
inclusive após recarregar o contexto ou reiniciar. Não são armazenados corpo
ou resposta HTTP 429, cookies, URLs assinadas ou tokens no controle de espera.

Há no máximo uma repetição automática por sessão de recuperação, após o prazo,
para esperas de até cinco minutos. Prazos maiores ou um segundo 429 são exibidos
para nova tentativa manual posterior. A tela exibe contagem regressiva e permite
voltar aos servidores; sair do app cancela a espera automática. 401/403 e outras
falhas não entram nesse retry. A disponibilidade continua a cargo do provedor.

Testes verificam Retry-After numérico/datas/relógios, recusa local durante a espera,
host final de um redirect, persistência, cancelamento de contexto e vídeo real
reproduzido depois de 429→espera→200, sem pedidos antecipados.

Versão 0.7: HTTP 301/302/303/307/308 é tratado como redirecionamento, seguindo
somente o Location retornado, até dez saltos. Corrige a recusa de HTTPS→HTTP
que fazia o Media3 receber HTTP 302 sem alcançar o arquivo. Endereços privados,
credenciais na URL, esquemas diferentes de HTTP(S) e ciclos são rejeitados antes
da próxima conexão. A validação DNS continua em todos os destinos, sem proxy.
Cookies/cabeçalhos são recalculados por destino; Cookie e Authorization do salto
anterior não são copiados. Políticas estritas omitem Referer no downgrade.

O manifesto permite transporte HTTP para o motor nativo porque os destinos de
mídia do provedor são dinâmicos. A fonte inicial da ponte continua limitada a
HTTPS; navegação do app, subframes e a política de conteúdo misto do WebView
continuam restritos a HTTPS. Requisições HTTP de mídia só partem do carregador
nativo a partir dos Locations ou recursos de playlist fornecidos pelo servidor.
O motor não executa HTML/JavaScript nem abre janelas. Não há alteração no sink
de pop-ups que já funciona. Não há alteração de certificados TLS de produção.

Testes de rede usam servidores locais HTTP e HTTPS, com certificado confiado
exclusivamente pelo cliente de teste, para comprovar HTTPS→302→HTTP, Range,
queries assinadas, destinos recusados, ciclos, limite e ausência de retry em 403.
O emulador também decodifica um vídeo real após uma resposta 302 do transporte
de teste usando o mesmo interceptor de redirecionamento da produção.

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

Requisições HTTPS nativas mantêm a verificação TLS; URLs de mídia e redirecionamentos
aceitam apenas HTTP(S) público, rejeitando destinos locais/privados inclusive em DNS e segmentos. Cookies são
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


### Conforto de reprodução (0.17)

Ao abrir a tela cheia, o aplicativo solicita paisagem com sensor e restaura a orientação anterior ao sair. Isso se aplica à superfície original do WebView e à recuperação Media3, sem recarregar a página. Em PiP, os controles ficam ocultos e a orientação é liberada até voltar ao vídeo.

A tela cheia oferece trava de toque, pausa/reprodução e saltos de 10 segundos. Deslizar verticalmente no quinto esquerdo ajusta apenas o brilho desta janela; no quinto direito, o volume de mídia. O brilho original volta ao sair. O meio continua disponível para os controles do provedor.

O histórico começa após progresso real, preserva o episódio anterior se a nova tentativa não iniciar e identifica o próximo episódio preparado ao terminar. O botão de remover usa uma área de toque de 44 px.

O botão de transmissão exibido pelo provedor não representa integração Google Cast do APK. O aplicativo ainda não contém um Cast Sender nativo.


### Controles e Google Cast (0.18)

Os controles usam vetores próprios, botão central circular e sobreposição com degradê. A trava exibe somente o botão de desbloquear durante 2,5 s. Depois, um toque apenas revela esse botão; o vídeo continua protegido. Os demais controles somem após 3 s.

Google Cast Sender usa o Default Media Receiver e o seletor nativo de dispositivos na mesma rede Wi-Fi. Há botões próprios nos filmes, séries, canais e tela cheia. O alerta de transmissão indisponível do domínio oficial também abre a integração nativa. Somente a fonte atribuída ao vídeo atual é solicitada ao frame, em resposta a uma ação explícita e com token descartável. Não há requisição extra de teste nem compartilhamento de cookies, referer ou HTML.

A fonte e a posição são enviadas ao receptor. O celular só é pausado após a TV informar reprodução. Fontes blob sem manifesto inequívoco, fontes com autorização restrita ao navegador, CORS ou codecs incompatíveis podem ser recusadas pela TV. Nesses casos, o app informa a falha e permite continuar localmente. A integração de descoberta e reprodução exige validação final em um dispositivo Google Cast físico; os testes automatizados cobrem a ponte, o contexto, os formatos e os controles locais.


### Interface única em tela cheia (0.19)

A entrada nativa em tela cheia agora envia ao frame ativo uma ordem explícita para assumir os controles. Isso cobre players com controles próprios (Fluid Player, JW, Plyr e Video.js), além dos controles padrão do navegador. A ocultação é restrita ao contêiner do vídeo escolhido e reversível ao sair. Uma sincronização imediata fornece tempo, duração e pausa mesmo quando não há um novo evento de reprodução.

O teste de interface inclui um contêiner que redesenha continuamente sua barra personalizada, entrada em tela cheia pausada, uso da barra do Flix, proteção de outro player e restauração inline.
