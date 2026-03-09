import type { Database } from '@/integrations/supabase/types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export function useConversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const knownConversationIds = useRef<Set<string>>(new Set());

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          place:places (
            id,
            nome
          ),
          user1_profile:profiles!conversations_user1_id_fkey (
            id,
            nome,
            foto_url
          ),
          user2_profile:profiles!conversations_user2_id_fkey (
            id,
            nome,
            foto_url
          )
        `)
        .eq('ativo', true)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      const conversationsWithDetails: ConversationWithDetails[] =
        (data || []).map((conv: any) => {
          const isUser1 = conv.user1_id === user.id;
          const otherProfile = isUser1
            ? conv.user2_profile
            : conv.user1_profile;

          return {
            ...conv,
            otherUser: {
              id: otherProfile.id,
              nome: otherProfile.nome,
              foto_url: otherProfile.foto_url,
              checkin_selfie_url: null,
            },
            place: conv.place,
          };
        });

      // Buscar presence em lote
      const otherUserIds = conversationsWithDetails.map(c => c.otherUser.id);

      if (otherUserIds.length > 0) {
        const { data: presences } = await supabase
          .from('presence')
          .select('user_id, checkin_selfie_url')
          .in('user_id', otherUserIds)
          .eq('ativo', true);

        const presenceMap = new Map(
          presences?.map(p => [p.user_id, p.checkin_selfie_url])
        );

        conversationsWithDetails.forEach(c => {
          c.otherUser.checkin_selfie_url =
            presenceMap.get(c.otherUser.id) || null;
        });
      }

      knownConversationIds.current = new Set(
        conversationsWithDetails.map(c => c.id)
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;

    let debounceTimeout: NodeJS.Timeout;

    const debouncedRefetch = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        fetchConversations();
      }, 500);
    };

    const intervalId = setInterval(() => {
      if (!document.hidden) {
        debouncedRefetch();
      }
    }, 15000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(debounceTimeout);
    };
  }, [user, fetchConversations]);

  useEffect(() => {
    if (!user) return;

    let debounceTimeout: NodeJS.Timeout;

    const handleRealtimeEvent = async (eventType: string, payload: any) => {
      const conv = payload.new as Conversation;

      const involvesMe =
        conv.user1_id === user.id || conv.user2_id === user.id;

      if (!involvesMe) return;

      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        if (
          eventType === 'INSERT' &&
          !knownConversationIds.current.has(conv.id) &&
          conv.ativo
        ) {
          knownConversationIds.current.add(conv.id);

          if (conv.user2_id === user.id) {
            fetchConversations();
            return;
          }

          const otherUserId =
            conv.user1_id === user.id
              ? conv.user2_id
              : conv.user1_id;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', otherUserId)
            .single();

          toast({
            title: 'Chat iniciado! 🎉',
            description: `Você agora pode conversar com ${profileData?.nome || 'Alguém'}`,
            action: (
              <ToastAction
                altText="Abrir conversa"
                onClick={() =>
                  navigate(`/chat?conversationId=${conv.id}`)
                }
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Abrir chat
              </ToastAction>
            ),
          });
        }

        fetchConversations();
      }, 500);
    };

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        payload => handleRealtimeEvent('INSERT', payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        payload => handleRealtimeEvent('UPDATE', payload)
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      clearTimeout(debounceTimeout);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchConversations, navigate]);

  const addConversation = (conversation: Conversation) => {
    knownConversationIds.current.add(conversation.id);
    fetchConversations();
  };

  const deactivateConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ ativo: false })
      .eq('id', conversationId);

    if (!error) {
      setConversations(prev =>
        prev.filter(c => c.id !== conversationId)
      );
    }

    return { error };
  };

  const getConversationWithUser = (
    otherUserId: string,
    placeId?: string
  ) => {
    return conversations.find(c => {
      const isMatch = c.otherUser.id === otherUserId;
      if (placeId) {
        return isMatch && c.place_id === placeId;
      }
      return isMatch;
    });
  };

  return {
    conversations,
    loading,
    addConversation,
    deactivateConversation,
    getConversationWithUser,
    refetch: fetchConversations,
  };
}
