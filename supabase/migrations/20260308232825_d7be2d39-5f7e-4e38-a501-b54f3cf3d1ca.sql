
-- 1. Create interest_categories table
CREATE TABLE public.interest_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

ALTER TABLE public.interest_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view interest categories"
  ON public.interest_categories FOR SELECT
  USING (true);

-- 2. Create interests table
CREATE TABLE public.interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.interest_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT DEFAULT 0
);

ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view interests"
  ON public.interests FOR SELECT
  USING (true);

CREATE INDEX idx_interests_category ON public.interests(category_id);

-- 3. Drop old user_interests and recreate with interest_id
DROP TABLE IF EXISTS public.user_interests;

CREATE TABLE public.user_interests (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interest_id UUID REFERENCES public.interests(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (user_id, interest_id)
);

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all interests"
  ON public.user_interests FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own interests"
  ON public.user_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interests"
  ON public.user_interests FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_interests_user ON public.user_interests(user_id);

-- 4. Seed categories
INSERT INTO public.interest_categories (name, sort_order) VALUES
  ('Esportes & Atividade', 1),
  ('Filmes & Conteúdo', 2),
  ('Games & Geek', 3),
  ('Música & Shows', 4),
  ('Comida & Bebida', 5),
  ('Vida Social', 6),
  ('Arte & Cultura', 7),
  ('Lifestyle', 8);

-- 5. Seed interests
INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Futebol', 'futebol', 1),
  ('Corrida', 'corrida', 2),
  ('Academia', 'academia', 3),
  ('Ciclismo', 'ciclismo', 4),
  ('Vôlei', 'volei', 5),
  ('Yoga', 'yoga', 6),
  ('Surf', 'surf', 7),
  ('Skate', 'skate', 8),
  ('Trilhas', 'trilhas', 9)
) AS t(name, slug, sort_order)
WHERE c.name = 'Esportes & Atividade';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Filmes', 'filmes', 1),
  ('Séries', 'series', 2),
  ('Animes', 'animes', 3),
  ('Documentários', 'documentarios', 4),
  ('Podcasts', 'podcasts', 5),
  ('YouTube', 'youtube', 6)
) AS t(name, slug, sort_order)
WHERE c.name = 'Filmes & Conteúdo';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Games', 'games', 1),
  ('Board Games', 'boardgames', 2),
  ('RPG', 'rpg', 3),
  ('Tecnologia', 'tecnologia', 4),
  ('Startups', 'startups', 5)
) AS t(name, slug, sort_order)
WHERE c.name = 'Games & Geek';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Rock', 'rock', 1),
  ('Pop', 'pop', 2),
  ('MPB', 'mpb', 3),
  ('Sertanejo', 'sertanejo', 4),
  ('Funk', 'funk', 5),
  ('Rap', 'rap', 6),
  ('Eletrônica', 'eletronica', 7),
  ('Samba & Pagode', 'samba_pagode', 8),
  ('Karaokê', 'karaoke', 9)
) AS t(name, slug, sort_order)
WHERE c.name = 'Música & Shows';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Café', 'cafe', 1),
  ('Cerveja Artesanal', 'cerveja_artesanal', 2),
  ('Drinks', 'drinks', 3),
  ('Churrasco', 'churrasco', 4),
  ('Gastronomia', 'gastronomia', 5),
  ('Doces', 'doces', 6),
  ('Vegano', 'vegano', 7)
) AS t(name, slug, sort_order)
WHERE c.name = 'Comida & Bebida';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Conversas', 'conversas', 1),
  ('Amizades', 'amizades', 2),
  ('Networking', 'networking', 3),
  ('Eventos', 'eventos', 4),
  ('Festas', 'festas', 5)
) AS t(name, slug, sort_order)
WHERE c.name = 'Vida Social';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Fotografia', 'fotografia', 1),
  ('Cinema Autoral', 'cinema_autoral', 2),
  ('Museus', 'museus', 3),
  ('Teatro', 'teatro', 4),
  ('Dança', 'danca', 5),
  ('Design', 'design', 6)
) AS t(name, slug, sort_order)
WHERE c.name = 'Arte & Cultura';

INSERT INTO public.interests (category_id, name, slug, sort_order)
SELECT c.id, t.name, t.slug, t.sort_order
FROM public.interest_categories c
CROSS JOIN LATERAL (VALUES
  ('Viagens', 'viagens', 1),
  ('Praia', 'praia', 2),
  ('Natureza', 'natureza', 3),
  ('Pets', 'pets', 4),
  ('Leitura', 'leitura', 5),
  ('Café da manhã', 'cafe_da_manha', 6)
) AS t(name, slug, sort_order)
WHERE c.name = 'Lifestyle';

-- 6. Update get_users_at_place_feed to use new interests structure
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
    COALESCE(array_length(
      (SELECT ARRAY_AGG(ui.interest_id) FROM public.user_interests ui
       WHERE ui.user_id = pr.id AND ui.interest_id = ANY(v_my_interest_ids)),
      1
    ), 0) DESC,
    p.inicio DESC
  LIMIT 100;
END;
$function$;
