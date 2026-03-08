
-- =============================================
-- RPC end_conversation (atomic)
-- =============================================
CREATE OR REPLACE FUNCTION public.end_conversation(
  p_user_id uuid,
  p_conversation_id uuid,
  p_motivo text DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  -- 1. Fetch conversation with lock
  SELECT * INTO v_conv
  FROM public.conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'END_CONV_NOT_FOUND';
  END IF;

  -- 2. Validate user is participant
  IF v_conv.user1_id != p_user_id AND v_conv.user2_id != p_user_id THEN
    RAISE EXCEPTION 'END_CONV_NOT_PARTICIPANT';
  END IF;

  -- 3. Validate conversation is active
  IF v_conv.ativo = false THEN
    RAISE EXCEPTION 'END_CONV_ALREADY_ENDED';
  END IF;

  -- 4. Mark conversation as ended with 24h cooldown
  UPDATE public.conversations
  SET
    ativo = false,
    encerrado_por = p_user_id,
    encerrado_em = now(),
    encerrado_motivo = p_motivo,
    reinteracao_permitida_em = now() + interval '24 hours'
  WHERE id = p_conversation_id;

  -- 5. Delete messages (ephemeral)
  DELETE FROM public.messages
  WHERE conversation_id = p_conversation_id;

  RAISE LOG '[end_conversation] Conversation % ended by % (reason: %), messages deleted',
    p_conversation_id, p_user_id, p_motivo;
END;
$$;

-- =============================================
-- RPC block_user (with side-effects)
-- =============================================
CREATE OR REPLACE FUNCTION public.block_user(
  p_user_id uuid,
  p_blocked_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  -- 0. Cannot block self
  IF p_user_id = p_blocked_user_id THEN
    RAISE EXCEPTION 'BLOCK_SELF';
  END IF;

  -- 1. Advisory lock on user pair
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_user_id::text, p_blocked_user_id::text))
  );

  -- 2. Check if already blocked
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = p_user_id AND blocked_user_id = p_blocked_user_id
  ) THEN
    RAISE EXCEPTION 'BLOCK_ALREADY_EXISTS';
  END IF;

  -- 3. Insert block
  INSERT INTO public.user_blocks (user_id, blocked_user_id)
  VALUES (p_user_id, p_blocked_user_id);

  -- 4. Cancel all pending waves between the pair (any direction, any place)
  UPDATE public.waves
  SET status = 'expired'
  WHERE status = 'pending'
    AND ((de_user_id = p_user_id AND para_user_id = p_blocked_user_id)
      OR (de_user_id = p_blocked_user_id AND para_user_id = p_user_id));

  -- 5. End all active conversations between the pair
  FOR v_conv IN
    SELECT id FROM public.conversations
    WHERE ativo = true
      AND ((user1_id = p_user_id AND user2_id = p_blocked_user_id)
        OR (user1_id = p_blocked_user_id AND user2_id = p_user_id))
  LOOP
    -- Delete messages
    DELETE FROM public.messages
    WHERE conversation_id = v_conv.id;

    -- End conversation
    UPDATE public.conversations
    SET
      ativo = false,
      encerrado_por = p_user_id,
      encerrado_em = now(),
      encerrado_motivo = 'block',
      reinteracao_permitida_em = now() + interval '24 hours'
    WHERE id = v_conv.id;
  END LOOP;

  RAISE LOG '[block_user] User % blocked % (waves expired, conversations ended)',
    p_user_id, p_blocked_user_id;
END;
$$;

-- =============================================
-- RPC unblock_user
-- =============================================
CREATE OR REPLACE FUNCTION public.unblock_user(
  p_user_id uuid,
  p_blocked_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.user_blocks
  WHERE user_id = p_user_id AND blocked_user_id = p_blocked_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNBLOCK_NOT_FOUND';
  END IF;

  RAISE LOG '[unblock_user] User % unblocked %', p_user_id, p_blocked_user_id;
END;
$$;

-- =============================================
-- RPC mute_user (with side-effects)
-- =============================================
CREATE OR REPLACE FUNCTION public.mute_user(
  p_user_id uuid,
  p_muted_user_id uuid,
  p_place_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 0. Cannot mute self
  IF p_user_id = p_muted_user_id THEN
    RAISE EXCEPTION 'MUTE_SELF';
  END IF;

  -- 1. Check if already muted (active)
  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = p_user_id
      AND muted_user_id = p_muted_user_id
      AND expira_em > now()
  ) THEN
    RAISE EXCEPTION 'MUTE_ALREADY_EXISTS';
  END IF;

  -- 2. Insert mute (24h expiry is default in table)
  INSERT INTO public.user_mutes (user_id, muted_user_id, place_id)
  VALUES (p_user_id, p_muted_user_id, p_place_id);

  -- 3. Cancel pending waves between the pair at this place
  IF p_place_id IS NOT NULL THEN
    UPDATE public.waves
    SET status = 'expired'
    WHERE status = 'pending'
      AND place_id = p_place_id
      AND ((de_user_id = p_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = p_user_id));
  ELSE
    -- No place specified: cancel all pending waves between the pair
    UPDATE public.waves
    SET status = 'expired'
    WHERE status = 'pending'
      AND ((de_user_id = p_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = p_user_id));
  END IF;

  RAISE LOG '[mute_user] User % muted % (place: %)', p_user_id, p_muted_user_id, COALESCE(p_place_id::text, 'all');
END;
$$;

-- =============================================
-- RPC unmute_user
-- =============================================
CREATE OR REPLACE FUNCTION public.unmute_user(
  p_user_id uuid,
  p_muted_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.user_mutes
  WHERE user_id = p_user_id AND muted_user_id = p_muted_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNMUTE_NOT_FOUND';
  END IF;

  RAISE LOG '[unmute_user] User % unmuted %', p_user_id, p_muted_user_id;
END;
$$;
