
-- Feed index
CREATE INDEX IF NOT EXISTS idx_presence_feed
ON public.presence (place_id, inicio DESC)
WHERE ativo = true;

-- RPC adapted to actual schema (user_interests.tag, no interests table)
CREATE OR REPLACE FUNCTION public.get_users_at_place_feed(
  p_user_id uuid,
  p_place_id uuid
)
RETURNS TABLE (
  user_id uuid,
  nome text,
  foto_url text,
  bio text,
  data_nascimento date,
  intention_id uuid,
  assunto_atual text,
  checkin_selfie_url text,
  interests text[],
  mutual_interests text[],
  presence_inicio timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_my_tags text[];
BEGIN
  -- Pre-fetch current user's interests once
  SELECT ARRAY_AGG(ui.tag) INTO v_my_tags
  FROM public.user_interests ui
  WHERE ui.user_id = p_user_id;

  v_my_tags := COALESCE(v_my_tags, ARRAY[]::text[]);

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
      (SELECT ARRAY_AGG(ui.tag) FROM public.user_interests ui WHERE ui.user_id = pr.id),
      ARRAY[]::text[]
    ) AS interests,
    COALESCE(
      (SELECT ARRAY_AGG(ui.tag) FROM public.user_interests ui
       WHERE ui.user_id = pr.id AND ui.tag = ANY(v_my_tags)),
      ARRAY[]::text[]
    ) AS mutual_interests,
    p.inicio AS presence_inicio
  FROM public.presence p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.place_id = p_place_id
    AND p.ativo = true
    AND p.ultima_atividade > now() - interval '1 hour'
    AND pr.id != p_user_id
    -- Exclude blocked users (bilateral)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.user_id = p_user_id AND b.blocked_user_id = pr.id)
         OR (b.user_id = pr.id AND b.blocked_user_id = p_user_id)
    )
    -- Exclude users who muted the current user (they shouldn't see me = I shouldn't see them)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_mutes m
      WHERE m.user_id = pr.id
        AND m.muted_user_id = p_user_id
        AND m.expira_em > now()
    )
  ORDER BY
    COALESCE(array_length(
      (SELECT ARRAY_AGG(ui.tag) FROM public.user_interests ui
       WHERE ui.user_id = pr.id AND ui.tag = ANY(v_my_tags)),
      1
    ), 0) DESC,
    p.inicio DESC
  LIMIT 100;
END;
$$;
