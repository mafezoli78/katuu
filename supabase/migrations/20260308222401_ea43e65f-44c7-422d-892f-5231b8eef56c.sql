
-- CORREÇÃO 1: UNIQUE INDEX em user_mutes (sem filtro temporal, COALESCE para NULL place_id)
CREATE UNIQUE INDEX IF NOT EXISTS user_mutes_unique_pair
ON public.user_mutes (user_id, muted_user_id, COALESCE(place_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- CORREÇÃO 4: UNIQUE INDEX em user_blocks
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_unique
ON public.user_blocks (user_id, blocked_user_id);
