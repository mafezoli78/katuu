
-- FASE 3.2: Trigger BEFORE UPDATE para limitar renovação a 2h após início
CREATE OR REPLACE FUNCTION public.enforce_renewal_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only check when ultima_atividade is being updated
  IF NEW.ultima_atividade IS DISTINCT FROM OLD.ultima_atividade THEN
    -- Block if new activity time exceeds 2 hours from start
    IF NEW.ultima_atividade > OLD.inicio + interval '2 hours' THEN
      RAISE EXCEPTION 'RENEWAL_LIMIT' USING HINT = 'Presença atingiu o limite de 2 horas';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_renewal_limit
  BEFORE UPDATE ON public.presence
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_renewal_limit();
