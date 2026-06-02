import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/use-toast';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  conteudo: string;
  criado_em: string;
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('criado_em', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error('[useMessages] Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversationId || !user) return;

    fetchMessages();

    // Create realtime subscription
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          logger.debug('[useMessages] New message received:', payload);
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          // Notifica internamente se a mensagem for de outro usuário
          if (newMessage.sender_id !== user.id) {
            toast({
              title: 'Nova mensagem',
              description: newMessage.conteudo.length > 60
                ? newMessage.conteudo.slice(0, 60) + '...'
                : newMessage.conteudo,
              duration: 3000,
            });
          }
        }
      )
      .subscribe((status) => {
        logger.debug(`[useMessages] Subscription status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      logger.debug('[useMessages] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, user, fetchMessages]);

  const sendMessage = async (conteudo: string): Promise<{ error: Error | null }> => {
    if (!conversationId || !user || !conteudo.trim()) {
      return { error: new Error('Invalid message') };
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          conteudo: conteudo.trim(),
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[useMessages] Error sending message:', error);
      return { error: error as Error };
    } finally {
      setSending(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    loading,
    sending,
    sendMessage,
    clearMessages,
    refetch: fetchMessages,
  };
}
