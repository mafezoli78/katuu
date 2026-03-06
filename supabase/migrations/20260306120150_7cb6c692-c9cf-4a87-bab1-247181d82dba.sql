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
  -- 0. Lock lógico por usuário (evita concorrência humana / rede)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- 0.1 Validate profile completeness
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND nome IS NOT NULL
      AND nome <> ''
      AND data_nascimento IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_interests
    WHERE user_id = p_user_id
    GROUP BY user_id
    HAVING COUNT(*) >= 3
  ) THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE';
  END IF;

  -- 1. Verificar presença ativa atual
  SELECT place_id
  INTO v_old_place_id
  FROM public.presence
  WHERE user_id = p_user_id
    AND ativo = true
  LIMIT 1;

  -- 2. Encerrar presença anterior (se existir)
  IF v_old_place_id IS NOT NULL THEN
    PERFORM end_presence_cascade(
      p_user_id,
      v_old_place_id,
      'switched_place'
    );
  END IF;

  -- 3. Expirar waves pendentes globalmente
  UPDATE public.waves
  SET status = 'expired'
  WHERE status = 'pending'
    AND (de_user_id = p_user_id OR para_user_id = p_user_id);

  -- 4. Criar nova presença
  INSERT INTO public.presence (
    user_id,
    place_id,
    intention_id,
    assunto_atual,
    inicio,
    ultima_atividade,
    ativo
  ) VALUES (
    p_user_id,
    p_place_id,
    p_intention_id,
    NULLIF(TRIM(p_assunto_atual), ''),
    now(),
    now(),
    true
  )
  RETURNING id INTO v_new_presence_id;

  RAISE LOG
    '[activate_presence] user=% place=% previous_place=%',
    p_user_id,
    p_place_id,
    COALESCE(v_old_place_id::text, 'none');

  RETURN v_new_presence_id;
END;
$function$;