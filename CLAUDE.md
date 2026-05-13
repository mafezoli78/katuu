# Katuu — Contexto de Desenvolvimento

## Sobre o Projeto

App social baseado em presença física e disponibilidade momentânea.

- **Repositório:** [https://github.com/mafezoli78/katuu](https://github.com/mafezoli78/katuu)  
- **Stack:** React \+ TypeScript \+ Vite \+ Tailwind CSS \+ shadcn/ui \+ Supabase  
- **Supabase Project ID:** jhpxfvwhcxakzajioxiz  
- **Deploy:** Vercel → app.katuu.com.br  
- **Plataforma alvo:** Play Store \+ Apple Store (EXCLUSIVAMENTE nativo, sem web)

---

## Infraestrutura

### Supabase

- `net.http_post` requer `body` como `jsonb` (não `text`)  
- Dollar-quoting: usar `$func$` em vez de `$$` para evitar conflitos com caracteres especiais em secrets  
- `EXCEPTION WHEN OTHERS THEN NULL` em triggers para não quebrar operações principais  
- **Extensão pg\_net:** ativa (para triggers chamarem Edge Functions)

### Vercel

- Auto-deploy a cada push na branch `main` do GitHub  
- Domínio customizado: `app.katuu.com.br` via CNAME no Registro.br

### Capacitor (Android)

- `appId: 'com.katuu.app'`  
- `appName: 'Katuu'`  
- `webDir: 'dist'`  
- Projeto Android em: `C:\Users\fabri\Documents\katuu\android`  
- **Camera:** usa `@capacitor/camera` (câmera nativa, sem stream WebView)  
- **Geolocation:** usa `navigator.geolocation` com permissão via WebView (configurada no MainActivity.java)  
- **Deep Links:** configurados no AndroidManifest.xml para `com.katuu.app://` e `https://app.katuu.com.br`

### MainActivity.java

package com.katuu.app;

import android.Manifest;

import android.os.Bundle;

import android.webkit.GeolocationPermissions;

import android.webkit.WebChromeClient;

import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override

    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        requestPermissions(new String\[\]{

            Manifest.permission.CAMERA

        }, 1001);

    }

}

---

## Fluxo de Desenvolvimento Local

cd C:\\Users\\fabri\\Documents\\katuu

git pull origin main   \# sincroniza com GitHub

npm run build          \# compila React

npx cap sync android   \# copia build para Android

\# Depois: Android Studio → ▶ Run (ou Build APK)

**Nota:** `capacitor.config.ts` é local, não está no GitHub.

---

## Regras de Negócio

- **Presença:** 2 horas de duração  
- **Selfie:** obrigatória no check-in, câmera nativa, sem fallback de galeria  
- **Detecção de rosto:** face-api.js (apenas no browser/web, não no nativo)  
- **Conversas:** 1:1, efêmeras  
- **Selfies:** bucket privado `checkin-selfies`, signed URLs (1h expiração)  
- **RPCs:** usam `auth.uid()` internamente, frontend não passa ID do usuário  
- **Presença protegida:** não expira se houver chat ativo (`cleanup_expired_presences` verifica)  
- **Gênero:** obrigatório, 4 opções: Homem, Mulher, Não-binário, Outro  
- **Foto de perfil:** REMOVIDA — apenas inicial do nome no avatar  
- **Interesses:** wizard por categoria no onboarding, "Nenhuma delas" exclui outros da categoria  
- **Perfil completo:** nome \+ data\_nascimento \+ gender \+ 3 interesses mínimos

---

## Tabelas Principais

- `profiles` — dados do usuário (sem foto\_url em uso)  
- `presence` — check-in ativo  
- `conversations` — chats 1:1  
- `messages` — mensagens  
- `waves` — acenos  
- `user_blocks` — bloqueios  
- `user_mutes` — silenciamentos  
- `reports` — denúncias  
- `push_subscriptions` — subscriptions de notificação push  
- `interest_categories` \+ `interests` \+ `user_interests`

---

## Push Notifications

### Infraestrutura

- **Firebase Project:** katuu-app  
- **Edge Function:** `send-push` (Supabase) usando FCM V1 API  
- **Secrets configurados:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT`

### Triggers ativos

- `on_wave_received` → notifica destinatário do aceno  
- `on_wave_accepted` → notifica quem enviou o aceno  
- `on_new_message` → notifica destinatário da mensagem

### Frontend

- `src/hooks/useAutoPushSubscription.ts` — solicita permissão automaticamente após login  
- `src/hooks/usePushNotifications.ts` — hook para ativar/desativar manualmente  
- `public/sw.js` — Service Worker com cache management

### Status atual

- Web Push funcionando parcialmente (FCM token UNREGISTERED — tokens antigos)  
- **Pendente:** implementar FCM nativo via `@capacitor/push-notifications` para o app nativo

---

## Deep Links (em implementação)

### Supabase Redirect URLs configurados

- `https://app.katuu.com.br`  
- `com.katuu.app://login-callback`  
- `capacitor://localhost`

### AndroidManifest.xml

Intent filters adicionados para:

- `com.katuu.app://` (scheme customizado)  
- `https://app.katuu.com.br` (HTTPS)

### Pendente

- Testar confirmação de email abrindo no app  
- Implementar login Google via deep link

---

## Telas e Status

### ✅ Funcionando

- Auth (email/senha \+ Google no browser)  
- Onboarding (nome, data, gênero obrigatório, interesses wizard)  
- Location (geolocalização, seleção de local, selfie nativa)  
- Home (cards com selfie, aceno, swipe para bloquear/silenciar)  
- Chat (mensagens em tempo real)  
- Waves (acenos enviados/recebidos)  
- Profile (3 blocos: Perfil, Conta, Configurações)  
- Denúncia (card e chat, com bloqueio automático)  
- Tutorial

### ⚠️ Parcialmente funcionando

- Push notifications (infrastructure ok, entrega FCM pendente no nativo)  
- Deep links (configurado, não testado)

### ❌ Pendente

- Login Google no app nativo (abre navegador)  
- Confirmação de email no app nativo (abre navegador)  
- FCM nativo via @capacitor/push-notifications  
- Chat: layout com teclado (workaround atual com position:fixed)  
- Play Store: publicação

---

## Arquivos Importantes no Repositório

src/

  pages/

    Location.tsx       — fluxo de check-in

    Home.tsx           — feed de pessoas

    Chat.tsx           — lista e janela de chat

    Waves.tsx          — acenos

    Profile.tsx        — perfil reestruturado (3 blocos)

    Onboarding.tsx     — cadastro

  components/

    location/

      CheckinSelfie.tsx  — selfie (câmera nativa no Capacitor)

    chat/

      ChatWindow.tsx     — janela do chat (position:fixed)

    home/

      PersonCard.tsx     — card com swipe e denúncia

    shared/

      ReportModal.tsx    — modal de denúncia

  services/

    cameraService.ts   — câmera (nativa \+ browser)

  hooks/

    useAutoPushSubscription.ts

    usePushNotifications.ts

    useReport.ts       — denúncia \+ bloqueio automático

  types/

    gender.ts          — 4 opções: man, woman, non\_binary, other

  utils/

    profileCompletion.ts — verifica nome \+ data \+ gender \+ 3 interesses

public/

  sw.js              — Service Worker

  install.html       — página de instalação do APK

android/

  app/src/main/

    AndroidManifest.xml

    java/com/katuu/app/MainActivity.java

---

## Próximos Passos (em ordem de prioridade)

1. **Testar deep link** de confirmação de email no APK atual  
2. **Login Google nativo** — configurar `@capacitor/google-auth`  
3. **FCM nativo** — `@capacitor/push-notifications` substituindo Web Push  
4. **Chat com teclado** — refazer com `@capacitor/keyboard`  
5. **Publicar na Play Store**  
6. **Apple Store** (requer Mac \+ conta $99/ano)

---

## Observações Técnicas

- O projeto local está em `C:\Users\fabri\Documents\katuu`  
- Git configurado e autenticado com GitHub  
- Android Studio instalado (versão Panda 2 | 2025.3.2)  
- Node.js v24 instalado  
- Supabase CLI v2.75 instalado e linkado ao projeto  
- Docker Desktop instalado (necessário para alguns comandos Supabase)  
- **Lovable:** sem créditos — não usar  
- **Claude Code:** requer plano Max ($100/mês) — não disponível atualmente  
- Edição de código: direto no GitHub \+ salvar localmente \+ build manual

