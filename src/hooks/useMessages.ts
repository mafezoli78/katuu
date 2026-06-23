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
  editado_em?: string | null;
  deletado_em?: string | null;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/** Janela de edição/exclusão — espelha a regra dos RPCs (15 min) */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map(m => m.id));
  }, [messages]);

  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) {
      setReactions([]);
      return;
    }
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds);
    if (!error) setReactions((data as MessageReaction[]) || []);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      setReactions([]);
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
      const msgs = (data as Message[]) || [];
      setMessages(msgs);
      await fetchReactions(msgs.map(m => m.id));
    } catch (error) {
      console.error('[useMessages] Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, fetchReactions]);

  // Subscribe to realtime messages + reactions
  useEffect(() => {
    if (!conversationId || !user) return;

    fetchMessages();

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
          // Toast de nova mensagem agora é responsabilidade do
          // GlobalNotifications (que silencia a conversa aberta)
        }
      )
      // Edições e exclusões soft chegam como UPDATE (REPLICA IDENTITY FULL)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
          if (updated.deletado_em) {
            setReactions(prev => prev.filter(r => r.message_id !== updated.id));
          }
        }
      )
      // Reações: sem filtro server-side (a tabela não tem conversation_id);
      // filtra no cliente pelas mensagens em tela. DELETE chega só com PK.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setReactions(prev => prev.filter(r => r.id !== oldId));
            return;
          }
          const reaction = payload.new as MessageReaction;
          if (!messageIdsRef.current.has(reaction.message_id)) return;
          setReactions(prev => {
            const without = prev.filter(r => r.id !== reaction.id);
            return [...without, reaction];
          });
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

  const mapMessageActionError = (msg: string): string => {
    if (msg.includes('WINDOW_EXPIRED')) return 'O prazo de 15 minutos para alterar esta mensagem expirou';
    if (msg.includes('NOT_SENDER')) return 'Você só pode alterar suas próprias mensagens';
    if (msg.includes('MSG_DELETED') || msg.includes('ALREADY_DELETED')) return 'Esta mensagem foi apagada';
    if (msg.includes('MSG_EMPTY')) return 'A mensagem não pode ficar vazia';
    if (msg.includes('NOT_FOUND')) return 'Mensagem não encontrada';
    return 'Não foi possível alterar a mensagem';
  };

  const editMessage = async (messageId: string, conteudo: string): Promise<{ error: Error | null }> => {
    if (!conteudo.trim()) return { error: new Error('A mensagem não pode ficar vazia') };

    const { error } = await supabase.rpc('edit_message', {
      p_message_id: messageId,
      p_conteudo: conteudo.trim(),
    });

    if (error) {
      return { error: new Error(mapMessageActionError(error.message)) };
    }

    // Atualização otimista local (o UPDATE do Realtime confirma em seguida)
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, conteudo: conteudo.trim(), editado_em: new Date().toISOString() }
        : m
    ));
    return { error: null };
  };

  const deleteMessage = async (messageId: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.rpc('delete_message', {
      p_message_id: messageId,
    });

    if (error) {
      return { error: new Error(mapMessageActionError(error.message)) };
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, conteudo: '', deletado_em: new Date().toISOString(), editado_em: null }
        : m
    ));
    setReactions(prev => prev.filter(r => r.message_id !== messageId));
    return { error: null };
  };

  /**
   * Toggle de reação (otimista): mesma emoji = remove; outra = troca; nenhuma = cria.
   */
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const mine = reactions.find(r => r.message_id === messageId && r.user_id === user.id);

    try {
      if (mine && mine.emoji === emoji) {
        setReactions(prev => prev.filter(r => r.id !== mine.id));
        const { error } = await supabase.from('message_reactions').delete().eq('id', mine.id);
        if (error) throw error;
      } else if (mine) {
        setReactions(prev => prev.map(r => (r.id === mine.id ? { ...r, emoji } : r)));
        const { error } = await supabase.from('message_reactions').update({ emoji }).eq('id', mine.id);
        if (error) throw error;
      } else {
        const tempId = `temp-${Date.now()}`;
        setReactions(prev => [...prev, { id: tempId, message_id: messageId, user_id: user.id, emoji }]);
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: user.id, emoji })
          .select()
          .single();
        if (error) throw error;
        setReactions(prev => prev.map(r => (r.id === tempId ? (data as MessageReaction) : r)));
      }
    } catch (error) {
      console.error('[useMessages] Error toggling reaction:', error);
      // Rollback simples: ressincroniza do banco
      fetchReactions(Array.from(messageIdsRef.current));
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setReactions([]);
  };

  return {
    messages,
    reactions,
    loading,
    sending,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    clearMessages,
    refetch: fetchMessages,
  };
}
