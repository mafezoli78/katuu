import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { MessageCircle } from 'lucide-react';
import { getSignedSelfieUrls } from '@/lib/storage';
import type { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['conversations']['Row'];

export interface ConversationWithDetails extends Conversation {
  otherUser: {
    id: string;
    nome: string | null;
    foto_url: string | null;
    checkin_selfie_url: string | null;
  };
  place: {
    id: string;
    nome: string;
  };
}

interface ConversationsContextType {
  conversations: ConversationWithDetails[];
  loading: boolean;
  refetch: () => Promise<void>;
  deactivateConversation: (conversationId: string) => Promise<{ error: any }>;
  getConversationWithUser: (otherUserId: string, placeId?: string) => ConversationWithDetails | undefined;
  addConversationUpdateListener: (listener: (payload: any) => void) => () => void;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const knownConversationIds = useRef<Set<string>>(new Set());
  const updateListeners = useRef<Set<(payload: any) => void>>(new Set());

  const addConversationUpdateListener = useCallback((listener: (payload: any) => void) => {
    updateListeners.current.add(listener);
    return () => updateListeners.current.delete(listener);
  }, []);

  const fetchConversations = useCallback(async () => {
    // Log crucial para depuração no Logcat
    console.log('[ConversationsContext] Iniciando fetchConversations para usuário:', user?.id);

    if (!user) {
      console.log('[ConversationsContext] Sem usuário, limpando conversas');
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Uma única RPC substitui N+1 queries (places + locations + presence por conversa)
      const { data, error } = await supabase.rpc('get_active_conversations');
      if (error) throw error;

      const rows = (data as any[]) || [];
      console.log(`[ConversationsContext] ${rows.length} conversas encontradas no banco`);

      // Resolve signed URLs para selfies (batch)
      const selfiePaths = rows
        .map((r: any) => r.other_user_selfie_url)
        .filter((p: any): p is string => !!p && !p.startsWith('http'));

      const signedUrls = selfiePaths.length > 0 ? await getSignedSelfieUrls(selfiePaths) : new Map();

      const conversationsWithDetails: ConversationWithDetails[] = rows.map((r: any) => {
        const rawSelfie = r.other_user_selfie_url || null;
        const selfieUrl = rawSelfie && signedUrls.has(rawSelfie) ? signedUrls.get(rawSelfie)! : rawSelfie;
        return {
          id: r.id,
          user1_id: r.user1_id,
          user2_id: r.user2_id,
          place_id: r.place_id,
          ativo: r.ativo,
          criado_em: r.criado_em,
          encerrado_por: r.encerrado_por,
          encerrado_em: r.encerrado_em,
          encerrado_motivo: r.encerrado_motivo,
          reinteracao_permitida_em: r.reinteracao_permitida_em,
          origem_wave_id: r.origem_wave_id,
          intention: r.intention,
          intention_message: r.intention_message,
          otherUser: {
            id: r.other_user_id,
            nome: r.other_user_nome,
            foto_url: r.other_user_foto_url,
            checkin_selfie_url: selfieUrl,
          },
          place: {
            id: r.place_id,
            nome: r.place_nome,
          },
        };
      });

      knownConversationIds.current = new Set(conversationsWithDetails.map(c => c.id));
      setConversations(conversationsWithDetails);
      console.log('[ConversationsContext] Estado de conversas atualizado com sucesso');
    } catch (error) {
      console.error('[ConversationsContext] Erro ao buscar conversas:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // Dependência no ID garante estabilidade

  // Efeito principal: Dispara a busca sempre que o ID do usuário mudar
  useEffect(() => {
    fetchConversations();
  }, [user?.id, fetchConversations]);

  // Refetch ao voltar do background: eventos Realtime perdidos enquanto o
  // WebView estava suspenso não são reentregues — visibilitychange cobre o
  // resume do app nativo sem depender de plugin do Capacitor.
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ConversationsContext] App visível novamente — refetch');
        fetchConversations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id, fetchConversations]);

  // Efeito de Realtime: Gerencia a inscrição de forma limpa
  useEffect(() => {
    if (!user) return;

    const handleRealtimeEvent = async (payload: any) => {
      console.log('[ConversationsContext] Evento Realtime recebido:', payload.eventType);

      // DELETE: payload.new é vazio — usa payload.old
      // UPDATE/INSERT: usa payload.new
      const conv = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Conversation;

      // DELETE: com RLS habilitado, o Realtime envia APENAS a primary key no
      // payload.old (mesmo com REPLICA IDENTITY FULL) — user1_id/user2_id
      // chegam undefined. Por isso o filtro aqui é por id conhecido: se o id
      // está em knownConversationIds, a conversa era deste usuário.
      if (payload.eventType === 'DELETE') {
        const convId = (conv as any)?.id;
        if (convId && knownConversationIds.current.has(convId)) {
          updateListeners.current.forEach(listener => listener(payload));
          setConversations(prev => prev.filter(c => c.id !== convId));
          knownConversationIds.current.delete(convId);
        }
        return;
      }

      // Filtro de segurança (INSERT/UPDATE têm o registro completo)
      if (conv.user1_id !== user.id && conv.user2_id !== user.id) return;

      updateListeners.current.forEach(listener => listener(payload));

      if (payload.eventType === 'INSERT' && !knownConversationIds.current.has(conv.id) && conv.ativo) {
        knownConversationIds.current.add(conv.id);
        if (conv.user2_id === user.id) {
          fetchConversations();
          const { data: profile } = await supabase.from('profiles').select('nome').eq('id', conv.user1_id).single();
          toast({
            title: 'Chat iniciado! 🎉',
            description: `Você agora pode conversar com ${profile?.nome || 'Alguém'}`,
            action: (
              <ToastAction altText="Abrir chat" onClick={() => navigate(`/chat?conversationId=${conv.id}`)}>
                <MessageCircle className="h-4 w-4 mr-1" /> Abrir chat
              </ToastAction>
            ),
          });
          return;
        }
      }
      fetchConversations();
    };

    // Sempre limpa o canal anterior antes de criar um novo para evitar closures obsoletas
    if (channelRef.current) {
      console.log('[ConversationsContext] Removendo canal antigo');
      supabase.removeChannel(channelRef.current);
    }

    console.log('[ConversationsContext] Inscrevendo em novo canal Realtime para usuário:', user.id);
    const channel = supabase
      .channel(`conversations-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, handleRealtimeEvent)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[ConversationsContext] Inscrito no Realtime com sucesso');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, fetchConversations, navigate]);

  const deactivateConversation = async (conversationId: string) => {
    const { error } = await supabase.rpc('end_conversation', {
      p_conversation_id: conversationId,
      p_motivo: 'manual',
    });
    if (!error) fetchConversations();
    return { error };
  };

  const getConversationWithUser = (otherUserId: string, placeId?: string) => {
    return conversations.find(c => c.otherUser.id === otherUserId && (!placeId || c.place_id === placeId));
  };

  return (
    <ConversationsContext.Provider value={{
      conversations,
      loading,
      refetch: fetchConversations,
      deactivateConversation,
      getConversationWithUser,
      addConversationUpdateListener
    }}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext() {
  const context = useContext(ConversationsContext);
  if (!context) throw new Error('useConversationsContext must be used within a ConversationsProvider');
  return context;
}
