import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const MOTIVOS = [
  { value: 'comportamento_inapropriado', label: 'Comportamento inapropriado' },
  { value: 'assedio_ou_ameacas', label: 'Assédio ou ameaças' },
  { value: 'perfil_falso', label: 'Perfil falso' },
  { value: 'spam', label: 'Spam' },
  { value: 'outro', label: 'Outro' },
];

export { MOTIVOS };

export function useReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const sendReport = async ({
    reportedUserId,
    motivo,
    contexto,
    conversationId,
    placeId,
    onChatEnd,
  }: {
    reportedUserId: string;
    motivo: string;
    contexto: 'chat' | 'home' | 'wave';
    conversationId?: string;
    placeId?: string;
    onChatEnd?: () => void;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };

    setLoading(true);
    try {
      // 1. Registra a denúncia via RPC — PRECISA vir antes do bloqueio e do
      // encerramento: o submit_report faz o snapshot de evidência das
      // mensagens antes que o hard-delete da conversa as apague.
      const { error: reportError } = await supabase.rpc('submit_report', {
        p_reported_user_id: reportedUserId,
        p_motivo: motivo,
        p_contexto: contexto,
        p_place_id: placeId || null,
        p_conversation_id: conversationId || null,
      });

      if (reportError) {
        // Denúncia repetida (mesma dupla em 24h): segue o fluxo de
        // bloqueio/encerramento mesmo assim, só não duplica o registro.
        if (reportError.message?.includes('DUPLICATE_REPORT')) {
          console.warn('[useReport] Denúncia duplicada em 24h, seguindo fluxo');
        } else {
          throw reportError;
        }
      }

      // 2. Bloqueia o usuário automaticamente
      const { error: blockError } = await supabase.rpc('block_user', {
        p_blocked_user_id: reportedUserId,
      });
      if (blockError) {
        console.error('[useReport] block_user error:', blockError);
      }

      // 3. Se veio do chat, encerra a conversa (hard-delete)
      if (contexto === 'chat' && conversationId) {
        await supabase.rpc('end_conversation', {
          p_conversation_id: conversationId,
          p_motivo: 'report',
        });
        onChatEnd?.();
      }

      toast({
        title: 'Denúncia enviada',
        description: 'Usuário bloqueado e denúncia registrada.',
      });

      return { error: null };
    } catch (err) {
      console.error('[useReport] Error sending report:', err);
      toast({
        title: 'Erro ao enviar denúncia',
        variant: 'destructive',
      });
      return { error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  return { sendReport, loading };
}
