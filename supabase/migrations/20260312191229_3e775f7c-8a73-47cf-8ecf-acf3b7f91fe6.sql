
-- Tabela de controle de leitura por conversa/usuário
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reads"
  ON public.conversation_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_conversation_reads_user ON public.conversation_reads(user_id);

-- RPC para contar mensagens não lidas
CREATE OR REPLACE FUNCTION public.get_unread_counts(
  p_user_id uuid,
  p_conversation_ids uuid[]
)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.conversation_id,
    COUNT(*) as unread_count
  FROM public.messages m
  LEFT JOIN public.conversation_reads cr
    ON cr.conversation_id = m.conversation_id
    AND cr.user_id = p_user_id
  WHERE
    m.conversation_id = ANY(p_conversation_ids)
    AND m.sender_id != p_user_id
    AND (cr.last_read_at IS NULL OR m.criado_em > cr.last_read_at)
  GROUP BY m.conversation_id;
$$;
