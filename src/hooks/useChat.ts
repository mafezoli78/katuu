import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, ConversationWithDetails } from './useConversations';
import { PresenceLogicalState, PresenceEndReason } from './usePresence';
import { toast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

export type ConversationEndReason = 'manual' | 'presence_end' | 'system_suspended';

export interface ChatState {
  isActive: boolean;
  conversation: ConversationWithDetails | null;
  endedReason: ConversationEndReason | null;
  wasEndedByMe: boolean;
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
  const { conversations, loading: conversationsLoading, refetch: refetchConversations, deactivateConversation, addConversationUpdateListener } = useConversations();
  const [chatState, setChatState] = useState<ChatState>({
    isActive: false,
    conversation: null,
    endedReason: null,
    wasEndedByMe: false,
    isRecoverable: false,
  });
  const previousLogicalState = useRef<PresenceLogicalState | null>(null);

  // Reage a transições de estado de presença
  useEffect(() => {
    if (!options?.presenceState) return;
    
    const currentLogicalState = options.presenceState.logicalState;
    const endReason = options.presenceState.endReason;
    const prevState = previousLogicalState.current;
    
    if (prevState !== null && prevState !== currentLogicalState) {
      logger.debug(`[useChat] Presence state transition: ${prevState} → ${currentLogicalState}`);
    }
    
    if (currentLogicalState === 'ended' && prevState !== 'ended' && chatState.isActive) {
      const isHumanAction = endReason?.isHumanInitiated ?? true;
      
      if (isHumanAction) {
        logger.debug('[useChat] Presence ended (human action) - clearing active chat definitively');
        setChatState({
          isActive: false,
          conversation: null,
          endedReason: 'presence_end',
          wasEndedByMe: true,
          isRecoverable: false,
        });
      } else {
        logger.debug('[useChat] Presence ended (technical) - marking as recoverable');
        setChatState(prev => ({
          ...prev,
          isActive: false,
          endedReason: 'system_suspended',
          wasEndedByMe: false,
          isRecoverable: true,
        }));
      }
    }
    
    if (currentLogicalState === 'suspended' && prevState === 'active' && chatState.isActive) {
      logger.debug('[useChat] Presence suspended - marking chat as suspended (recoverable)');
      setChatState(prev => ({
        ...prev,
        endedReason: 'system_suspended',
        wasEndedByMe: false,
        isRecoverable: true,
      }));
    }
    
    if (currentLogicalState === 'active' && prevState === 'suspended') {
      logger.debug('[useChat] Presence reactivated - chat may recover');
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

  useEffect(() => {
    if (!options) return;
    
    const { currentPresence, presenceState } = options;
    const endReason = presenceState?.endReason;
    
    if (currentPresence === null && chatState.isActive) {
      const isHumanAction = endReason?.isHumanInitiated ?? false;
      
      if (isHumanAction) {
        logger.debug('[useChat] currentPresence is null (human action) - forcing cleanup');
        setChatState({
          isActive: false,
          conversation: null,
          endedReason: 'presence_end',
          wasEndedByMe: true,
          isRecoverable: false,
        });
      } else {
        logger.debug('[useChat] currentPresence is null (technical) - marking suspended');
        setChatState(prev => ({
          ...prev,
          endedReason: 'system_suspended',
          wasEndedByMe: false,
          isRecoverable: true,
        }));
      }
    }
  }, [options?.currentPresence, options?.presenceState?.endReason, chatState.isActive]);

  // Escuta atualizações de conversas via listener centralizado do useConversations
  // Sem criar canal Realtime próprio — elimina o conflito de canais
  useEffect(() => {
    if (!user) return;

    const unsubscribe = addConversationUpdateListener((payload) => {
      const updated = payload.new as any;

      if (!updated.ativo) {
        const wasEndedByMe = updated.encerrado_por === user?.id;
        const motivo = updated.encerrado_motivo || 'manual';

        // Só mostra toast se o chat estiver ativo E foi encerrado por outro
        if (!wasEndedByMe && chatState.conversation?.id === updated.id) {
          const isPresenceEnd = motivo === 'presence_end';
          toast({
            title: isPresenceEnd
              ? 'A outra pessoa saiu do local'
              : 'A outra pessoa encerrou a conversa',
            description: 'As mensagens foram apagadas',
          });
        }

        // Fecha o chat se estiver aberto
        if (chatState.conversation?.id === updated.id) {
          setChatState({
            isActive: false,
            conversation: null,
            endedReason: motivo,
            wasEndedByMe,
            isRecoverable: false,
          });
        }

        refetchConversations();
      }
    });

    return () => unsubscribe();
  }, [user, chatState.conversation?.id, refetchConversations, addConversationUpdateListener]);

  const openChat = useCallback((conversation: ConversationWithDetails) => {
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
      const { error } = await supabase.rpc('end_conversation', {
        p_conversation_id: conversationId,
        p_motivo: reason,
      });

      if (error) {
        if (error.message.includes('END_CONV_ALREADY_ENDED')) {
          logger.debug('[useChat] Conversation already ended');
        } else {
          throw error;
        }
      }

      logger.debug('[useChat] Chat ended via RPC:', reason);

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

  const endAllChatsForPresence = useCallback(async (_placeId?: string) => {
    if (!user) return;

    logger.debug('[useChat] Presence ended - cleaning up local chat state (DB handled by end_presence_cascade)');

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
    loading: conversationsLoading,
  };
}
