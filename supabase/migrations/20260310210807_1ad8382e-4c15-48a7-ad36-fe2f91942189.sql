CREATE OR REPLACE FUNCTION public.get_users_at_place_feed(p_user_id uuid, p_place_id uuid)
 RETURNS TABLE(user_id uuid, nome text, foto_url text, bio text, data_nascimento date, intention_id uuid, assunto_atual text, checkin_selfie_url text, interests text[], mutual_interests text[], presence_inicio timestamp with time zone, match_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_my_interest_ids uuid[];
  v_my_presence_inicio timestamptz;
BEGIN
  SELECT ARRAY_AGG(ui.interest_id) INTO v_my_interest_ids
  FROM public.user_interests ui
  WHERE ui.user_id = p_user_id;

  v_my_interest_ids := COALESCE(v_my_interest_ids, ARRAY[]::uuid[]);

  SELECT p2.inicio INTO v_my_presence_inicio
  FROM public.presence p2
  WHERE p2.user_id = p_user_id
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