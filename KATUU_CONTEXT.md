# KATUU — Contexto do Projeto (Claude Projects)

> Fonte da verdade do projeto Katuu no Claude Projects. Atualizar ao final de
> cada sessão significativa.
> **Versão do doc: 4.1 | Data: 2026-06-15 (sessão noite) | App: 4.0.3**
>
> Companheiros obrigatórios deste arquivo no Projects:
> - `snapshot_db.md` — snapshot do banco. **Nome estável; a data de modificação
>   indica a versão.** É a fonte de verdade do schema/funções/policies; as
>   migrations em `supabase/migrations/` estão DEFASADAS. Sempre que este doc
>   citar um fato do banco, ele vale conforme o `snapshot_db.md` mais recente.
> - `CLAUDE.md` (na raiz do repo) — instruções que o Claude Code lê sozinho.
> - Inventário Manus mais recente (quando houver).

---

## 1. Identidade

- **App:** Katuu — social de presença física efêmera ("O agora é presente").
- **Plataforma:** Android via Capacitor (iOS futuro). O app web NÃO existe como produto — o domínio serve só páginas estáticas.
- **Stack:** React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase. Roteamento: **react-router-dom v6** (Manus já alucinou "Wouter" — ignorar). TanStack Query instalado, mas hooks de presença não o usam.
- **Repositório:** `mafezoli78/katuu` (o repo `katuu_app` é o ANTIGO, abandonado).
- **Supabase:** projeto `jhpxfvwhcxakzajioxiz` | **App ID:** `com.katuu.app`.
- **Local:** `C:\Users\fabri\Documents\katuu` (Windows + PowerShell).
- **Versão:** fonte única é `src/version.ts` (objeto `version` + `APP_VERSION`; AppHeader puxa sozinho). Alinhar `build.gradle` (versionName/versionCode) + tag git a cada marco. ⚠️ `package.json` ainda diz `name: vite_react_shadcn_ts, version: 0.0.0` (resquício Lovable) — não é fonte de nada.
- **Build APK:** `npm run build` → `npx cap sync android` → Android Studio (`JAVA_HOME` = jbr do Android Studio). APK em `android\app\build\outputs\apk\debug\`.
- **Vercel:** projeto **katuu-vercel**, domínio `app.katuu.com.br` (duplicado `katuuapp` foi deletado). O APK NÃO depende do site (sem `server.url` no capacitor.config — bundle local).
- **Email:** SMTP via Resend.

### Fix de build obrigatório (após cada `npm install`)
`node_modules/@capacitor-community/camera-preview/android/build.gradle` linha ~39:
`getDefaultProguardFile('proguard-android.txt')` → `proguard-android-optimize.txt`.

### Google OAuth
- Web Client ID: `218022107605-ca7duh6mt7k9jdii3tgtaakfr6co0tk1...` (no capacitor.config, plugin SocialLogin)
- Android Client ID: `218022107605-8sjj4pcu673jjdv925anoar1s8disoja...`
- Redirect autorizada: `https://jhpxfvwhcxakzajioxiz.supabase.co/auth/v1/callback`
- SHA-1 debug: `E2:60:0E:4F:64:B2:0D:BA:01:75:C1:6C:45:60:3F:07:95:68:D6:96`

---

## 2. Fluxo de trabalho — três trilhos (NOVO, 15/06)

A partir desta data o trabalho se divide em três trilhos, cada ferramenta no que faz melhor:

0. **Edição manual direta → mudanças de 1-2 linhas bem definidas** (posição e conteúdo já conhecidos, ex.: adicionar um `emailRedirectTo` num `options` já localizado). Faz no editor, sem gastar cota do Claude Code. Regra de segurança: só quando o local e o conteúdo são certos; qualquer dúvida de contexto ou múltiplos arquivos → Trilha 2. A dúvida em si já é sinal de que NÃO é Trilha 0. Sempre testar o build depois.
1. **Arquitetura / SQL / decisões de produto → conversas neste Projeto (Claude.ai).** Iniciadas aqui, com `snapshot_db.md` + este arquivo na base de conhecimento. É onde se decide *o que* fazer e *por quê*. Pesquisa web acontece aqui quando preciso, com verificação contra o ambiente real.
2. **Execução no código (faxina, refatoração, bugs multi-arquivo) → Claude Code no terminal**, dentro de `C:\Users\fabri\Documents\katuu`, **logado pela assinatura Pro** (não API). Ele lê o repo inteiro sozinho — satisfaz a regra "ler antes de reescrever" naturalmente. Mas NÃO tem o `snapshot_db.md` nem as decisões de produto: para SQL, alimentá-lo com o snapshot; o `CLAUDE.md` na raiz já carrega as regras inegociáveis. Padrão útil: pedir que ele MOSTRE (arquivo+linha) o que vai mexer antes de editar, e avise se algo é compartilhado — evita remoção/edição excessiva.
3. **Manus → rebaixado com honra.** Ainda útil para auditorias panorâmicas baratas (inventário factual do repo), mas deixou de ser os "olhos" obrigatórios — o Claude Code assume esse papel com folga. ⚠️ Manus vê o repo, NÃO as decisões: ele apresenta código morto (ex.: `ResetPassword.tsx`) como se fosse fluxo vivo. A triagem/história é sempre da Trilha 1.
4. **Perplexity → pesquisa web** quando Fabricio precisa buscar informação externa por conta própria (documentação, mudanças de versão, erros específicos). Trazer o achado para a Trilha 1 validar contra o ambiente antes de aplicar.

### Claude Code — setup e cuidados (resolvido nesta sessão)
- Instalado no Windows via instalador nativo (`irm https://claude.ai/install.ps1 | iex`) — não exige Node/npm. Versão usada: 2.1.177.
- **Cobrança:** o Claude Code estava entrando por "API Usage Billing" (rota do Console/API). Corrigido com `/login` escolhendo a conta **Claude Pro**. Confirmar sempre com `/status` → deve dizer "Login method: Claude Pro account". Se voltar a "API Usage Billing", rodar `/login` de novo.
- Não havia `ANTHROPIC_API_KEY` no ambiente (verificado) — o problema era conta padrão, não variável.
- Bug de ambiente: o OAuth de login deu `ERR_QUIC_PROTOCOL_ERROR` no navegador; resolvido desabilitando QUIC no Chrome (`chrome://flags` → Experimental QUIC protocol → Disabled).
- **Limites compartilhados:** uso interativo do Claude Code consome a MESMA cota do chat. (Uso headless `claude -p`/Agent SDK passou a ter crédito separado a partir de 15/06/2026 — não se aplica ao uso interativo.)
- Permission mode em **Default** (pede confirmação antes de editar/rodar) — manter assim; é a proteção. No início, autorizar comando a comando; só usar "don't ask again" para leituras seguras (`find`, `git log`, `cat`), nunca para escritas (`rm`, `git push`, `npm install`).
- MCP conectado: Google Drive (via conta claude.ai). Inofensivo.

---

## 3. Regras de trabalho (inegociáveis)

0. **COMUNICAÇÃO (regra do Fabricio, 17/06):** Claude é o Dev do sistema. Fabricio NÃO precisa de tutoriais, explicações longas ou justificativas técnicas — elas consomem sessão à toa. **Mudanças de regra de negócio DEVEM ser perguntadas ao Fabricio e explicadas** (essas valem a explicação). Fora isso: apenas implementar o que foi combinado. Direto ao ponto.
1. **NUNCA reescrever arquivo sem ler o atual** (pedir upload/`cat` primeiro). No Claude Code isso é automático.
2. **NUNCA deduzir schema** — padrão "Passo 0": consultar `snapshot_db.md` ou queries de catálogo antes de SQL que referencie nomes.
3. **Manus = auditoria panorâmica** (ver §2). Cabeçalho anti-reciclagem (`prompt_manus_auditoria.md`): só o ZIP atual vale, só fatos com arquivo+linha+trecho, zero recomendações. ⚠️ Manus só vê imports estáticos em `src/` — imports dinâmicos (padrão Capacitor) e usos em configs fora de `src/` aparecem como "não usado" falsamente.
4. **Rotina de snapshot:** após qualquer SQL aplicado, rodar `snapshot_banco.sql` → salvar como `snapshot_db.md` (sobrescreve; nome estável). ⚠️ O script ainda NÃO captura constraints, índices, `REPLICA IDENTITY` nem `cron.job` — esses fatos precisam ser registrados à mão aqui. Melhoria do script pendente.
5. SQL Editor rejeita `$$`/`$func$` — usar delimitadores variados (`$renew$`, `$feed$`, `$ctx$`...).
6. `ORDER BY` dentro de `jsonb_agg` quebra GROUP BY — usar subquery.
7. Edições cirúrgicas; uma mudança por vez; testar por grupos lógicos, não por arquivo.
8. **NUNCA salvar nada em node_modules.**
9. **NUNCA `npm audit fix --force`.**
10. Critério frontend vs backend: "se um cliente hackeado ignorar isso, alguém se machuca?" → backend. Regra de apresentação (`interactionRules.ts`) → frontend.
11. Registros de negócio nunca são hard-deletados do ponto de vista de auditoria. Exceção deliberada: conversas (hard-delete com evidência snapshotada em `reports.evidence` antes, quando há denúncia).
12. Ícones: assunto = ícone do menu em todo o app (HandshakeIcon=acenos, MessageCircle=chat, MapPin=local).
13. **Imports Capacitor no React:** sempre dinâmicos dentro de `useEffect`, nunca no topo (protege build web/Vercel; pacotes Capacitor são Rollup `external`).
14. Antes de mudança grande: `git tag v<versão>-backup` + push da tag.
15. Travou >2 tentativas: parar e pesquisar. Formato: `"[tecnologia] [problema] [versão] [ano]"`.

---

## 4. Estado do banco (resumo — detalhe em snapshot_db.md)

- **RLS profiles:** policy "Profiles visible by real relationship" (self / mesmo local ativo / wave entre nós / conversa entre nós). `USING(true)` extinta.
- **presence:** índice único parcial `(user_id) WHERE ativo=true`. Policy SELECT exige `ativo=true` → Realtime SUPRIME o UPDATE de saída (por isso o "toque no local" via places). Colunas legadas `location_id`/`disponivel` ainda existem (faxina). `REPLICA IDENTITY` = default `d`.
- **places:** ⚠️ **`REPLICA IDENTITY FULL`** (alterado em 15/06 — o snapshot não captura isso, registrar à mão). Necessário para o filtro `id=eq...` dos canais Realtime casar nos eventos de UPDATE.
- **end_presence_cascade:** versão única 4-params. **Guard inicial:** se a presença NÃO está confirmada E o motivo não é ação humana (`manual`/`expired`/`user_left_location`/`presence_expired`/`switched_place`) E não é `p_force`, **aborta sem fazer nada** (RETURN). Senão: Step 1 (presence `ativo=false`); Step 1.5 (toca `places.last_activity_at` → feed realtime na saída); Step 2 (EXPIRA waves, não deleta); Step 3 (hard-delete de conversas, CASCADE em messages/reads); Step 4 (desativa local temporário vazio).
- **Cron ativos:** job 3 `close_conversations_without_presence` (2min); job 2 Edge `cleanup-expired-presences` (5min, http+anon) — sweeper 2h com prorrogação única de 30min se chat ativo; job 4 `process-notification-queue` (1min, service_role no comando).
- **Funções vivas:** send_wave (rate limit 20/h, locks, guards), accept_wave, ignore_wave (cooldown 2h server), submit_report + suspensões Fase A (3 denunciantes/30d → global 24h; 5 → freeze), edit/delete_message (janela 15min), message_reactions, get/update_my_presence_card, confirm_presence (Haversine ≤300m server; NULL coords = aceita com LOG), create_temporary_place (nome 3-60, máx 2 ativos, expira 4h), activate_presence (INSERT puro; cascade do antigo antes; exige perfil completo), enforce_wave_immutability, cleanup_expired_presences, block/unblock/mute/unmute, get_users_at_place_feed (match_score; filtra `ativo=true` + atividade<1h + blocks/mutes/suspensos — **NÃO filtra is_confirmed**), get_interaction_context (inclui `has_messages`), get_active_conversations, get_unread_counts.
- **Triggers:** enforce_minimum_age (18+), **enforce_renewal_limit (CORRIGIDO 15/06 — ver §6)**, sanitize_message_content (trim+2000 chars), validate_availability (legado, ligado a `disponivel`).

### ⚠️ Notificações — estado duplo (consolidar na faxina)
1. **Legado (Web Push):** triggers `on_new_message`, `on_wave_received`, `on_wave_accepted` → `net.http_post` → Edge `send-push`. Service_role key **hardcoded no corpo das funções**.
2. **Novo (FCM):** triggers `on_message_insert`, `on_wave_insert` → `notification_queue` → trigger `send_notification_async` (JWT service_role no comando) + cron job 4 → Edge `send-fcm`.

Mensagem nova dispara **ambos** → risco de duplicada quando FCM ativar. Rotação de secrets (service_role + VAPID) adiada; ao rotacionar, atualizar 4 pontos: Edge secrets + corpo das 3 funções legadas + comando do `send_notification_async` + comando do cron job 4.

---

## 5. Regras de negócio vigentes

- **Presença:** 2h; prorrogação automática única de +30min se chat com mensagem nos últimos 30min (campo `prorrogado`); `enforce_renewal_limit` trava renovação além do teto no servidor.
- **Confirmação de presença:** selfie obrigatória (câmera frontal nativa inline, sem galeria). O cliente só chama `confirm_presence` quando a 1ª leitura de GPS está dentro de `PRESENCE_RADIUS_METERS` (150m) — `usePresenceGPS.ts:143-157`. O servidor revalida (≤300m Haversine; sem coords = aceita com LOG na transição). **Consequência:** entrar num local NÃO valida distância (botões "Aqui" sem trava); confirmar exige GPS dentro de 150m. Testar de longe (ex.: de casa >150m) deixa a presença `is_confirmed=false` permanentemente — não é bug, é o GPS não entrando no raio.
- **Saída por GPS:** DESLIGADA (`GPS_EXIT_ENABLED=false`). Saída acontece por ação humana ou timeout do sweeper.
- **Validação de rosto:** NENHUMA (face-api desinstalada). Futuro: ML Kit nativo. Selfie tem 4 filtros.
- **Locais temporários:** nome 3-60 chars, máx 2 ativos por usuário, expira 4h (server), desativado quando esvazia. INSERT direto em places revogado — só via RPC.
- **Acenos:** rate limit 20/h, sem duplicado pendente, cooldown 2h se ignorado, expira com a sessão (teto 2h), morre quando alguém sai (cascade).
- **Conversas:** 1:1, nascem de wave aceito, efêmeras — hard-delete no fim de presença/encerramento; cooldown de reinteração 24h. **Mute NÃO encerra chat**; block encerra + apaga mensagens + cooldown 24h.
- **Senha / segurança de conta (device takeover):** num app de encontros, o controle físico de um aparelho destravado por terceiros (parceiro ciumento etc.) é vetor de abuso realista. "Usuário logado" prova que o aparelho está destravado, NÃO que é o dono. **Decisão 15/06: botão "Alterar senha" REMOVIDO do Perfil** (`PasswordChangeDialog.tsx` deletado) — troca de senha agora SÓ pelo fluxo de reset por email, que exige acesso ao email (barreira que o invasor de aparelho normalmente não tem). Card "Conta" do Perfil mostra o email da conta para ambos os métodos (email/Google), sem ação de senha. ⚠️ Ao adicionar futuras ações sensíveis de conta (trocar email, etc.), aplicar o mesmo critério: exigir reautenticação OU roteá-las por canal que o invasor de aparelho não controla.
- **Botão de interação (`interactionRules.ts`):** fonte canônica única. Precedência: BLOCKED > MUTED > CHAT_ACTIVE > cooldown (ENDED_BY_ME/OTHER) > ignore-cooldown > WAVE_RECEIVED > WAVE_SENT > NONE. No CHAT_ACTIVE o rótulo é "Chat em andamento" se `has_messages`, senão "Aceno aceito" — e não regride depois. O `interactionRules` recebe só blocks/mutes/conversations/waves; **NÃO recebe presença** (relevante para o item "Usuário saiu" em §7).
- **Mensagens:** editar/apagar em janela de 15min; reações (ícones outline); sanitização server (trim, 2000 chars); ⚠️ sem rate limit ainda.
- **Moderação:** 1 denúncia por dupla/24h; 3 distintos/30d → global 24h; 5 → freeze; suspenso some do feed e não envia/aceita wave; evidência (30 msgs) snapshotada antes do hard-delete.
- **Perfil:** nome + nascimento (18+) + gender + ≥3 interesses + bio 40-150. Sem foto (só inicial). `activate_presence` bloqueia perfil incompleto.
- **Tutorial:** sob demanda (rota `/tutorial`, botão no Perfil). `useTutorial`/`tutorial_enabled` dormentes.

---

## 6. FEITO nesta sessão (15/06)

**Aplicado no banco e testado ✅:**
- **`enforce_renewal_limit` estreitado.** Antes disparava em TODO UPDATE de presence (`BEFORE UPDATE` genérico só olhando `inicio`), então `RENEWAL_LIMIT` abortava check-in (confirmar selfie numa linha velha) e potencialmente a saída. Agora só barra renovação real: `NEW.ativo = true AND NEW.ultima_atividade IS DISTINCT FROM OLD.ultima_atividade AND now() > NEW.inicio + 2h`. Confirmar selfie e sair passam livres. Check-in voltou a funcionar.
- **`places` → `REPLICA IDENTITY FULL`.** Para eventos de UPDATE de places carregarem a linha inteira e o filtro `id=eq...` dos canais Realtime casar. (Sem isto, o evento chegava mas era descartado pelo filtro.) `conversations` já era FULL; `places`/`presence` eram default.

**Testes do hardening 4.0.3 — todos ✅** (check-in com coords, local temporário com limite de 2, ignorar aceno com cooldown 2h, sair e voltar ao mesmo local sem hard-delete indevido).

**Diagnosticado, correção é trilha 2 (Claude Code), NÃO aplicado:**
- **Bug do rótulo "Aceno aceito" → "Chat em andamento".** Quando o outro envia a 1ª mensagem de uma conversa nova, o badge de não-lidas atualiza mas o rótulo não muda. **Causa confirmada por ausência:** `useInteractionData.ts` escuta conversations, waves, mutes e blocks — mas **não escuta `messages`**. Então `has_messages` (de get_interaction_context) nunca recarrega na 1ª mensagem. Correção: adicionar listener Realtime de INSERT em `messages` que dispare `fetchData`. ⚠️ `messages` não tem `place_id` nem os IDs dos dois usuários no payload (só `conversation_id`/`sender_id`) — o filtro do canal de waves NÃO se aplica; ver `useUnreadMessages.ts` para o padrão de filtro por conversa. `messages` já está na publicação Realtime. Padrão do bug é idêntico ao do card fantasma: sinal chega num canal que o derivador de estado não escuta.

**Setup concluído:** Claude Code instalado e logado no Pro (ver §2).

**Fluxo de email — RESOLVIDO e testado ✅ (parte da auth pronta para lançar):**
- **Reset de senha funciona de ponta a ponta.** Causa do "caía na landing" era dupla: (1) o template "Reset Password" montava o link à mão com `{{ .Token }}` (que entrega um OTP de 6 dígitos, não um JWT — o `reset-password.html` faz `setSession` e precisa de JWT), e (2) o `redirectTo` no código apontava para `/reset-password` (rota SPA MORTA — abandonada porque não funcionava; migrou-se para a página estática `.html`). **Correções:** template virou `{{ .ConfirmationURL }}` puro (verifica no servidor e volta com tokens reais no hash); `AuthPasswordStep.tsx:56` `redirectTo` → `https://app.katuu.com.br/reset-password.html` (Trilha 0, manual). Testado: link → página → senha atualizada → app. Fluxo final: troca de senha acontece na **página estática** `reset-password.html` (no navegador), depois `signOut` + deep link `com.katuu.app://auth` de volta ao app para login.
- **Signup:** `emailRedirectTo: '.../email-confirmado.html'` adicionado em `AuthContext.tsx` (antes NÃO existia no código — redirect dependia 100% do painel, por isso caía no Site URL=landing). Template "Confirm signup" traduzido para PT (⚠️ aplicado mas ainda não testado com cadastro novo). Allowlist `https://app.katuu.com.br/*` já cobre as páginas.
- **Botão "Alterar senha" removido do Perfil** (ver §5, device takeover). `PasswordChangeDialog.tsx` deletado.

**Aprendizado de build (pegou um bug nesta sessão):** "buildei e o app continua igual" foi causado por **APK defasado** — o `.apk` instalado era 12min ANTERIOR ao `npm run build`. Diagnóstico rápido: comparar timestamps de `dist/` → `android\app\src\main\assets\public\assets\*.js` (o sync) → `android\app\build\outputs\apk\debug\*.apk`. O APK tem que ser POSTERIOR ao `dist/`. Confirmar a string nova no bundle: `findstr /s /m "<texto>" dist\assets\*.js`. Script de build correto (sempre nesta ordem): `npm run build` → `npx cap sync android` → `cd android` → `$env:JAVA_HOME=...jbr` → `.\gradlew clean assembleDebug`. Mudanças `.tsx`/`.ts` SÓ valem após rebuild + reinstalar; cold start de instalação limpa (desinstalar + limpar cache) deixa a 1ª abertura lenta — normal, não é bug (some no cache quente).

---

## 7. Pendências imediatas

### 7.1 Vercel — NÃO precisa recomeçar do zero (revisto 15/06)
Os 4 HTMLs estáticos (`landing`, `email-confirmado`, `reset-password`, `login-callback`) **estão servidos e acessíveis** em `app.katuu.com.br/*.html` (testado em aba anônima). O recomeço do Vercel que travava o lançamento **deixou de ser necessário** — o domínio já serve os estáticos. ⚠️ Resíduo: o script `vercel-build` (cp landing sobre index) continua no package.json e pode ser removido na faxina; a raiz `/` serve a landing (Site URL do Supabase = raiz).
**Fluxo de email:** reset de senha ✅ resolvido e testado (ver §6). **Pendente: testar cadastro/confirmação via email** com email novo no APK de hoje (que já tem o `emailRedirectTo` para `email-confirmado.html`) → link → "Email confirmado!" → abrir app → login. Confirmar também o texto PT do template "Confirm signup". URL Configuration do Supabase: Site URL `https://app.katuu.com.br`, Redirect URLs `com.katuu.app://*` e `https://app.katuu.com.br/*`.

### 7.2 Bug do rótulo do botão (executar no Claude Code)
Ver §6 para causa e correção. Prompt pronto: adicionar listener de `messages` em `useInteractionData.ts`, reaproveitando o filtro de `useUnreadMessages.ts`, edição cirúrgica.

### 7.3 Patch oferecido e não aplicado: touch no submit_report
Suspensão derruba presença sem cascade → card do suspenso demora a sumir do feed alheio. Remédio: `UPDATE places SET last_activity_at=now() WHERE id=<place>` dentro do submit_report. Aplicar nos preparativos do teste em grupo.

### 7.4 Achados Manus abertos (baixo risco, faxina)
- Edge `search-places`: N+1 + upserts em loop → 1 RPC com JOIN/GROUP BY.
- Renovação de presença (`ultima_atividade` direto do cliente) → RPC `renew_presence`.
- Selfie via UPDATE direto (Location.tsx:346, usePendingAction:52) → `update_my_presence_card`.
- Rate limit de mensagens (trigger msgs/min).
- `activate_presence` sem check de tamanho do `assunto_atual` (80 só no cliente).
- Cron job 2 chama Edge via http+anon só p/ rodar RPC → trocar por `SELECT public.cleanup_expired_presences()`.

---

## 8. Decisões registradas nesta sessão (avaliadas e fechadas)

- **Card fantasma (até ~30s):** quando o outro sai, o card persiste no feed da Home até o próximo refresh (~30s) ou troca de tela. Acenar nesse intervalo falha com mensagem amigável ("Usuário não está mais no local") — backend recusa por co-presença (`WAVE_NO_PRESENCE_RECIPIENT`), nenhum erro de sistema. **Decisão: comportamento aceito, NÃO mexer.** Não vale o risco de alterar o `interactionRules` canônico por uma aspereza de 30s; a mensagem inclusive ensina a natureza efêmera do app. Revisitar só se o refresh automático for removido ou o intervalo crescer.
- **Botão "Usuário saiu" (ideia do Fabricio):** em vez de o botão voltar a "Acenar" quando o outro sai, mostrar "Usuário saiu". **Viável porém invasivo** — exige um fato novo (`isOtherStillPresent`) na interface canônica `InteractionFacts` + um estado novo no enum, porque hoje o `interactionRules` não recebe presença (quando o outro sai e a conversa é deletada, o estado colapsa em NONE = "Acenar", indistinguível de "nunca interagiu"). **Decisão: pendente para próxima sessão** — pesar custo (mexer no canônico) vs. ganho.
- **Raios de metragem:** as constantes `PRESENCE_RADIUS_METERS`/`SEARCH_RADIUS_METERS` e `isWithinRadius()` em boa parte NÃO gateiam entrada (botões "Aqui" sem trava de distância; constantes chegam a PlaceSelector sem uso). O app funciona assim — tudo que aparece na lista permite entrar/interagir. **Não é bug; é ruído dormente → faxina.**

---

## 9. Backlog — faxina geral (pós-lançamento)

- Limpar presenças **zumbi**: linhas `ativo=true` de maio/junho que nunca morreram (vistas no snapshot 15/06) — lixo histórico anterior ao sweeper atual.
- Quebra de arquivos: Location.tsx (589), usePresence.ts (513), Profile.tsx (489), TutorialFlow.tsx (831).
- **Barramento Realtime único:** promover RealtimeContext a hub (presence, places, waves, conversations, messages, reactions) encapsulando pegadinhas (DELETE só-PK; RLS suprime UPDATEs de presence; necessidade de REPLICA IDENTITY FULL). Migrar hooks um a um. Hoje só blocks/mutes estão no hub.
- Código morto confirmado: `useTutorial.ts` + coluna `tutorial_enabled`; `useProfileGate.ts`; `hooks/presence/index.ts`; `EmailChangeDialog.tsx`; `ImageCropper.tsx`; ~27 `ui/` shadcn órfãos; constante `TEMPORARY_PLACE_DURATION_MS` (6h, morta — server usa 4h); `isWithinRadius()`; caminho gps_exit; colunas `presence.location_id`/`disponivel`; conversas `ativo=false` legadas (<2026-06-09); `public/models/` (pesos face-api, ~192K no APK); `package.json` name/version Lovable; avaliar `lovable-tagger`.
- **Código morto do reset SPA (confirmado 15/06, história conhecida):** `ResetPassword.tsx` (rota SPA `/reset-password`) e o tratamento de `type=recovery` no `DeepLinkHandler` (`App.tsx` ~204-257) — abandonados quando a troca de senha migrou para a página estática `reset-password.html`. ⚠️ Cirurgia, não machado: o `DeepLinkHandler` pode tratar outras coisas vivas além de recovery; remover só o ramo de recovery + a rota `/reset-password` + `ResetPassword.tsx`. Confirmar com Fabricio o que mais o DeepLinkHandler faz antes de cortar.
- **Já removido nesta sessão:** `PasswordChangeDialog.tsx` (botão de alterar senha do Perfil — ver §5/§6).
- Rota `/debug` (Debug.tsx) acessível nos dois routers, inclusive deslogado → remover/guardar antes da Play Store.
- Web Push legado: aposentar `useAutoPushSubscription.ts`, `usePushNotifications.ts`, Edge `send-push`, triggers `on_new_message`/`on_wave_received`/`on_wave_accepted`, tabela `push_subscriptions` — junto da ativação do FCM (evitar duplicada).
- Migration consolidada documentando todo o SQL Editor.
- **Rotação service_role + VAPID** (4 pontos — ver §4).
- Refinos accept_wave (FOR UPDATE).
- Melhorar `snapshot_banco.sql`: incluir constraints, índices, REPLICA IDENTITY e cron.job.

## 10. Backlog — features/épicos

- **CENTRALIZAR ESTADO — PRÓXIMO ÉPICO PRIORITÁRIO (decisão Fabricio 17/06).** Princípio firmado: **uma fonte de verdade por coisa; todo mundo busca de lá em vez de refazer.** Hoje o estado está espalhado e cada tela cuida do seu — é a causa-raiz de uma CLASSE inteira de bugs de estado dessincronizado (card de presença não some do Perfil após expirar; "aceno aceito" não vira "chat em andamento"; e a confusão de "duas leituras de GPS divergentes" na investigação da listagem). Dois alvos concretos:
  - **PresenceProvider global:** contexto único de React como fonte de verdade da presença. Todas as telas (Home, Location, Perfil) leem dele; quando a presença muda (expira/renova/encerra) ele avisa todos de uma vez. Hoje o estado vive espalhado em `usePresence`, `usePresenceTimer`, `usePresenceGPS`, `usePresenceLifecycle`, `usePresenceState` + cada tela consome do seu jeito. Cura por construção os descompassos entre telas, não por remendo em cada um.
  - **Localização centralizada:** a posição GPS deveria ser lida e guardada num lugar único, com precisão/timestamp, e qualquer parte do app busca de lá quando precisar — em vez de cada arquivo ler o GPS do seu jeito (Explore lê no clique, Location na entrada, usePresenceGPS tem a sua). Foi essa fragmentação que gerou o falso diagnóstico de "leituras divergentes". Parar de refazer o que outro arquivo já faz.
  - É trabalho de sessão dedicada (com plano), candidato a vir DEPOIS de fechar o explorador. Não conserta um bug — conserta a classe inteira.
- **PAINEL ADMIN (NOVO — discutido 17/06, desenho NÃO iniciado; será tratado em conversa PRÓPRIA).** Site/área administrativa interna para relatórios sobre usuários, denúncias, estatísticas, suspensões. É DO FABRICIO (admin do Katuu), **distinto do Katuu Business** (que é app externo p/ donos de estabelecimento, vê só `active_users_count`). Não confundir os dois.
  - **Decisão de segurança JÁ TOMADA (a nº1, vem antes de telas):** o painel precisa FURAR a RLS (acesso privilegiado a todos os dados). Caminho escolhido = **tabela `admin_users` + funções `SECURITY DEFINER` que checam "quem chama é admin?" no topo antes de retornar dados privilegiados.** Mesmo padrão que o Katuu já usa (`is_user_suspended`, `get_place_explore_feed`). NUNCA expor `service_role` no front (descartado). Backend próprio (Edge/servidor com service_role) é o caminho 3, para quando crescer — não agora.
  - **Matéria-prima no banco (já mapeada):** `reports` (denúncias, com `evidence` jsonb, `status`, `revisado_por/_em`), `user_suspensions` (global/freeze, escalada 3→global 24h / 5→freeze), `audit_logs` (policy `USING false` — só via SECURITY DEFINER), + `profiles`/`presence`/`waves`/`messages`/`conversations`.
  - **3 perguntas de escopo abertas (responder na conversa do painel):** (a) quem usa — só Fabricio, +moderadores, ou equipe; (b) o que FAZ além de ler — agir em denúncias (suspender/reverter/resolver), gerenciar usuários (banir/editar/apagar); (c) onde mora — site web separado, rota `/admin` no Katuu, ou a definir.
  - **Pré-requisito de segurança correlato:** rotacionar a `service_role` hardcoded nas 3 funções de notificação ANTES de abrir frente admin (já é pendência de lançamento — ver §9).
- **Entrar / Explorar:** ✅ banco + cliente implementados; reescrita da listagem e trava por categoria aplicadas 17/06 (tarde). **AGUARDANDO TESTE DE CAMPO.** Detalhe completo e estado de cada achado em `KATUU_CONTEXT_EXPLORADOR.md` (§11 achados, §12 execução/resolução). Aberto: testar listagem e categorias em campo; card de presença que não some do Perfil (§12.4); selfie no Explore (11.1) a confirmar em campo; UX das mensagens.
- **FCM push com app fechado** (próxima grande conversa anunciada): infra server já existe; falta lado do app + aposentar Web Push + logo na notificação.
- Deep links de signup/Google com auto-login (DeepLinkHandler só trata recovery).
- **Login Google** via `@capgo/capacitor-social-login`: pendente — logar retorno de `SocialLogin.login()`.
- Play Store: `privacidade.html`/`termos.html` estáticos públicos, bundleRelease, screenshots, versionCode crescente, remover `/debug`.
- Verificação de selfie real = ML Kit nativo.
- Busca por nome de local.

## 11. Aparelhos de teste

| Modelo | Nota |
|---|---|
| Moto G52 | Câmera ok; foto com possível distorção (captureSample vs preview) — aberta |
| Moto E13 (Go) | Câmera ok; sem Google Play Services completo |

## 12. Decisões técnicas registradas (histórico)

| Decisão | Motivo |
|---|---|
| `enforce_renewal_limit` só barra renovação real (ativo + ultima_atividade mudou + >2h) | Versão genérica abortava check-in/saída (15/06) |
| `places` REPLICA IDENTITY FULL | Filtro Realtime `id=eq...` casar em UPDATE (15/06) |
| Botão "Alterar senha" removido do Perfil; senha só via reset email | Fecha vetor de device takeover (aparelho destravado por terceiro) (15/06) |
| Reset de senha na página estática `.html`, não na rota SPA | Rota SPA `/reset-password` não funcionava; migrou-se para HTML estático |
| Template de email usa `{{ .ConfirmationURL }}`, não `{{ .Token }}` à mão | `{{ .Token }}` entrega OTP, não JWT; ConfirmationURL verifica no servidor e volta com tokens reais (15/06) |
| Verificar timestamp do APK vs `dist/` no debug de build | APK defasado (anterior ao build) causa "buildei e nada mudou" (15/06) |
| Card fantasma de ~30s aceito | Some no refresh; aceno falha com msg amigável; não vale mexer no canônico |
| Claude Code logado no Pro, permission Default | Cobrança via assinatura; confirmação antes de editar |
| `toBack: false` + `captureSample` na câmera | `toBack:true` não renderizava; `capture` retornava frame preto |
| Sem foto de perfil | Produto — só inicial do nome |
| Selfie obrigatória sem galeria | Segurança |
| Imports Capacitor dinâmicos | Protege build web |
| `@capgo/capacitor-social-login` | Único compatível com Capacitor 8 |
| Wave vive enquanto a sessão viver (expires_at = teto 2h) | Decisão 09/06 |
| GPS exit desligado | UX — flag `GPS_EXIT_ENABLED=false` |
| Mute não encerra chat | Decisão tácita 12/06 |
| App web não existe | Produto — domínio só estáticos |
| Locais temporários só via RPC | Hardening 4.0.3 |
| Duração do temporário: server 4h (constante do app morta dizia 6h) | Pendente decisão final de valor |

## 13. Glossário

- **Presença:** check-in ativo de um usuário em um local.
- **Aceno (wave):** manifestação de interesse; aceito → conversa.
- **prorrogado:** boolean — presença já ganhou os +30min automáticos.
- **Passo 0:** consultar `snapshot_db.md` antes de qualquer SQL com nomes.
- **God Component:** componente que faz tudo — anti-pattern em eliminação.
- **Card fantasma:** card de quem saiu persistindo no feed até o refresh (~30s). Aceito.
- **Trilha 1/2/3:** projeto Claude.ai / Claude Code / Manus (ver §2).

## 14. Como abrir uma nova conversa neste projeto

1. Garantir no Projects: este arquivo + `snapshot_db.md` vigente.
2. Trazer resultados de testes desde a última sessão.
3. Mexer em arquivo → pedir o atual primeiro (regra 1) ou usar Claude Code. SQL → consultar `snapshot_db.md` (regra 2). Decisão de produto/arquitetura → aqui.
4. Primeiros assuntos prováveis da próxima sessão: **(a) faxina + divisão dos arquivos grandes** (Location.tsx 589, usePresence.ts 513, Profile.tsx 489, TutorialFlow.tsx 831; + código morto do §9, com triagem cuidadosa via Trilha 2); **(b) testar o cadastro por email** (§7.1, único item de auth ainda não testado); **(c) bug do rótulo do botão "Chat em andamento"** (§7.2, prompt pronto para Claude Code).
