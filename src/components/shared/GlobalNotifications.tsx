import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { MessageCircle } from 'lucide-react';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { getActiveChatId } from '@/lib/activeChat';

/**
 * Notificações in-app GLOBAIS — montado junto das rotas, funciona em
 * qualquer tela com o app aberto:
 *  - Aceno recebido  → toast + ação "Ver acenos"
 *  - Nova mensagem   → toast + ação "Abrir chat"
 * Silencia mensagens da conversa que o usuário está vendo agora
 * (registrada pelo ChatWindow via lib/activeChat).
 * As notificações com app FECHADO são responsabilidade do FCM (push).
 */
export function GlobalNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversations } = useConversationsContext();

  // Refs para o canal estático ler valores atuais sem reinscrever
  const conversationIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map(c => c.id));
  }, [conversations]);

  const userIdRef = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global-notifications-${user.id}`)
      // Aceno recebido
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waves' }, (payload) => {
        const wave = payload.new as any;
        if (wave?.para_user_id !== userIdRef.current || wave?.status !== 'pending') return;
        toast({
          title: 'Você recebeu um aceno! 👋',
          action: (
            <ToastAction altText="Ver acenos" onClick={() => navigate('/waves')}>
              <HandshakeIcon className="h-4 w-4 mr-1" /> Ver acenos
            </ToastAction>
          ),
        });
      })
      // Nova mensagem (em qualquer conversa minha que NÃO esteja aberta)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as any;
        if (!message) return;
        if (message.sender_id === userIdRef.current) return;
        if (!conversationIdsRef.current.has(message.conversation_id)) return;
        if (getActiveChatId() === message.conversation_id) return; // já está vendo

        const preview: string = message.conteudo || '';
        toast({
          title: 'Nova mensagem',
          description: preview.length > 60 ? preview.slice(0, 60) + '...' : preview,
          duration: 4000,
          action: (
            <ToastAction
              altText="Abrir chat"
              onClick={() => navigate(`/chat?conversationId=${message.conversation_id}`)}
            >
              <MessageCircle className="h-4 w-4 mr-1" /> Abrir
            </ToastAction>
          ),
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, navigate]);

  return null;
}
