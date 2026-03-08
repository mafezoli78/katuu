
-- 1. Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON public.audit_logs(action, created_at DESC);

-- No direct access via RLS — only SECURITY DEFINER functions can write
-- Admins can read via SQL editor / dashboard

-- 2. Log function
CREATE OR REPLACE FUNCTION public.log_action(
  p_user_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity, p_entity_id, p_metadata);
END;
$$;

-- 3. Instrument send_wave
CREATE OR REPLACE FUNCTION public.send_wave(p_from_user_id uuid, p_to_user_id uuid, p_place_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wave_id uuid;
  v_expires_at timestamptz;
  v_wave_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_from_user_id::text, p_to_user_id::text) || p_place_id::text)
  );

  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'WAVE_SELF';
  END IF;

  SELECT COUNT(*) INTO v_wave_count
  FROM public.waves
  WHERE de_user_id = p_from_user_id
    AND criado_em > now() - interval '1 hour';

  IF v_wave_count >= 20 THEN
    PERFORM public.log_action(p_from_user_id, 'wave_rate_limited', 'waves', NULL,
      jsonb_build_object('count', v_wave_count, 'place_id', p_place_id));
    RAISE EXCEPTION 'WAVE_RATE_LIMIT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = p_from_user_id AND blocked_user_id = p_to_user_id)
       OR (user_id = p_to_user_id AND blocked_user_id = p_from_user_id)
  ) THEN RAISE EXCEPTION 'WAVE_BLOCKED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = p_from_user_id AND muted_user_id = p_to_user_id AND expira_em > now()
  ) THEN RAISE EXCEPTION 'WAVE_MUTED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id AND ativo = true
      AND ((user1_id = p_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = p_from_user_id))
  ) THEN RAISE EXCEPTION 'WAVE_ACTIVE_CHAT'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = p_place_id AND ativo = false AND reinteracao_permitida_em > now()
      AND ((user1_id = p_from_user_id AND user2_id = p_to_user_id)
        OR (user1_id = p_to_user_id AND user2_id = p_from_user_id))
  ) THEN RAISE EXCEPTION 'WAVE_COOLDOWN'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = p_from_user_id AND para_user_id = p_to_user_id
      AND place_id = p_place_id AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN RAISE EXCEPTION 'WAVE_DUPLICATE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.waves
    WHERE de_user_id = p_from_user_id AND para_user_id = p_to_user_id
      AND place_id = p_place_id AND status = 'expired'
      AND ignore_cooldown_until IS NOT NULL AND ignore_cooldown_until > now()
  ) THEN RAISE EXCEPTION 'WAVE_IGNORE_COOLDOWN'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_from_user_id AND place_id = p_place_id AND ativo = true
  ) THEN RAISE EXCEPTION 'WAVE_NO_PRESENCE_SENDER'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = p_to_user_id AND place_id = p_place_id AND ativo = true
  ) THEN RAISE EXCEPTION 'WAVE_NO_PRESENCE_RECIPIENT'; END IF;

  v_expires_at := now() + interval '1 hour';

  INSERT INTO public.waves (de_user_id, para_user_id, place_id, location_id, status, expires_at)
  VALUES (p_from_user_id, p_to_user_id, p_place_id, p_place_id, 'pending', v_expires_at)
  RETURNING id INTO v_wave_id;

  PERFORM public.log_action(p_from_user_id, 'send_wave', 'waves', v_wave_id,
    jsonb_build_object('to_user_id', p_to_user_id, 'place_id', p_place_id));

  RETURN v_wave_id;
END;
$function$;

-- 4. Instrument block_user
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid, p_blocked_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id = p_blocked_user_id THEN RAISE EXCEPTION 'BLOCK_SELF'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_user_id::text, p_blocked_user_id::text)),
    hashtext(GREATEST(p_user_id::text, p_blocked_user_id::text))
  );

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = p_user_id AND blocked_user_id = p_blocked_user_id
  ) THEN RAISE EXCEPTION 'BLOCK_ALREADY_EXISTS'; END IF;

  UPDATE public.waves SET status = 'expired'
  WHERE status = 'pending'
    AND ((de_user_id = p_user_id AND para_user_id = p_blocked_user_id)
      OR (de_user_id = p_blocked_user_id AND para_user_id = p_user_id));

  DELETE FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations
    WHERE ativo = true
      AND ((user1_id = p_user_id AND user2_id = p_blocked_user_id)
        OR (user1_id = p_blocked_user_id AND user2_id = p_user_id))
  );

  UPDATE public.conversations
  SET ativo = false, encerrado_por = p_user_id, encerrado_em = now(),
      encerrado_motivo = 'block', reinteracao_permitida_em = now() + interval '24 hours'
  WHERE ativo = true
    AND ((user1_id = p_user_id AND user2_id = p_blocked_user_id)
      OR (user1_id = p_blocked_user_id AND user2_id = p_user_id));

  INSERT INTO public.user_blocks (user_id, blocked_user_id)
  VALUES (p_user_id, p_blocked_user_id);

  PERFORM public.log_action(p_user_id, 'block_user', 'user_blocks', NULL,
    jsonb_build_object('blocked_user_id', p_blocked_user_id));
END;
$function$;

-- 5. Instrument mute_user
CREATE OR REPLACE FUNCTION public.mute_user(p_user_id uuid, p_muted_user_id uuid, p_place_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id = p_muted_user_id THEN RAISE EXCEPTION 'MUTE_SELF'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_muted_user_id::text)
  );

  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = p_user_id AND muted_user_id = p_muted_user_id AND expira_em > now()
  ) THEN RAISE EXCEPTION 'MUTE_ALREADY_EXISTS'; END IF;

  IF p_place_id IS NOT NULL THEN
    UPDATE public.waves SET status = 'expired'
    WHERE status = 'pending' AND place_id = p_place_id
      AND ((de_user_id = p_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = p_user_id));
  ELSE
    UPDATE public.waves SET status = 'expired'
    WHERE status = 'pending'
      AND ((de_user_id = p_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = p_user_id));
  END IF;

  INSERT INTO public.user_mutes (user_id, muted_user_id, place_id)
  VALUES (p_user_id, p_muted_user_id, p_place_id);

  PERFORM public.log_action(p_user_id, 'mute_user', 'user_mutes', NULL,
    jsonb_build_object('muted_user_id', p_muted_user_id, 'place_id', p_place_id));
END;
$function$;

-- 6. Instrument activate_presence
CREATE OR REPLACE FUNCTION public.activate_presence(p_user_id uuid, p_place_id uuid, p_intention_id uuid, p_assunto_atual text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_place_id UUID;
  v_new_presence_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND nome IS NOT NULL AND nome <> '' AND data_nascimento IS NOT NULL
  ) THEN RAISE EXCEPTION 'PROFILE_INCOMPLETE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_interests
    WHERE user_id = p_user_id
    GROUP BY user_id HAVING COUNT(*) >= 3
  ) THEN RAISE EXCEPTION 'PROFILE_INCOMPLETE'; END IF;

  SELECT place_id INTO v_old_place_id
  FROM public.presence
  WHERE user_id = p_user_id AND ativo = true
  LIMIT 1;

  IF v_old_place_id IS NOT NULL THEN
    PERFORM end_presence_cascade(p_user_id, v_old_place_id, 'switched_place');
  END IF;

  UPDATE public.waves SET status = 'expired'
  WHERE status = 'pending'
    AND (de_user_id = p_user_id OR para_user_id = p_user_id);

  INSERT INTO public.presence (user_id, place_id, intention_id, assunto_atual, inicio, ultima_atividade, ativo)
  VALUES (p_user_id, p_place_id, p_intention_id, NULLIF(TRIM(p_assunto_atual), ''), now(), now(), true)
  RETURNING id INTO v_new_presence_id;

  PERFORM public.log_action(p_user_id, 'activate_presence', 'presence', v_new_presence_id,
    jsonb_build_object('place_id', p_place_id, 'previous_place_id', v_old_place_id));

  RETURN v_new_presence_id;
END;
$function$;

-- 7. Instrument end_conversation
CREATE OR REPLACE FUNCTION public.end_conversation(p_user_id uuid, p_conversation_id uuid, p_motivo text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'END_CONV_NOT_FOUND'; END IF;
  IF v_conv.user1_id != p_user_id AND v_conv.user2_id != p_user_id THEN
    RAISE EXCEPTION 'END_CONV_NOT_PARTICIPANT';
  END IF;
  IF v_conv.ativo = false THEN RAISE EXCEPTION 'END_CONV_ALREADY_ENDED'; END IF;

  UPDATE public.conversations
  SET ativo = false, encerrado_por = p_user_id, encerrado_em = now(),
      encerrado_motivo = p_motivo, reinteracao_permitida_em = now() + interval '24 hours'
  WHERE id = p_conversation_id;

  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;

  PERFORM public.log_action(p_user_id, 'end_conversation', 'conversations', p_conversation_id,
    jsonb_build_object('motivo', p_motivo, 'other_user',
      CASE WHEN v_conv.user1_id = p_user_id THEN v_conv.user2_id ELSE v_conv.user1_id END));
END;
$function$;
