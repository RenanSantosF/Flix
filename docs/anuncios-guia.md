# Guia: anúncios em vídeo no Flix

Antes de cada filme, série ou transmissão ao vivo aparece um vídeo de anúncio
com contador e botão “Pular”. No catálogo, algumas fileiras podem ter uma capa
patrocinada, marcada como “Patrocinado”. Você cadastra quantas campanhas quiser no painel; a cada exibição o
Flix sorteia uma delas. O site e o app Android usam o mesmo sistema, sem
atualizar o APK.

## Parte 1 — Ligar o painel (uma vez só, ~10 minutos)

Tudo na Vercel, no projeto do Flix:

1. **Banco de dados (grátis):** aba **Storage** → **Create Database** →
   **Upstash for Redis** → plano **Free** → região São Paulo (`gru1`) se houver →
   **Connect Project** → marque Production, Preview e Development.
   Isso cria sozinho as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
2. **Senha do painel:** **Settings** → **Environment Variables** → **Add**:
   - Name: `ADMIN_PASSWORD`
   - Value: uma senha com pelo menos 8 caracteres (não compartilhe).
3. **Novo deploy:** **Deployments** → no último → **⋯** → **Redeploy**.
4. Abra `https://flix-ebon-ten.vercel.app/admin` no celular e entre com a senha.
   Se aparecer “Falta configurar”, a tela diz qual passo faltou.

Sem campanhas ativas, os vídeos começam direto — nada quebra.

## Parte 2 — Cadastrar um anunciante seu (venda direta)

Você combina com a empresa um preço por mil exibições (CPM). Ex.: R$ 20 a cada
1.000 exibições.

1. **Receba o vídeo** do anunciante: MP4, de 15 a 30 segundos, de preferência
   até 10 MB e na horizontal (16:9).
2. **Hospede o vídeo:** Vercel → **Storage** → **Create Database** → **Blob**
   (grátis) → abra o Blob → **Upload** → escolha o MP4 → copie a **URL**
   (começa com `https://` e termina em `.mp4`). Qualquer outro link direto de
   MP4 em HTTPS também serve (não serve link do YouTube ou Google Drive).
3. **No painel** → **Campanhas** → **+ Nova campanha**:
   - **Nome:** ex. “Pizzaria Bella — outubro”.
   - **Anunciante:** o nome que vai no relatório.
   - **Tipo:** Vídeo próprio (link MP4). **Link:** a URL copiada.
   - **Peso no sorteio:** 1 é normal. Peso 2 aparece o dobro de uma de peso 1.
     O Resumo mostra a fatia de cada campanha em “No ar agora”.
   - **Preço por mil (R$):** o CPM combinado — o painel calcula “A cobrar”.
   - **Início / Fim:** opcional, para campanhas com período fechado.
   - **Limite de exibições:** ex. 10.000 se o cliente comprou um pacote; a
     campanha sai do ar sozinha ao atingir (“Meta atingida”).
   - **Pular após:** deixe -1 para usar o padrão dos Ajustes.
4. **Salvar.** O status fica **No ar** e já entra no sorteio.

### Cobrar o anunciante

Em cada campanha, **Copiar relatório** gera um texto pronto para WhatsApp ou
e-mail: exibições, quantos assistiram até o fim, pulos, valor a cobrar e a
contagem por dia.

O que conta como **exibição**: o vídeo realmente começou a tocar na tela de
alguém. Cada entrega de anúncio recebe um código assinado pelo servidor e só
conta uma exibição; reenviar o mesmo aviso não soma de novo. A contagem é feita
pelo próprio Flix, então serve como relatório honesto, não como auditoria
independente. “Até o fim” e “Pulados” mostram o engajamento.

## Parte 3 — Rede de anúncios (dinheiro sem vender espaço)

Para redes, o painel usa o link **VAST**, que é o padrão de anúncio em vídeo.

1. Crie conta de **Publisher** (editor de site) numa rede que tenha anúncio de
   vídeo **VAST / Pre-roll / In-stream**. Opções conhecidas sem ser Google:
   **HilltopAds**, **Adsterra** (o VAST pode exigir pedir ao gerente da conta),
   **Clickadilla**, **AdMaven**. Leia os termos de conteúdo de cada uma.
2. Cadastre o site `flix-ebon-ten.vercel.app` e aguarde a aprovação.
3. Crie uma unidade/zona do tipo **VAST** (às vezes chamada “Video”, “VAST tag”
   ou “In-Stream”) e copie o link (começa com `https://`).
4. No painel → **+ Nova campanha** → **Tipo:** Rede de anúncios (link VAST) →
   cole o link → **Preço por mil:** 0 (quem paga é a rede; o valor real fica no
   painel dela) → Salvar.

O Flix conta as exibições também no seu painel, para você comparar com o da
rede. Se a rede não tiver anúncio naquele momento, o filme começa direto.
Formatos interativos (VPAID) não são tocados; nesse caso também segue direto.
O link VAST precisa aceitar pedidos do navegador (CORS); as redes de vídeo
normalmente aceitam. Se nunca aparecer anúncio da rede, teste outra zona ou rede.

Você pode misturar: ex. Pizzaria peso 3 + Rede peso 1 → 75% / 25%.

## Parte 3b — Capa patrocinada no catálogo

Uma imagem no formato das capas de filme aparece em algumas fileiras da tela
inicial (na 4ª posição de fileiras alternadas, nunca em todas), com o selo
**Patrocinado**. Ao tocar, abre uma janela dentro do Flix com a imagem grande e
o texto do anunciante; ninguém é levado para outro site.

1. Peça ao anunciante uma imagem **vertical 2:3** (ex.: 600×900 px, JPG/PNG).
2. Envie ao Vercel Blob (mesmo caminho do vídeo) e copie a URL.
3. No painel → **+ Nova campanha** → **Tipo:** Capa patrocinada → cole a URL.
4. **Texto ao tocar na capa:** ex. “Peça pelo WhatsApp (11) 99999-0000 · 10%
   off com o código FLIX”.
5. Preço por mil, datas e limite funcionam como no vídeo.

Exibição conta quando metade da capa fica 1 segundo na tela. **Toques** mostra
quantas pessoas abriram o anúncio. Até 3 capas diferentes por visita.

## Parte 4 — Controle geral (aba Ajustes)

- **Vídeo antes de filmes e séries**, **Vídeo antes das transmissões ao vivo**
  e **Capas patrocinadas no catálogo:** liga/desliga cada lugar separadamente.
- **Intervalo mínimo entre vídeos de anúncio** (vale para filmes e ao vivo juntos): ex. 30 → quem viu um anúncio não vê
  outro pelos próximos 30 minutos naquele aparelho. 0 = a cada vídeo aberto.
- **Pular liberado após:** segundos até o botão “Pular” (0 a 30).

Para uma campanha específica: **Pausar/Ativar**, **Editar** ou **Excluir** em
Campanhas.

## Perguntas comuns

- **Troca de episódio mostra anúncio?** Não; só ao abrir o player na página.
- **Ao vivo tem anúncio?** Sim, ao abrir a transmissão. Trocar de canal na mesma tela não repete.
- **Esqueci a senha:** troque `ADMIN_PASSWORD` na Vercel e faça Redeploy. Todas
  as sessões abertas do painel saem automaticamente.
- **Os números somem?** Totais ficam guardados para sempre; a contagem diária
  fica por cerca de 13 meses. Excluir uma campanha tira ela do painel.
