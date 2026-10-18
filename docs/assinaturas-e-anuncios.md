# Contas, assinatura e anúncio antes da reprodução

## Estado desta entrega

A versão 0.20 amplia a descoberta e personaliza a apresentação no Android.
Não ativa cadastro, cobrança ou anúncios comerciais. Não há serviço de
autenticação, banco de assinaturas nem conta de anunciante configurados no
projeto. Nenhuma compra deve ser simulada como uma assinatura válida.

## Experiência desejada

- Visitante: navega no catálogo sem cadastro. Ao tocar em Assistir, vê um anúncio
  de vídeo e, quando a campanha permitir, o botão oficial Pular anúncio. Só
  depois do evento de conclusão/skip do SDK carregamos o conteúdo.
- Assinante ativo: entra com e-mail e senha e inicia o conteúdo sem anúncios do
  Flix. Histórico e Minha lista podem ser sincronizados na conta.
- Oferta junto ao anúncio: “Sua sessão, sem intervalos. Assine o Flix por
  R$ [mensalidade]/mês e assista sem os anúncios do Flix.” Mostrar também
  renovação mensal, condições e cancelamento antes do pagamento.
- Não cobrar duas vezes pela mesma finalidade. O pagamento mensal pode ser a
  condição para ativar a conta; não presumimos uma taxa extra de cadastro.
- Se a assinatura expirar, permitir login, recuperação de senha e acesso ao
  gerenciamento da assinatura. A reprodução volta ao fluxo de visitante.

## Dependência do conteúdo

Confirmar com o provedor e os titulares os direitos de reprodução comercial,
uso das imagens e monetização. A documentação de embed não constitui, por si
só, uma licença comercial. Não há endpoint documentado para eliminar anúncios
do provedor ou substituir sua interface no navegador comum.

O plano só pode prometer ausência de **todos** os anúncios quando a fonte de
conteúdo também permitir isso por contrato e integração. Até lá, “sem anúncios
do Flix” é o escopo honesto. Um iframe público continua acessível fora do app;
ocultar um botão ou salvar `premium=true` no dispositivo não protege conteúdo.
Para controle efetivo de acesso, a origem licenciada precisa validar uma sessão
ou autorização de reprodução emitida pelo servidor.

## Autenticação e ativação após pagamento

Proposta: Supabase Auth + Postgres para usuários/dados e Stripe Billing para
assinatura mensal. A escolha do gateway e seus meios de pagamento deve ser
confirmada antes de implementar o checkout.

1. Criar projeto Supabase, configurar domínio, URLs permitidas de retorno e
   envio de e-mails de convite e recuperação. Não armazenar senha na aplicação.
2. Usar o cliente SSR oficial no Next.js, cookies de sessão e validação da
   identidade no servidor. Rotas de conta e benefícios precisam verificar a
   sessão; a aparência da página não determina autorização.
3. Para exigir pagamento antes de criar conta: criar um pedido pendente no
   backend e abrir checkout de assinatura. Não habilitar cadastro público
   irrestrito no Supabase.
4. Validar a assinatura criptográfica do webhook sobre o corpo bruto recebido.
   Registrar ID de evento para idempotência. Conferir produto/preço, moeda,
   modo live/teste, pedido e status de pagamento. A URL de retorno do checkout
   nunca libera acesso por conta própria.
5. Após confirmação de pagamento, provisionar a conta pelo backend e enviar
   convite oficial para verificação do e-mail e definição de senha. Quem
   fechar o checkout antes do retorno ainda recebe a ativação pelo webhook.
6. Manter uma associação imutável entre usuário, cliente e assinatura; não
   reassociar uma conta existente só porque o checkout informou o mesmo e-mail.
   Uma nova compra para conta existente deve exigir sessão autenticada ou
   confirmação por link seguro para essa conta.
7. Tratar renovação, falha, cancelamento, reembolso e expiração por eventos do
   gateway e reconciliação periódica. Falha de pagamento não pode conceder
   período ilimitado. Permitir cancelamento no portal do cliente.
8. Tabelas sugeridas: profiles, subscriptions, checkout_orders, webhook_events,
   favorites e watch_progress. RLS permite ao usuário ler seus próprios dados;
   somente backend pode alterar assinatura/pagamentos. Segredos administrativos
   nunca vão para o navegador, APK, repositório ou parâmetros de URL.
9. Unificar o histórico local com o da conta na primeira entrada, sem apagar
   progresso mais recente. Logout encerra a sessão e troca a reprodução para
   o fluxo de visitante; não remove a possibilidade de gerenciar a conta.

Configuração necessária, em ambiente protegido: URL e chave pública do
Supabase, chave administrativa somente no servidor, chaves do gateway,
segredo do webhook e ID do preço mensal. Não enviar chaves secretas pelo chat.

## Anúncios de vídeo com botão Pular

Google IMA é um SDK de reprodução/medição de publicidade. **Instalá-lo não
aprova o app em uma rede, não fornece campanhas pagantes e não garante receita.**
Precisamos de conta de publisher aprovada, inventário aceito e uma tag VAST/VMAP
de produção emitida por um ad server/rede que aceite este conteúdo e aplicativo.

1. Abrir conta com rede/ad server compatível e cadastrar site/aplicativo e
   inventário de vídeo. Confirmar elegibilidade e condições de monetização.
2. Criar unidade de vídeo com campanha pulável e obter URL VAST/VMAP. A campanha
   define se e quando é permitido pular; não forçar um contador de cinco
   segundos nem esconder/replicar o botão do SDK.
3. Integrar IMA HTML5 no site e IMA Android no app, respeitando suas regras de
   clique, consentimento, medição e abertura do anunciante. A contenção atual de
   pop-ups não deve interceptar o clique explícito no anunciante de uma nova
   integração oficial. Isso exige caminho próprio testado, sem liberar pop-ups
   de qualquer página.
4. Reservar player de anúncio separado. Inicializar no gesto de Assistir em
   dispositivos móveis. Não carregar o iframe do filme simultaneamente ao
   anúncio nem enviar progresso de anúncio ao histórico de filmes.
5. O servidor determina se a conta tem benefício ativo. Visitante/conta sem
   benefício segue anúncio; assinante não solicita anúncio ao SDK.
6. Após `CONTENT_RESUME_REQUESTED` e encerramento do anúncio, liberar o player de
   conteúdo; lidar com skip, fim, sem inventário, timeout e erro, uma única vez.
   Definir política de indisponibilidade para não prender usuário em loading.
   Um temporizador JavaScript não prova que uma impressão foi válida.
7. Começar com tags oficiais **de teste**, sem receita e sem cliques incentivados.
   Só trocar por tags comerciais após validação e aprovação da conta.
8. Testar rotação, PiP, tela cheia, voltar, perda de rede e troca de episódio.
   Adiar o início de Cast do conteúdo até encerrar o anúncio quando aplicável.
   Configurar consentimento e política de privacidade conforme os dados e a
   jurisdição da operação; não coletar identificadores antes dessa definição.

No iPhone, anúncios HTML5 puláveis têm requisitos específicos de reprodução
inline. Não presumir que o mesmo pedido de tela cheia do Android funcione ali.

## Referências oficiais

- [Supabase: cliente SSR com Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Stripe: eventos de assinatura](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Google IMA: integração HTML5](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/get-started)
- [Google IMA: anúncio pulável em dispositivos móveis](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/skippable-ads)
- [Google IMA: tags para testes](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags)

## Decisões para ativar a próxima etapa

Mensalidade e moeda; gateway/conta de recebimento; projeto de autenticação;
autorização comercial e oferta de fonte sem anúncios pelo provedor; rede de
publicidade e tag VAST/VMAP aprovada. Sem esses itens, manter o app utilizável e
sem cobranças ou promessas de assinatura inexistente.
