
-- Mutes index without time-based predicate (now() is not immutable)
CREATE INDEX IF NOT EXISTS idx_user_mutes_pair
ON public.user_mutes (user_id, muted_user_id, expira_em DESC);
