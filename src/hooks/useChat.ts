import { useState, useEffect, useCallback } from 'react';
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

const INITIAL_STATE: ChatState = {
  isActive: false,
  conversation: null,
  endedReason: null,
  wasEndedByMe: false,
  isRecoverable: false,
};

export function useChat(options?: UseChatOptions) {
  const { user } = useAuth();
  const {
    conversations,
    loading: conversationsLoading,
    refetch: refetchConversations,
    deactivateConversation,
    addConversationUpdateListener,
  } = useConversations();

  const [chatState, setChatState] = useState<ChatState>(INITIAL_STATE);

  // Único efeito para reagir a mudanças de presença
  // Substitui os dois useEffects anteriores com lógica sobreposta
  useEffect(() => {
    if (!options?.presenceState || !chatState.isActive) return;

    const { logicalState, endReason } = options.presenceState;
    const isHumanAction = endReason?.isHumanInitiated ?? false;

    if (logicalState === 'ended') {
      logger.debug(`[useChat] Presence ended (${isHumanAction ? 'human' : 'technical'})`);
      setChatState(prev => ({
        ...prev,
        isActive: false,
        conversation: isHumanAction ? null : prev.conversation,
        endedReason: isHumanAction ? 'presence_end' : 'system_suspended',
        wasEndedByMe: isHumanAction,
        isRecoverable: !isHumanAction,
      }));
      return;
    }

    if (logicalState === 'suspended') {
      logger.debug('[useChat] Presence suspended - chat recoverable');
      setChatState(prev => ({
        ...prev,
        endedReason: 'system_suspended',
        wasEndedByMe: false,
        isRecoverable: true,
      }));
      return;
    }

    if (logicalState === 'active' && chatState.isRecoverable && chatState.endedReason === 'system_suspended') {
      logger.debug('[useChat] Presence reactivated - recovering chat');
      setChatState(prev => ({
        ...prev,
        endedReason: null,
        isRecoverable: false,
      }));
    }
  }, [options?.presenceState?.logicalState, options?.presenceState?.endReason]);

  // Reage quando currentPresence some (saída do local)
  useEffect(() => {
    if (!options || options.currentPresence !== null || !chatState.isActive) return;

    const isHumanAction = options.presenceState?.endReason?.isHumanInitiated ?? false;
    logger.debug(`[useChat] currentPresence null (${isHumanAction ? 'human' : 'technical'})`);

    setChatState(prev => ({
      ...prev,
      isActive: false,
      conversation: isHumanAction ? null : prev.conversation,
      endedReason: isHumanAction ? 'presence_end' : 'system_suspended',
      wasEndedByMe: isHumanAction,
      isRecoverable: !isHumanAction,
    }));
  }, [options?.currentPresence]);

  // Escuta atualizações de conversas via listener centralizado
  useEffect(() => {
    if (!user) return;

    const unsubscribe = addConversationUpdateListener((payload) => {
      const updated = payload.new as any;
      if (!updated.ativo) {
        const wasEndedByMe = updated.encerrado_por === user.id;
        const motivo = updated.encerrado_motivo || 'manual';

        if (!wasEndedByMe && chatState.conversation?.id === updated.id) {
          toast({
            title: motivo === 'presence_end'
              ? 'A outra pessoa saiu do local'
              : 'A outra pessoa encerrou a conversa',
            description: 'As mensagens foram apagadas',
          });
        }

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
    setChatState({ isActive: true, conversation, endedReason: null, wasEndedByMe: false, isRecoverable: false });
  }, []);

  const closeChat = useCallback(() => {
    setChatState(INITIAL_STATE);
  }, []);

  const endChat = useCallback(async (reason: ConversationEndReason = 'manual') => {
    if (!chatState.conversation || !user) return { error: new Error('No active chat') };

    const conversationId = chatState.conversation.id;
    try {
      const { error } = await supabase.rpc('end_conversation', {
        p_conversation_id: conversationId,
        p_motivo: reason,
      });

      if (error && !error.message.includes('END_CONV_ALREADY_ENDED')) throw error;

      logger.debug('[useChat] Chat ended via RPC:', reason);
      setChatState({ isActive: false, conversation: null, endedReason: reason, wasEndedByMe: true, isRecoverable: false });
      refetchConversations();
      return { error: null };
    } catch (error) {
      console.error('[useChat] Error ending chat:', error);
      return { error: error as Error };
    }
  }, [chatState.conversation, user, refetchConversations]);

  const endAllChatsForPresence = useCallback(async () => {
    if (!user) return;
    logger.debug('[useChat] Presence ended - cleaning up local chat state');
    setChatState({ isActive: false, conversation: null, endedReason: 'presence_end', wasEndedByMe: true, isRecoverable: false });
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
