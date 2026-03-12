-- Drop old overloads first (specific signatures)
DROP FUNCTION IF EXISTS public.end_conversation(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.send_wave(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.block_user(uuid, uuid);

-- 1. Recreate end_conversation without p_user_id
CREATE OR REPLACE FUNCTION public.end_conversation(p_conversation_id uuid, p_motivo text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'END_CONV_NOT_FOUND'; END IF;
  IF v_conv.user1_id != v_user_id AND v_conv.user2_id != v_user_id THEN
    RAISE EXCEPTION 'END_CONV_NOT_PARTICIPANT';
  END IF;
  IF v_conv.ativo = false THEN RAISE EXCEPTION 'END_CONV_ALREADY_ENDED'; END IF;

  UPDATE public.conversations
  SET ativo = false, encerrado_por = v_user_id, encerrado_em = now(),
      encerrado_motivo = p_motivo, reinteracao_permitida_em = now() + interval '24 hours'
  WHERE id = p_conversation_id;

  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;

  PERFORM public.log_action(v_user_id, 'end_conversation', 'conversations', p_conversation_id,
    jsonb_build_object('motivo', p_motivo, 'other_user',
      CASE WHEN v_conv.user1_id = v_user_id THEN v_conv.user2_id ELSE v_conv.user1_id END));
END;
$function$;

-- 2. Recreate send_wave without p_from_user_id
CREATE OR REPLACE FUNCTION public.send_wave(p_to_user_id uuid, p_place_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wave_id uuid;
  v_expires_at timestamptz;
  v_wave_count integer;
  v_from_user_id uuid := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(v_from_user_id::text, p_to_user_id::text) || p_place_id::text)
  );

  IF v_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'WAVE_SELF';
  END IF;

  SELECT COUNT(*) INTO v_wave_count
  FROM public.waves
  WHERE de_user_id = v_from_user_id
    AND criado_em > now() - interval '1 hour';

  IF v_wave_count >= 20 THEN
    PERFORM public.log_action(v_from_user_id, 'wave_rate_limited', 'waves', NULL,
      jsonb_build_object('count', v_wave_count, 'place_id', p_place_id));
    RAISE EXCEPTION 'WAVE_RATE_LIMIT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = v_from_user_id AND blocked_user_id = p_to_user_id)
       OR (user_id = p_to_user_id AND blocked_user_id = v_from_user_id)
  ) THEN RAISE EXCEPTION 'WAVE_BLOCKED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = v_from_user_id AND muted_user_id = p_to_user_id AND expira_em > now()
  ) THEN RAISE EXCEPTION 'WAVE_MUTED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id AND ativo = true
      AND ((user1_id = v_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = v_from_user_id))
  ) THEN RAISE EXCEPTION 'WAVE_ACTIVE_CHAT'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id AND ativo = false AND reinteracao_permitida_em > now()
      AND ((user1_id = v_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = v_from_user_id))
  ) THEN RAISE EXCEPTION 'WAVE_COOLDOWN'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = v_from_user_id AND para_user_id = p_to_user_id
      AND place_id = p_place_id AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN RAISE EXCEPTION 'WAVE_DUPLICATE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = v_from_user_id AND para_user_id = p_to_user_id
      AND place_id = p_place_id AND status = 'expired'
      AND ignore_cooldown_until IS NOT NULL AND ignore_cooldown_until > now()
  ) THEN RAISE EXCEPTION 'WAVE_IGNORE_COOLDOWN'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = v_from_user_id AND place_id = p_place_id AND ativo = true
  ) THEN RAISE EXCEPTION 'WAVE_NO_PRESENCE_SENDER'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_to_user_id AND place_id = p_place_id AND ativo = true
  ) THEN RAISE EXCEPTION 'WAVE_NO_PRESENCE_RECIPIENT'; END IF;

  v_expires_at := now() + interval '1 hour';

  INSERT INTO public.waves (de_user_id, para_user_id, place_id, location_id, status, expires_at)
  VALUES (v_from_user_id, p_to_user_id, p_place_id, p_place_id, 'pending', v_expires_at)
  RETURNING id INTO v_wave_id;

  PERFORM public.log_action(v_from_user_id, 'send_wave', 'waves', v_wave_id,
    jsonb_build_object('to_user_id', p_to_user_id, 'place_id', p_place_id));

  RETURN v_wave_id;
END;
$function$;

-- 3. Recreate block_user without p_user_id
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id = p_blocked_user_id THEN RAISE EXCEPTION 'BLOCK_SELF'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(v_user_id::text, p_blocked_user_id::text)),
    hashtext(GREATEST(v_user_id::text, p_blocked_user_id::text))
  );

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = v_user_id AND blocked_user_id = p_blocked_user_id
  ) THEN RAISE EXCEPTION 'BLOCK_ALREADY_EXISTS'; END IF;

  UPDATE public.waves SET status = 'expired'
  WHERE status = 'pending'
    AND ((de_user_id = v_user_id AND para_user_id = p_blocked_user_id)
      OR (de_user_id = p_blocked_user_id AND para_user_id = v_user_id));

  DELETE FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations
    WHERE ativo = true
      AND ((user1_id = v_user_id AND user2_id = p_blocked_user_id)
        OR (user1_id = p_blocked_user_id AND user2_id = v_user_id))
  );

  UPDATE public.conversations
  SET ativo = false, encerrado_por = v_user_id, encerrado_em = now(),
      encerrado_motivo = 'block', reinteracao_permitida_em = now() + interval '24 hours'
  WHERE ativo = true
    AND ((user1_id = v_user_id AND user2_id = p_blocked_user_id)
      OR (user1_id = p_blocked_user_id AND user2_id = v_user_id));

  INSERT INTO public.user_blocks (user_id, blocked_user_id)
  VALUES (v_user_id, p_blocked_user_id);

  PERFORM public.log_action(v_user_id, 'block_user', 'user_blocks', NULL,
    jsonb_build_object('blocked_user_id', p_blocked_user_id));
END;
$function$;