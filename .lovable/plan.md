# PLANO DE MIGRAÇÃO BACKEND — Katuu

**Data**: 2026-03-08  
**Objetivo**: Mover regras de negócio críticas do frontend para o backend (Supabase) de forma segura e incremental.  
**Princípio**: Zero downtime. Cada fase é independente e deployável separadamente.

---

## ESTRATÉGIA GERAL

**Abordagem**: Backend-first com frontend gradual.
1. Criar RPC no backend com toda a lógica
2. Atualizar frontend para chamar RPC (removendo lógica local)
3. Manter validação frontend como UX hint (não como enforcement)
4. Restringir RLS para bloquear operações diretas

---

## FASE 1 — SEGURANÇA CRÍTICA (Waves + Conversations RLS)

**Risco atual**: Bypass de validações via DevTools/API direta.  
**Tempo estimado**: 2–3 dias

| Ordem | Regra | Backend mudança | Frontend impacto | Teste necessário |
|-------|-------|----------------|-----------------|-----------------|
| 1.1 | **send_wave atômico** — Validar bloqueio, mute, cooldown, duplicata, presença ativa | Criar RPC `send_wave(p_user_id, p_to_user_id, p_place_id)` que: (1) verifica bloqueio bilateral, (2) verifica mute ativo, (3) verifica conversa ativa, (4) verifica cooldown, (5) verifica wave pendente duplicado, (6) verifica ignore_cooldown, (7) verifica presença ativa de ambos, (8) insere wave com expires_at calculado | `src/hooks/useWaves.ts` → `sendWave()` (linhas 122–228): Substituir 4 queries paralelas + deriveFacts + canWave + insert por chamada única `supabase.rpc('send_wave', {...})`. Manter `canWave()` local apenas como hint para desabilitar botão na UI. | Enviar wave sem presença ativa → deve falhar. Enviar wave para usuário bloqueado → deve falhar. Enviar wave duplicado → deve falhar. Enviar wave durante cooldown → deve falhar. |
| 1.2 | **accept_wave atômico** — Aceitar wave + criar conversa em transação única | Criar RPC `accept_wave(p_user_id, p_wave_id)` que: (1) busca wave e valida ownership, (2) verifica expiração, (3) verifica bloqueio/mute/cooldown, (4) atualiza wave para 'accepted', (5) cria conversation, (6) retorna conversation_id. Tudo em transação implícita. | `src/hooks/useWaves.ts` → `acceptWave()` (linhas 235–421): Substituir toda a lógica por chamada única `supabase.rpc('accept_wave', {...})`. | Aceitar wave expirado → deve falhar. Aceitar wave de usuário bloqueado → deve falhar. Race condition: dois aceites simultâneos → apenas um sucede. |
| 1.3 | **RLS waves — restringir UPDATE** | Alterar policy para limitar campos alteráveis: apenas `status`, `visualizado`, `accepted_by`, `ignored_at`, `ignore_cooldown_until`. Após RPCs, considerar remover UPDATE direto. | `src/hooks/useWaves.ts` → `ignoreWave()` (linhas 424–443): Criar RPC `ignore_wave` ou manter UPDATE restrito. `markAsRead()` (linhas 445–458): Manter UPDATE restrito a `visualizado=true`. | Tentar alterar `expires_at` via API direta → bloqueado. Tentar alterar `de_user_id` → bloqueado. |
| 1.4 | **RLS conversations — restringir UPDATE** | Limitar: apenas `ativo=false`, `encerrado_por=auth.uid()`, `encerrado_em`, `encerrado_motivo`, `reinteracao_permitida_em`. Impedir alteração de `user1_id`, `user2_id`, `place_id`. | `src/hooks/useChat.ts` → `endChat()` (linhas 229–275): Será substituído na Fase 2 por RPC. | Tentar alterar `user1_id` → bloqueado. Tentar reativar conversa (`ativo=true`) → bloqueado. |
| 1.5 | **RLS conversations — restringir INSERT** | Exigir `origem_wave_id` válido ou bloquear INSERT direto após RPC `accept_wave`. | Nenhum impacto se 1.2 implementado. | Criar conversa sem wave aceito → bloqueado. |

### Estratégia de deploy (Fase 1):
1. Deploy RPCs (não quebra nada — funções novas)
2. Atualizar frontend para usar RPCs
3. Restringir RLS após 24h de monitoramento
4. Manter validação local como hint de UI

---

## FASE 2 — CONSISTÊNCIA DE CHAT

**Risco atual**: Operações não-atômicas, race conditions.  
**Tempo estimado**: 1–2 dias

| Ordem | Regra | Backend mudança | Frontend impacto | Teste necessário |
|-------|-------|----------------|-----------------|-----------------|
| 2.1 | **end_conversation atômico** | Criar RPC `end_conversation(p_user_id, p_conversation_id, p_motivo)`: (1) verifica participação, (2) verifica ativo, (3) marca encerrada, (4) aplica cooldown 24h, (5) deleta mensagens. Atômico. | `src/hooks/useChat.ts` → `endChat()` (linhas 229–275): Substituir update + delete por `supabase.rpc('end_conversation')`. | Encerrar → mensagens deletadas atomicamente. Encerrar já encerrada → falha gracefully. |
| 2.2 | **block_user com side-effects** | Criar RPC `block_user(p_user_id, p_blocked_user_id)`: (1) insere block, (2) encerra conversas ativas, (3) deleta mensagens, (4) cancela waves pendentes. | Substituir `user_blocks.insert` por RPC. | Bloquear com conversa ativa → conversa encerrada. Bloquear com wave → wave cancelado. |
| 2.3 | **mute_user com side-effects** | Criar RPC `mute_user(p_user_id, p_muted_user_id, p_place_id?)`: (1) insere mute, (2) cancela waves pendentes entre o par. | Substituir `user_mutes.insert` por RPC. | Mutar com wave pendente → wave cancelado. |
| 2.4 | **Remover `endAllChatsForPresence`** | Já coberto por `end_presence_cascade`. | `src/hooks/useChat.ts` → `endAllChatsForPresence()` (linhas 278–328): Remover. | Encerrar presença → conversas encerradas pelo banco. |

---

## FASE 3 — PRESENÇA

**Risco atual**: Timer no cliente, renovação sem limite.  
**Tempo estimado**: 2–3 dias

| Ordem | Regra | Backend mudança | Frontend impacto | Teste necessário |
|-------|-------|----------------|-----------------|-----------------|
| 3.1 | **Expiração via cron** | Edge Function `cleanup-expired-presences` + pg_cron a cada 5min: busca presenças expiradas e chama `end_presence_cascade`. | Timer local mantido como UX. Expiração real pelo cron. | Presença expira sem frontend → cron encerra. |
| 3.2 | **Limite de renovação** | Trigger BEFORE UPDATE em presence: `ultima_atividade <= inicio + interval '2 hours'`. | `src/hooks/usePresence.ts` → `renewPresence()` (linhas 718–732): Tratar erro de limite. | Renovar após limite → falha. |
| 3.3 | **Presença ativa ao acenar** | Já incluído na RPC `send_wave` (1.1). | — | — |
| 3.4 | **close_conversations_without_presence via cron** | Agendar função existente via pg_cron a cada 2min. | Nenhum. | Ambos saem → conversa encerrada ≤2min. |

---

## FASE 4 — HARDENING

**Risco atual**: Baixo no MVP, relevante para escala.  
**Tempo estimado**: 2–3 dias

| Ordem | Regra | Backend mudança | Frontend impacto | Teste necessário |
|-------|-------|----------------|-----------------|-----------------|
| 4.1 | **Rate limit waves** | Na RPC `send_wave`: COUNT waves últimas 1h ≤ 20. | Tratar novo erro de rate limit. | 21º wave em 1h → falha. |
| 4.2 | **Sanitização de texto** | Trigger BEFORE INSERT em messages: trim, limitar tamanho. Sanitizar `assunto_atual` em `activate_presence`. | Nenhum (transparente). | Mensagem 10k chars → truncada. |
| 4.3 | **Idade mínima no banco** | Trigger BEFORE UPDATE em profiles: `age(data_nascimento) >= 18`. | `src/pages/Onboarding.tsx`: Tratar erro. Manter validação local. | Menor de 18 → falha no banco. |
| 4.4 | **Unique index wave pendente** | `CREATE UNIQUE INDEX ON waves (de_user_id, para_user_id, place_id) WHERE status = 'pending'`. | Tratar erro 23505. | Wave duplicado via API → falha. |
| 4.5 | **Remover defensive cleanup** | — | `src/hooks/usePresence.ts` → linhas 603–634: Remover bloco redundante (RPC já faz). | Ativar presença → RPC cuida do cleanup. |

---

## MUDANÇAS NO FRONTEND NECESSÁRIAS

### `src/hooks/useWaves.ts`

| Função | Linhas | Mudança | Fase |
|--------|--------|---------|------|
| `sendWave()` | 122–228 | Substituir por `supabase.rpc('send_wave')` | 1.1 |
| `acceptWave()` | 235–421 | Substituir por `supabase.rpc('accept_wave')` | 1.2 |
| `ignoreWave()` | 424–443 | Criar RPC ou restringir UPDATE | 1.3 |
| `deleteUserWaves()` | 485–497 | Remover (coberto por `end_presence_cascade`) | 2.4 |

### `src/hooks/useChat.ts`

| Função | Linhas | Mudança | Fase |
|--------|--------|---------|------|
| `endChat()` | 229–275 | Substituir por `supabase.rpc('end_conversation')` | 2.1 |
| `endAllChatsForPresence()` | 278–328 | Remover (redundante) | 2.4 |

### `src/hooks/usePresence.ts`

| Função | Linhas | Mudança | Fase |
|--------|--------|---------|------|
| `activatePresenceAtPlace()` | 603–634 | Remover defensive cleanup | 4.5 |
| `renewPresence()` | 718–732 | Tratar erro de limite | 3.2 |
| Timer countdown | 812–827 | Manter como UX hint | 3.1 |

### `src/lib/interactionRules.ts`

| Função | Linhas | Mudança | Fase |
|--------|--------|---------|------|
| `canWave()` | 416–438 | Manter como hint de UI | 1.1 |
| `canAcceptWave()` | 447–464 | Manter como hint de UI | 1.2 |
| `deriveFacts()` | 303–403 | Manter para UI | — |

### `src/pages/Onboarding.tsx`

| Função | Linhas | Mudança | Fase |
|--------|--------|---------|------|
| Validação de idade | ~39 | Manter como UX + backend valida | 4.3 |

---

## REGRAS CRÍTICAS QUE DEVEM IR PARA O BACKEND NO MVP

1. **`send_wave` RPC** — Qualquer usuário pode inserir wave arbitrário via API hoje.
2. **`accept_wave` RPC** — Possível criar conversas sem wave válido via INSERT direto.
3. **`end_conversation` RPC** — Mensagens "efêmeras" podem permanecer se frontend falha entre UPDATE e DELETE.
4. **RLS restritiva em `waves` UPDATE** — Destinatário pode alterar qualquer campo (incluindo `expires_at`).
5. **RLS restritiva em `conversations` INSERT** — Qualquer autenticado pode criar conversa sem wave.

---

## NOTAS DE IMPLEMENTAÇÃO

- RPCs devem usar `SECURITY DEFINER` com `SET search_path TO 'public'`
- Usar `pg_advisory_xact_lock` para atomicidade em `send_wave`/`accept_wave`
- Frontend deve tratar erros de RPC com mensagens amigáveis (`RAISE EXCEPTION 'WAVE_DUPLICATE'` → "Você já acenou")
- Não usar Edge Functions para RPCs simples — `plpgsql` tem menor latência
- Edge Function apenas para cron de cleanup (Fase 3.1)
