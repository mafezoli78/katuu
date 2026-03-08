-- Otimizar função get_users_at_place_feed: substituir ARRAY_AGG por COUNT para melhor performance
CREATE OR REPLACE FUNCTION public.get_users_at_place_feed(p_user_id uuid, p_place_id uuid)
 RETURNS TABLE(user_id uuid, nome text, foto_url text, bio text, data_nascimento date, intention_id uuid, assunto_atual text, checkin_selfie_url text, interests text[], mutual_interests text[], presence_inicio timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_my_interest_ids uuid[];
BEGIN
  -- Pre-fetch current user's interest IDs
  SELECT ARRAY_AGG(ui.interest_id) INTO v_my_interest_ids
  FROM public.user_interests ui
  WHERE ui.user_id = p_user_id;

  v_my_interest_ids := COALESCE(v_my_interest_ids, ARRAY[]::uuid[]);

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
    p.inicio AS presence_inicio
  FROM public.presence p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.place_id = p_place_id
    AND p.ativo = true
    AND p.ultima_atividade > now() - interval '1 hour'
    AND pr.id != p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.user_id = p_user_id AND b.blocked_user_id = pr.id)
         OR (b.user_id = pr.id AND b.blocked_user_id = p_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_mutes m
      WHERE m.user_id = pr.id
        AND m.muted_user_id = p_user_id
        AND m.expira_em > now()
    )
  ORDER BY
    (
      SELECT COUNT(*)
      FROM public.user_interests ui
      WHERE ui.user_id = pr.id
      AND ui.interest_id = ANY(v_my_interest_ids)
    ) DESC,
    p.inicio DESC
  LIMIT 100;
END;
$function$;