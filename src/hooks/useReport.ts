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
  }: {
    reportedUserId: string;
    motivo: string;
    contexto: 'chat' | 'home';
    conversationId?: string;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };

    setLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          motivo,
          contexto,
          conversation_id: conversationId || null,
        });

      if (error) throw error;

      toast({
        title: 'Denúncia enviada',
        description: 'Agradecemos pelo aviso. Vamos analisar em breve.',
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
