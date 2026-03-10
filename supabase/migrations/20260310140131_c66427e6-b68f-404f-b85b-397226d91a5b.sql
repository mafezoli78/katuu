
-- Index for send_wave RPC: block check, mute check, cooldown, duplicate, presence
CREATE INDEX IF NOT EXISTS idx_waves_sender_receiver ON public.waves (de_user_id, para_user_id);
CREATE INDEX IF NOT EXISTS idx_waves_created_at ON public.waves (de_user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_presence_user_place_active ON public.presence (user_id, place_id) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_presence_expires ON public.presence (ultima_atividade) WHERE (ativo = true);

-- Remove duplicate unique indexes (keep just one)
DROP INDEX IF EXISTS idx_waves_pending_unique;
DROP INDEX IF EXISTS waves_unique_pending;
