
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid, p_blocked_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id = p_blocked_user_id THEN
    RAISE EXCEPTION 'BLOCK_SELF';
  END IF;

  -- CORREÇÃO 1: Advisory lock simétrico com dois inteiros
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(p_user_id::text, p_blocked_user_id::text)),
    hashtext(GREATEST(p_user_id::text, p_blocked_user_id::text))
  );

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = p_user_id AND blocked_user_id = p_blocked_user_id
  ) THEN
    RAISE EXCEPTION 'BLOCK_ALREADY_EXISTS';
  END IF;

  -- Cancel pending waves
  UPDATE public.waves
  SET status = 'expired'
  WHERE status = 'pending'
    AND ((de_user_id = p_user_id AND para_user_id = p_blocked_user_id)
      OR (de_user_id = p_blocked_user_id AND para_user_id = p_user_id));

  -- CORREÇÃO 2: Batch delete messages (no loop)
  DELETE FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations
    WHERE ativo = true
      AND ((user1_id = p_user_id AND user2_id = p_blocked_user_id)
        OR (user1_id = p_blocked_user_id AND user2_id = p_user_id))
  );

  -- Batch update conversations (no loop)
  UPDATE public.conversations
  SET
    ativo = false,
    encerrado_por = p_user_id,
    encerrado_em = now(),
    encerrado_motivo = 'block',
    reinteracao_permitida_em = now() + interval '24 hours'
  WHERE ativo = true
    AND ((user1_id = p_user_id AND user2_id = p_blocked_user_id)
      OR (user1_id = p_blocked_user_id AND user2_id = p_user_id));

  -- Insert block last
  INSERT INTO public.user_blocks (user_id, blocked_user_id)
  VALUES (p_user_id, p_blocked_user_id);

  RAISE LOG '[block_user] User % blocked %', p_user_id, p_blocked_user_id;
END;
$function$;
