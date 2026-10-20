# Download do app e atualizações

- Quem abre o site no navegador vê a landing (`components/Landing.tsx`) com o botão
  **Baixar o app**. "Continuar no navegador" grava o cookie `flix-web` e abre o catálogo.
- `/baixar` redireciona para `releases/latest/download/Flix.apk` deste repositório.
- A cada push na main com testes verdes, o workflow Android publica o release
  `android-v<versionCode>` com o asset `Flix.apk` (assinado com a chave fixa).
- O app envia `FlixBuild/<versionCode>` no user agent; `components/UpdatePrompt.tsx`
  compara com `/api/app-version` e mostra o aviso.
- A partir da 0.25 (`FlixUpdater/1` no user agent), "Atualizar agora" baixa o APK
  dentro do app (`AppUpdater.java`) com barra de progresso e abre o instalador do
  Android. Na primeira vez o Android pede para permitir que o Flix instale apps.
  A 0.24 ainda abre `/baixar` no navegador.
- Para lançar uma versão nova do app, aumente `versionCode`/`versionName` em
  `android/app/build.gradle`.

## Chave de assinatura (uma vez)

Em GitHub → Settings → Secrets and variables → Actions → New repository secret:

- `FLIX_KEYSTORE_BASE64`: o conteúdo base64 do keystore.
- `FLIX_KEYSTORE_PASSWORD`: a senha do keystore (alias `flix`).

Sem esses segredos o build continua, mas o release de download não é publicado.
Guarde uma cópia do keystore fora do GitHub: sem ele não é possível publicar
atualizações que instalem por cima das versões já distribuídas.
