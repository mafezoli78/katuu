import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadCounts {
  byConversation: Record<string, number>;
  totalConversationsWithUnread: number;
}

/**
 * Tracks unread message counts using the persistent conversation_reads table.
 * Uses the get_unread_counts RPC for efficient server-side counting.
 */
export function useUnreadMessages(conversationIds: string[]) {
  const { user } = useAuth();
  const [unread, setUnread] = useState<UnreadCounts>({
    byConversation: {},
    totalConversationsWithUnread: 0,
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user || conversationIds.length === 0) {
      setUnread({ byConversation: {}, totalConversationsWithUnread: 0 });
      return;
    }

    const { data, error } = await supabase.rpc('get_unread_counts', {
      p_conversation_ids: conversationIds,
    });

    if (error) {
      console.error('[useUnreadMessages] Error fetching unread counts:', error);
      return;
    }

    if (!mountedRef.current) return;

    const byConversation: Record<string, number> = {};
    let totalConversationsWithUnread = 0;

    (data || []).forEach((row: { conversation_id: string; unread_count: number }) => {
      byConversation[row.conversation_id] = row.unread_count;
      if (row.unread_count > 0) totalConversationsWithUnread++;
    });

    setUnread({ byConversation, totalConversationsWithUnread });
  }, [user, conversationIds.join(',')]);

  // Mark a conversation as read — call when opening a chat
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    // Optimistic local update
    setUnread(prev => {
      const wasUnread = (prev.byConversation[conversationId] || 0) > 0;
      return {
        byConversation: { ...prev.byConversation, [conversationId]: 0 },
        totalConversationsWithUnread: wasUnread
          ? Math.max(0, prev.totalConversationsWithUnread - 1)
          : prev.totalConversationsWithUnread,
      };
    });

    // Persist to database
    await supabase
      .from('conversation_reads' as any)
      .upsert(
        {
          conversation_id: conversationId,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        } as any,
        { onConflict: 'conversation_id,user_id' }
      );
  }, [user]);

  // Fetch on mount and when conversations change
  useEffect(() => {
    mountedRef.current = true;
    fetchUnreadCounts();
    return () => { mountedRef.current = false; };
  }, [fetchUnreadCounts]);

  // Realtime: re-fetch when new message arrives
  useEffect(() => {
    if (!user || conversationIds.length === 0) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('unread-messages-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          if (conversationIds.includes(msg.conversation_id) && msg.sender_id !== user.id) {
            // Otimistic update: increment immediately without waiting for DB round-trip
            setUnread(prev => {
              const current = prev.byConversation[msg.conversation_id] || 0;
              const wasZero = current === 0;
              return {
                byConversation: {
                  ...prev.byConversation,
                  [msg.conversation_id]: current + 1,
                },
                totalConversationsWithUnread: wasZero
                  ? prev.totalConversationsWithUnread + 1
                  : prev.totalConversationsWithUnread,
              };
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, conversationIds.join(','), fetchUnreadCounts]);

  // Legacy compatibility aliases
  const unreadCounts = unread.byConversation;
  const totalUnread = unread.totalConversationsWithUnread;

  return {
    unread,
    unreadCounts,
    totalUnread,
    markAsRead,
    refetch: fetchUnreadCounts,
  };
}
