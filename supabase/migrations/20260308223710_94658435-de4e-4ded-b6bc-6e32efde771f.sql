
-- PASSO 1: RPC batch para cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_presences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT user_id, place_id
    FROM public.presence
    WHERE ativo = true
    AND ultima_atividade < now() - interval '1 hour'
  LOOP
    PERFORM public.end_presence_cascade(
      v_row.user_id,
      v_row.place_id,
      'presence_expired',
      true
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- PASSO 3: Corrigir trigger para usar now() (limite absoluto)
CREATE OR REPLACE FUNCTION public.enforce_renewal_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF now() > NEW.inicio + interval '2 hours' THEN
    RAISE EXCEPTION 'RENEWAL_LIMIT'
      USING HINT = 'Presença atingiu o limite de 2 horas';
  END IF;
  RETURN NEW;
END;
$$;
