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
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          user1_profile:profiles!conversations_user1_id_fkey (id, nome, foto_url),
          user2_profile:profiles!conversations_user2_id_fkey (id, nome, foto_url)
        `)
        .eq('ativo', true)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      console.log(`[ConversationsContext] ${data?.length || 0} conversas encontradas no banco`);

      const conversationsWithDetails: ConversationWithDetails[] = await Promise.all((data || []).map(async (conv: any) => {
        const isUser1 = conv.user1_id === user.id;
        const otherProfile = isUser1 ? conv.user2_profile : conv.user1_profile;

        let placeName = 'Local desconhecido';
        const [placeRes, locationRes] = await Promise.all([
          supabase.from('places').select('nome').eq('id', conv.place_id).maybeSingle(),
          supabase.from('locations').select('nome').eq('id', conv.place_id).maybeSingle()
        ]);
        
        placeName = placeRes.data?.nome || locationRes.data?.nome || 'Local desconhecido';

        return {
          ...conv,
          otherUser: {
            id: otherProfile.id,
            nome: otherProfile.nome,
            foto_url: otherProfile.foto_url,
            checkin_selfie_url: null,
          },
          place: {
            id: conv.place_id,
            nome: placeName
          },
        };
      }));

      const otherUserIds = conversationsWithDetails.map(c => c.otherUser.id);
      if (otherUserIds.length > 0) {
        const { data: presences } = await supabase
          .from('presence')
          .select('user_id, checkin_selfie_url')
          .in('user_id', otherUserIds)
          .eq('ativo', true);

        const presenceMap = new Map(presences?.map(p => [p.user_id, p.checkin_selfie_url]));
        const selfiePaths = (presences || [])
          .map(p => p.checkin_selfie_url)
          .filter((p): p is string => !!p && !p.startsWith('http' ));
        
        const signedUrls = selfiePaths.length > 0 ? await getSignedSelfieUrls(selfiePaths) : new Map();

        conversationsWithDetails.forEach(c => {
          const rawPath = presenceMap.get(c.otherUser.id) || null;
          c.otherUser.checkin_selfie_url = (rawPath && signedUrls.has(rawPath)) ? signedUrls.get(rawPath)! : rawPath;
        });
      }

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

  // Efeito de Realtime: Gerencia a inscrição de forma limpa
  useEffect(() => {
    if (!user) return;

    const handleRealtimeEvent = async (payload: any) => {
      console.log('[ConversationsContext] Evento Realtime recebido:', payload.eventType);
      const conv = payload.new as Conversation;
      
      // Filtro de segurança para garantir que o evento pertence ao usuário atual
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
    const { error } = await supabase.from('conversations').update({ ativo: false }).eq('id', conversationId);
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
