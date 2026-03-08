
CREATE OR REPLACE FUNCTION public.send_wave(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_place_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wave_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- 0. Lock para evitar race conditions entre os dois usuários
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_from_user_id::text, p_to_user_id::text) || p_place_id::text)
  );

  -- 1. Validação: não acenar para si mesmo
  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'WAVE_SELF';
  END IF;

  -- 2. Validação: bloqueio bilateral
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = p_from_user_id AND blocked_user_id = p_to_user_id)
       OR (user_id = p_to_user_id AND blocked_user_id = p_from_user_id)
  ) THEN
    RAISE EXCEPTION 'WAVE_BLOCKED';
  END IF;

  -- 3. Validação: mute ativo (A silenciou B)
  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = p_from_user_id
      AND muted_user_id = p_to_user_id
      AND expira_em > now()
  ) THEN
    RAISE EXCEPTION 'WAVE_MUTED';
  END IF;

  -- 4. Validação: conversa ativa entre o par neste place
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id
      AND ativo = true
      AND ((user1_id = p_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = p_from_user_id))
  ) THEN
    RAISE EXCEPTION 'WAVE_ACTIVE_CHAT';
  END IF;

  -- 5. Validação: cooldown de conversa encerrada (24h)
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id
      AND ativo = false
      AND reinteracao_permitida_em > now()
      AND ((user1_id = p_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = p_from_user_id))
  ) THEN
    RAISE EXCEPTION 'WAVE_COOLDOWN';
  END IF;

  -- 6. Validação: wave pendente duplicado (A→B neste place)
  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = p_from_user_id
      AND para_user_id = p_to_user_id
      AND place_id = p_place_id
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'WAVE_DUPLICATE';
  END IF;

  -- 7. Validação: ignore cooldown ativo (B ignorou aceno anterior de A)
  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = p_from_user_id
      AND para_user_id = p_to_user_id
      AND place_id = p_place_id
      AND status = 'expired'
      AND ignore_cooldown_until IS NOT NULL
      AND ignore_cooldown_until > now()
  ) THEN
    RAISE EXCEPTION 'WAVE_IGNORE_COOLDOWN';
  END IF;

  -- 8. Validação: presença ativa do remetente neste place
  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_from_user_id
      AND place_id = p_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'WAVE_NO_PRESENCE_SENDER';
  END IF;

  -- 9. Validação: presença ativa do destinatário neste place
  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_to_user_id
      AND place_id = p_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'WAVE_NO_PRESENCE_RECIPIENT';
  END IF;

  -- 10. Criar wave com expiração de 1h
  v_expires_at := now() + interval '1 hour';

  INSERT INTO public.waves (
    de_user_id,
    para_user_id,
    place_id,
    location_id,
    status,
    expires_at
  ) VALUES (
    p_from_user_id,
    p_to_user_id,
    p_place_id,
    p_place_id,
    'pending',
    v_expires_at
  )
  RETURNING id INTO v_wave_id;

  RAISE LOG '[send_wave] Wave created: % from % to % at place %', 
    v_wave_id, p_from_user_id, p_to_user_id, p_place_id;

  RETURN v_wave_id;
END;
$$;
