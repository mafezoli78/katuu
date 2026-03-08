
-- =============================================
-- CORREÇÃO 1: RLS conversations INSERT - validar wave completo
-- =============================================
DROP POLICY IF EXISTS "Users can create conversations with valid wave" ON public.conversations;

CREATE POLICY "Users can create conversations with valid wave"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user1_id OR auth.uid() = user2_id)
  AND origem_wave_id IS NOT NULL
  AND ativo = true
  AND EXISTS (
    SELECT 1
    FROM public.waves
    WHERE waves.id = conversations.origem_wave_id
      AND waves.status = 'accepted'
      AND waves.place_id = conversations.place_id
      AND (
        (waves.de_user_id = conversations.user1_id AND waves.para_user_id = conversations.user2_id)
        OR
        (waves.de_user_id = conversations.user2_id AND waves.para_user_id = conversations.user1_id)
      )
  )
);

-- =============================================
-- CORREÇÃO 2: UNIQUE INDEX conversations ativas
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_active_pair
ON public.conversations (
  LEAST(user1_id, user2_id),
  GREATEST(user1_id, user2_id),
  place_id
)
WHERE ativo = true;

-- =============================================
-- CORREÇÃO 3: Hardening RPC accept_wave
-- Re-fetch wave após advisory lock para evitar TOCTOU
-- Adicionar tratamento de duplicata de conversa (23505)
-- =============================================
CREATE OR REPLACE FUNCTION public.accept_wave(
  p_wave_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wave RECORD;
  v_conversation_id uuid;
  v_place_id uuid;
  v_other_user_id uuid;
BEGIN
  -- 1. Fetch wave (initial read)
  SELECT * INTO v_wave
  FROM public.waves
  WHERE id = p_wave_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_FOUND';
  END IF;

  -- 2. Validate ownership
  IF v_wave.para_user_id != p_user_id THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_RECIPIENT';
  END IF;

  IF v_wave.de_user_id = p_user_id THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_SELF';
  END IF;

  v_other_user_id := v_wave.de_user_id;
  v_place_id := COALESCE(v_wave.place_id, v_wave.location_id);

  IF v_place_id IS NULL THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PLACE';
  END IF;

  -- 3. Advisory lock on user pair
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_user_id::text, v_other_user_id::text) || v_place_id::text)
  );

  -- 4. TOCTOU FIX: Re-fetch wave after acquiring lock
  SELECT * INTO v_wave
  FROM public.waves
  WHERE id = p_wave_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_FOUND';
  END IF;

  -- 5. Validate status is still pending (after lock)
  IF v_wave.status != 'pending' THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_PENDING';
  END IF;

  -- 6. Validate not expired
  IF v_wave.expires_at IS NOT NULL AND v_wave.expires_at <= now() THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_EXPIRED';
  END IF;

  -- 7. Block bilateral
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = p_user_id AND blocked_user_id = v_other_user_id)
       OR (user_id = v_other_user_id AND blocked_user_id = p_user_id)
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_BLOCKED';
  END IF;

  -- 8. Mute bilateral
  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE ((user_id = p_user_id AND muted_user_id = v_other_user_id)
       OR (user_id = v_other_user_id AND muted_user_id = p_user_id))
      AND expira_em > now()
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_MUTED';
  END IF;

  -- 9. No active conversation
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = v_place_id
      AND ativo = true
      AND ((user1_id = p_user_id AND user2_id = v_other_user_id)
        OR (user1_id = v_other_user_id AND user2_id = p_user_id))
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_ACTIVE_CHAT';
  END IF;

  -- 10. No cooldown
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = v_place_id
      AND ativo = false
      AND reinteracao_permitida_em > now()
      AND ((user1_id = p_user_id AND user2_id = v_other_user_id)
        OR (user1_id = v_other_user_id AND user2_id = p_user_id))
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_COOLDOWN';
  END IF;

  -- 11. Sender presence
  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = v_other_user_id
      AND place_id = v_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PRESENCE_SENDER';
  END IF;

  -- 12. Recipient presence
  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_user_id
      AND place_id = v_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PRESENCE_RECIPIENT';
  END IF;

  -- 13. Update wave status (with row-level lock already held via FOR UPDATE)
  UPDATE public.waves
  SET status = 'accepted',
      accepted_by = p_user_id,
      visualizado = true
  WHERE id = p_wave_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_ALREADY_ACCEPTED';
  END IF;

  -- 14. Create conversation (unique index prevents duplicates)
  BEGIN
    INSERT INTO public.conversations (
      user1_id,
      user2_id,
      place_id,
      origem_wave_id,
      ativo,
      criado_em
    ) VALUES (
      v_other_user_id,
      p_user_id,
      v_place_id,
      p_wave_id,
      true,
      now()
    )
    RETURNING id INTO v_conversation_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Duplicate conversation: return existing one
      SELECT id INTO v_conversation_id
      FROM public.conversations
      WHERE ativo = true
        AND place_id = v_place_id
        AND ((user1_id = p_user_id AND user2_id = v_other_user_id)
          OR (user1_id = v_other_user_id AND user2_id = p_user_id))
      LIMIT 1;

      IF v_conversation_id IS NULL THEN
        RAISE EXCEPTION 'ACCEPT_WAVE_CONVERSATION_ERROR';
      END IF;
  END;

  RAISE LOG '[accept_wave] Conversation % created/found from wave % (user1=%, user2=%, place=%)',
    v_conversation_id, p_wave_id, v_other_user_id, p_user_id, v_place_id;

  RETURN v_conversation_id;
END;
$$;
