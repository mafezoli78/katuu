import { useConversationsContext, ConversationWithDetails } from '@/contexts/ConversationsContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type { ConversationWithDetails };

export function useConversations() {
  const context = useConversationsContext();
  const { user } = useAuth();

  const addConversation = async (otherUserId: string, placeId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user1_id: user?.id,
        user2_id: otherUserId,
        place_id: placeId,
        ativo: true
      })
      .select()
      .single();

    if (!error) {
      context.refetch();
    }
    return { data, error };
  };

  return {
    ...context,
    addConversation,
  };
}
