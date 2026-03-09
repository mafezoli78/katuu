import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, ConversationWithDetails } from './useConversations';
import { PresenceLogicalState, PresenceEndReason } from './usePresence';
import { toast } from '@/components/ui/use-toast';

export type ConversationEndReason = 'manual' | 'presence_end' | 'system_suspended';

export interface ChatState {
  isActive: boolean;
  conversation: ConversationWithDetails | null;
  endedReason: ConversationEndReason | null;
  wasEndedByMe: boolean; // R3: Track who ended the conversation
  /** Indicates if the chat can potentially be recovered (system issue, not human action) */
  isRecoverable: boolean;
}

interface UseChatOptions {
  presenceState: { 
    logicalState: PresenceLogicalState;
    endReason: PresenceEndReason | null;
  };
  currentPresence: { place_id: string } | null;
}

export function useChat(options?: UseChatOptions) {
  const { user } = useAuth();
  const { conversations, refetch: refetchConversations, deactivateConversation } = useConversations();
  const [chatState, setChatState] = useState<ChatState>({
    isActive: false,
    conversation: null,
    endedReason: null,
    wasEndedByMe: false,
    isRecoverable: false,
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const previousLogicalState = useRef<PresenceLogicalState | null>(null);

  // CRITICAL: React to presence state transitions
  // RULE: Only 'ended' (human-initiated) clears chat definitively
  // 'suspended' (technical) marks as recoverable
  useEffect(() => {
    if (!options?.presenceState) return;
    
    const currentLogicalState = options.presenceState.logicalState;
    const endReason = options.presenceState.endReason;
    const prevState = previousLogicalState.current;
    
    // Track state transitions
    if (prevState !== null && prevState !== currentLogicalState) {
      console.log(`[useChat] Presence state transition: ${prevState} → ${currentLogicalState}`);
    }
    
    // Handle 'ended' state - ONLY for human-initiated actions
    if (currentLogicalState === 'ended' && prevState !== 'ended' && chatState.isActive) {
      const isHumanAction = endReason?.isHumanInitiated ?? true;
      
      if (isHumanAction) {
        console.log('[useChat] Presence ended (human action) - clearing active chat definitively');
        setChatState({
          isActive: false,
          conversation: null,
          endedReason: 'presence_end',
          wasEndedByMe: true, // Human action = definitive
          isRecoverable: false,
        });
      } else {
        // Technical reason reaching 'ended' - should not happen with new logic
        // but handle gracefully as recoverable
        console.log('[useChat] Presence ended (technical) - marking as recoverable');
        setChatState(prev => ({
          ...prev,
          isActive: false,
          endedReason: 'system_suspended',
          wasEndedByMe: false, // System issue, not user action
          isRecoverable: true,
        }));
      }
    }
    
    // Handle 'suspended' state - technical issue, potentially recoverable
    if (currentLogicalState === 'suspended' && prevState === 'active' && chatState.isActive) {
      console.log('[useChat] Presence suspended - marking chat as suspended (recoverable)');
      setChatState(prev => ({
        ...prev,
        endedReason: 'system_suspended',
        wasEndedByMe: false, // System suspension, not user action
        isRecoverable: true, // Can be recovered if presence revalidates
      }));
    }
    
    // Handle recovery from 'suspended' back to 'active'
    if (currentLogicalState === 'active' && prevState === 'suspended') {
      console.log('[useChat] Presence reactivated - chat may recover');
      // If chat was marked as suspended/recoverable, clear the suspension state
      if (chatState.isRecoverable && chatState.endedReason === 'system_suspended') {
        setChatState(prev => ({
          ...prev,
          endedReason: null,
          isRecoverable: false,
        }));
      }
    }
    
    previousLogicalState.current = currentLogicalState;
  }, [options?.presenceState?.logicalState, options?.presenceState?.endReason, chatState.isActive, chatState.isRecoverable]);

  // Belt and suspenders: if currentPresence is null AND endReason is human-initiated
  // Only clear chat definitively for human actions
  useEffect(() => {
    if (!options) return;
    
    const { currentPresence, presenceState } = options;
    const endReason = presenceState?.endReason;
    
    if (currentPresence === null && chatState.isActive) {
      const isHumanAction = endReason?.isHumanInitiated ?? false;
      
      if (isHumanAction) {
        console.log('[useChat] currentPresence is null (human action) - forcing cleanup');
        setChatState({
          isActive: false,
          conversation: null,
          endedReason: 'presence_end',
          wasEndedByMe: true,
          isRecoverable: false,
        });
      } else {
        // Technical reason - keep conversation reference, mark as suspended
        console.log('[useChat] currentPresence is null (technical) - marking suspended');
        setChatState(prev => ({
          ...prev,
          endedReason: 'system_suspended',
          wasEndedByMe: false,
          isRecoverable: true,
        }));
      }
    }
  }, [options?.currentPresence, options?.presenceState?.endReason, chatState.isActive]);

  // Subscribe to conversation changes (for real-time updates when other user ends chat)
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const conversationIds = conversations.map(c => c.id);
    
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const updated = payload.new as any;
          
          // Check if this is one of our conversations and it was deactivated
          if (conversationIds.includes(updated.id) && !updated.ativo) {
            console.log('[useChat] Conversation deactivated:', updated.id);
            
            const wasEndedByMe = updated.encerrado_por === user?.id;
            
            // Toast for the OTHER user — fired directly from Realtime handler
            // so it works regardless of Chat page being open or closed
            if (!wasEndedByMe) {
              toast({
                title: 'A outra pessoa encerrou a conversa',
                description: 'As mensagens foram apagadas',
              });
            }
            
            // If this was the active conversation, update state
            if (chatState.conversation?.id === updated.id) {
              setChatState({
                isActive: false,
                conversation: null,
                endedReason: updated.encerrado_motivo || 'manual',
                wasEndedByMe,
                isRecoverable: false,
              });
            }
            
            // Refetch conversations to update the list
            refetchConversations();
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
  }, [user, conversations, chatState.conversation?.id, refetchConversations]);

  const openChat = useCallback((conversation: ConversationWithDetails) => {
    // Validate that conversation has a valid place_id
    if (!conversation.place_id) {
      console.error('[useChat] Cannot open chat: conversation has no place_id');
      return;
    }
    
    setChatState({
      isActive: true,
      conversation,
      endedReason: null,
      wasEndedByMe: false,
      isRecoverable: false,
    });
  }, []);

  const closeChat = useCallback(() => {
    setChatState({
      isActive: false,
      conversation: null,
      endedReason: null,
      wasEndedByMe: false,
      isRecoverable: false,
    });
  }, []);

  const endChat = useCallback(async (reason: ConversationEndReason = 'manual') => {
    if (!chatState.conversation || !user) return { error: new Error('No active chat') };

    const conversationId = chatState.conversation.id;

    try {
      // RPC ATÔMICA: encerra conversa + deleta mensagens + aplica cooldown
      const { error } = await supabase.rpc('end_conversation', {
        p_user_id: user.id,
        p_conversation_id: conversationId,
        p_motivo: reason,
      });

      if (error) {
        if (error.message.includes('END_CONV_ALREADY_ENDED')) {
          console.log('[useChat] Conversation already ended');
        } else {
          throw error;
        }
      }

      console.log('[useChat] Chat ended via RPC:', reason);

      setChatState({
        isActive: false,
        conversation: null,
        endedReason: reason,
        wasEndedByMe: true,
        isRecoverable: false,
      });

      refetchConversations();
      return { error: null };
    } catch (error) {
      console.error('[useChat] Error ending chat:', error);
      return { error: error as Error };
    }
  }, [chatState.conversation, user, refetchConversations]);

  // Called when presence ends (from usePresence)
  // endAllChatsForPresence: DB cleanup is handled by end_presence_cascade RPC
  // This function only cleans up local React state
  const endAllChatsForPresence = useCallback(async (_placeId?: string) => {
    if (!user) return;

    console.log('[useChat] Presence ended - cleaning up local chat state (DB handled by end_presence_cascade)');

    setChatState({
      isActive: false,
      conversation: null,
      endedReason: 'presence_end',
      wasEndedByMe: true,
      isRecoverable: false,
    });

    refetchConversations();
  }, [user, refetchConversations]);

  const clearEndedReason = useCallback(() => {
    setChatState(prev => ({ ...prev, endedReason: null, wasEndedByMe: false, isRecoverable: false }));
  }, []);

  return {
    chatState,
    activeConversations: conversations,
    openChat,
    closeChat,
    endChat,
    endAllChatsForPresence,
    clearEndedReason,
    refetchConversations,
  };
}
