import { useConversationsContext, ConversationWithDetails } from '@/contexts/ConversationsContext';

export type { ConversationWithDetails };

/**
 * Conversas são criadas EXCLUSIVAMENTE pelo RPC accept_wave.
 * A antiga addConversation (INSERT direto na tabela) foi removida:
 * não tinha nenhum chamador e permitia criar conversa sem aceite.
 */
export function useConversations() {
  const context = useConversationsContext();
  return context;
}
