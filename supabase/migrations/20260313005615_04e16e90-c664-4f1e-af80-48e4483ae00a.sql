
-- ============================================================
-- Fix impersonation: replace p_user_id with auth.uid() in all remaining RPCs
-- ============================================================

-- 1. mute_user: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.mute_user(p_muted_user_id uuid, p_place_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id = p_muted_user_id THEN RAISE EXCEPTION 'MUTE_SELF'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_muted_user_id::text)
  );

  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE user_id = v_user_id AND muted_user_id = p_muted_user_id AND expira_em > now()
  ) THEN RAISE EXCEPTION 'MUTE_ALREADY_EXISTS'; END IF;

  IF p_place_id IS NOT NULL THEN
    UPDATE public.waves SET status = 'expired'
    WHERE status = 'pending' AND place_id = p_place_id
      AND ((de_user_id = v_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = v_user_id));
  ELSE
    UPDATE public.waves SET status = 'expired'
    WHERE status = 'pending'
      AND ((de_user_id = v_user_id AND para_user_id = p_muted_user_id)
        OR (de_user_id = p_muted_user_id AND para_user_id = v_user_id));
  END IF;

  INSERT INTO public.user_mutes (user_id, muted_user_id, place_id)
  VALUES (v_user_id, p_muted_user_id, p_place_id);

  PERFORM public.log_action(v_user_id, 'mute_user', 'user_mutes', NULL,
    jsonb_build_object('muted_user_id', p_muted_user_id, 'place_id', p_place_id));
END;
$function$;

-- Drop old overload with p_user_id
DROP FUNCTION IF EXISTS public.mute_user(uuid, uuid, uuid);

-- 2. unmute_user: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.unmute_user(p_muted_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  DELETE FROM public.user_mutes
  WHERE user_id = v_user_id AND muted_user_id = p_muted_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNMUTE_NOT_FOUND';
  END IF;

  RAISE LOG '[unmute_user] User % unmuted %', v_user_id, p_muted_user_id;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.unmute_user(uuid, uuid);

-- 3. unblock_user: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  DELETE FROM public.user_blocks
  WHERE user_id = v_user_id AND blocked_user_id = p_blocked_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNBLOCK_NOT_FOUND';
  END IF;

  RAISE LOG '[unblock_user] User % unblocked %', v_user_id, p_blocked_user_id;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.unblock_user(uuid, uuid);

-- 4. activate_presence: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.activate_presence(p_place_id uuid, p_intention_id uuid, p_assunto_atual text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_old_place_id UUID;
  v_new_presence_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND nome IS NOT NULL AND nome <> '' AND data_nascimento IS NOT NULL
  ) THEN RAISE EXCEPTION 'PROFILE_INCOMPLETE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_interests
    WHERE user_id = v_user_id
    GROUP BY user_id HAVING COUNT(*) >= 3
  ) THEN RAISE EXCEPTION 'PROFILE_INCOMPLETE'; END IF;

  SELECT place_id INTO v_old_place_id
  FROM public.presence
  WHERE user_id = v_user_id AND ativo = true
  LIMIT 1;

  IF v_old_place_id IS NOT NULL THEN
    PERFORM end_presence_cascade(v_user_id, v_old_place_id, 'switched_place');
  END IF;

  UPDATE public.waves SET status = 'expired'
  WHERE status = 'pending'
    AND (de_user_id = v_user_id OR para_user_id = v_user_id);

  INSERT INTO public.presence (user_id, place_id, intention_id, assunto_atual, inicio, ultima_atividade, ativo)
  VALUES (v_user_id, p_place_id, p_intention_id, NULLIF(TRIM(p_assunto_atual), ''), now(), now(), true)
  RETURNING id INTO v_new_presence_id;

  PERFORM public.log_action(v_user_id, 'activate_presence', 'presence', v_new_presence_id,
    jsonb_build_object('place_id', p_place_id, 'previous_place_id', v_old_place_id));

  RETURN v_new_presence_id;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.activate_presence(uuid, uuid, uuid, text);

-- 5. confirm_presence: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.confirm_presence(p_place_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated boolean := false;
BEGIN
  UPDATE public.presence
  SET 
    is_confirmed = true,
    confirmed_at = now()
  WHERE user_id = v_user_id
    AND place_id = p_place_id
    AND ativo = true
    AND is_confirmed = false;
  
  v_updated := FOUND;
  
  IF v_updated THEN
    RAISE LOG '[confirm_presence] Presence confirmed for user % at place %', v_user_id, p_place_id;
  END IF;
  
  RETURN v_updated;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.confirm_presence(uuid, uuid);

-- 6. get_unread_counts: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.get_unread_counts(p_conversation_ids uuid[])
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    m.conversation_id,
    COUNT(*) as unread_count
  FROM public.messages m
  LEFT JOIN public.conversation_reads cr
    ON cr.conversation_id = m.conversation_id
    AND cr.user_id = auth.uid()
  WHERE
    m.conversation_id = ANY(p_conversation_ids)
    AND m.sender_id != auth.uid()
    AND (cr.last_read_at IS NULL OR m.criado_em > cr.last_read_at)
  GROUP BY m.conversation_id;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.get_unread_counts(uuid, uuid[]);

-- 7. get_users_at_place_feed: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.get_users_at_place_feed(p_place_id uuid)
 RETURNS TABLE(user_id uuid, nome text, foto_url text, bio text, data_nascimento date, intention_id uuid, assunto_atual text, checkin_selfie_url text, interests text[], mutual_interests text[], presence_inicio timestamp with time zone, match_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_my_interest_ids uuid[];
  v_my_presence_inicio timestamptz;
BEGIN
  SELECT ARRAY_AGG(ui.interest_id) INTO v_my_interest_ids
  FROM public.user_interests ui
  WHERE ui.user_id = v_user_id;

  v_my_interest_ids := COALESCE(v_my_interest_ids, ARRAY[]::uuid[]);

  SELECT p2.inicio INTO v_my_presence_inicio
  FROM public.presence p2
  WHERE p2.user_id = v_user_id
    AND p2.place_id = p_place_id
    AND p2.ativo = true
  ORDER BY p2.inicio DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    pr.id AS user_id,
    pr.nome,
    pr.foto_url,
    pr.bio,
    pr.data_nascimento,
    p.intention_id,
    p.assunto_atual,
    p.checkin_selfie_url,
    COALESCE(
      (SELECT ARRAY_AGG(i.name) FROM public.user_interests ui JOIN public.interests i ON i.id = ui.interest_id WHERE ui.user_id = pr.id),
      ARRAY[]::text[]
    ) AS interests,
    COALESCE(
      (SELECT ARRAY_AGG(i.name) FROM public.user_interests ui JOIN public.interests i ON i.id = ui.interest_id
       WHERE ui.user_id = pr.id AND ui.interest_id = ANY(v_my_interest_ids)),
      ARRAY[]::text[]
    ) AS mutual_interests,
    p.inicio AS presence_inicio,
    (
      (
        SELECT COUNT(*)
        FROM public.user_interests ui
        WHERE ui.user_id = pr.id
        AND ui.interest_id = ANY(v_my_interest_ids)
      ) * 3
      +
      (
        CASE
          WHEN v_my_presence_inicio IS NOT NULL AND ABS(EXTRACT(EPOCH FROM (p.inicio - v_my_presence_inicio))) < 1800
          THEN 2
          ELSE 0
        END
      )
      +
      (
        CASE
          WHEN p.inicio > now() - interval '30 minutes'
          THEN 1
          ELSE 0
        END
      )
    )::integer AS match_score
  FROM public.presence p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.place_id = p_place_id
    AND p.ativo = true
    AND p.ultima_atividade > now() - interval '1 hour'
    AND pr.id != v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.user_id = v_user_id AND b.blocked_user_id = pr.id)
         OR (b.user_id = pr.id AND b.blocked_user_id = v_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_mutes m
      WHERE m.user_id = pr.id
        AND m.muted_user_id = v_user_id
        AND m.expira_em > now()
    )
  ORDER BY
    (
      (
        SELECT COUNT(*)
        FROM public.user_interests ui
        WHERE ui.user_id = pr.id
        AND ui.interest_id = ANY(v_my_interest_ids)
      ) * 3
      +
      (
        CASE
          WHEN v_my_presence_inicio IS NOT NULL AND ABS(EXTRACT(EPOCH FROM (p.inicio - v_my_presence_inicio))) < 1800
          THEN 2
          ELSE 0
        END
      )
      +
      (
        CASE
          WHEN p.inicio > now() - interval '30 minutes'
          THEN 1
          ELSE 0
        END
      )
    ) DESC,
    p.inicio DESC
  LIMIT 100;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.get_users_at_place_feed(uuid, uuid);

-- 8. accept_wave: remove p_user_id, use auth.uid()
CREATE OR REPLACE FUNCTION public.accept_wave(p_wave_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_wave RECORD;
  v_conversation_id uuid;
  v_place_id uuid;
  v_other_user_id uuid;
BEGIN
  SELECT * INTO v_wave
  FROM public.waves
  WHERE id = p_wave_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_FOUND';
  END IF;

  IF v_wave.para_user_id != v_user_id THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_RECIPIENT';
  END IF;

  IF v_wave.de_user_id = v_user_id THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_SELF';
  END IF;

  v_other_user_id := v_wave.de_user_id;
  v_place_id := COALESCE(v_wave.place_id, v_wave.location_id);

  IF v_place_id IS NULL THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PLACE';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(v_user_id::text, v_other_user_id::text) || v_place_id::text)
  );

  SELECT * INTO v_wave
  FROM public.waves
  WHERE id = p_wave_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_FOUND';
  END IF;

  IF v_wave.status != 'pending' THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NOT_PENDING';
  END IF;

  IF v_wave.expires_at IS NOT NULL AND v_wave.expires_at <= now() THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_EXPIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (user_id = v_user_id AND blocked_user_id = v_other_user_id)
       OR (user_id = v_other_user_id AND blocked_user_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_BLOCKED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_mutes
    WHERE ((user_id = v_user_id AND muted_user_id = v_other_user_id)
       OR (user_id = v_other_user_id AND muted_user_id = v_user_id))
      AND expira_em > now()
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_MUTED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = v_place_id
      AND ativo = true
      AND ((user1_id = v_user_id AND user2_id = v_other_user_id)
        OR (user1_id = v_other_user_id AND user2_id = v_user_id))
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_ACTIVE_CHAT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE place_id = v_place_id
      AND ativo = false
      AND reinteracao_permitida_em > now()
      AND ((user1_id = v_user_id AND user2_id = v_other_user_id)
        OR (user1_id = v_other_user_id AND user2_id = v_user_id))
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_COOLDOWN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = v_other_user_id
      AND place_id = v_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PRESENCE_SENDER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence
    WHERE user_id = v_user_id
      AND place_id = v_place_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_NO_PRESENCE_RECIPIENT';
  END IF;

  UPDATE public.waves
  SET status = 'accepted',
      accepted_by = v_user_id,
      visualizado = true
  WHERE id = p_wave_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCEPT_WAVE_ALREADY_ACCEPTED';
  END IF;

  BEGIN
    INSERT INTO public.conversations (
      user1_id, user2_id, place_id, origem_wave_id, ativo, criado_em
    ) VALUES (
      v_other_user_id, v_user_id, v_place_id, p_wave_id, true, now()
    )
    RETURNING id INTO v_conversation_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_conversation_id
      FROM public.conversations
      WHERE ativo = true
        AND place_id = v_place_id
        AND ((user1_id = v_user_id AND user2_id = v_other_user_id)
          OR (user1_id = v_other_user_id AND user2_id = v_user_id))
      LIMIT 1;

      IF v_conversation_id IS NULL THEN
        RAISE EXCEPTION 'ACCEPT_WAVE_CONVERSATION_ERROR';
      END IF;
  END;

  RAISE LOG '[accept_wave] Conversation % created/found from wave % (user1=%, user2=%, place=%)',
    v_conversation_id, p_wave_id, v_other_user_id, v_user_id, v_place_id;

  RETURN v_conversation_id;
END;
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.accept_wave(uuid, uuid);

-- 9. can_auto_end_presence: also uses p_user_id, fix it
CREATE OR REPLACE FUNCTION public.can_auto_end_presence(p_place_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_confirmed 
     FROM public.presence 
     WHERE user_id = auth.uid() 
       AND place_id = p_place_id 
       AND ativo = true
     LIMIT 1),
    false
  );
$function$;

-- Drop old overload
DROP FUNCTION IF EXISTS public.can_auto_end_presence(uuid, uuid);
