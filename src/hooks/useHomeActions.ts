import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { NormalizedMute, NormalizedBlock } from '@/hooks/useInteractionData';

interface UseHomeActionsParams {
  placeId: string | null;
  activeMutes: NormalizedMute[];
  blocks: NormalizedBlock[];
  sendWave: (toUserId: string, placeId: string) => Promise<{ error: Error | null }>;
  refetchInteractionData: () => Promise<void>;
}

export function useHomeActions({
  placeId,
  activeMutes,
  blocks,
  sendWave,
  refetchInteractionData,
}: UseHomeActionsParams) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleWave = useCallback(async (toUserId: string) => {
    if (!placeId) return;
    const { error } = await sendWave(toUserId, placeId);
    if (error) {
      toast({ variant: 'destructive', title: error.message });
    } else {
      toast({ title: 'Aceno enviado! 👋' });
      refetchInteractionData();
    }
  }, [placeId, sendWave, refetchInteractionData, toast]);

  const handleMute = useCallback(async (targetUserId: string) => {
    if (!user || !placeId) return;

    const existingMute = activeMutes.find(
      m => m.user_id === user.id && m.muted_user_id === targetUserId
    );

    if (existingMute) {
      const { error } = await supabase.rpc('unmute_user', {
        p_user_id: user.id,
        p_muted_user_id: targetUserId,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao remover silenciamento' });
      } else {
        toast({ title: 'Silenciamento removido' });
        await refetchInteractionData();
      }
    } else {
      const { error } = await supabase.rpc('mute_user', {
        p_user_id: user.id,
        p_muted_user_id: targetUserId,
        p_place_id: placeId,
      });
      if (error) {
        if (error.message.includes('MUTE_ALREADY_EXISTS')) {
          toast({ title: 'Usuário já está silenciado' });
        } else {
          toast({ variant: 'destructive', title: 'Erro ao silenciar' });
        }
      } else {
        toast({ title: 'Usuário silenciado por 24h' });
        await refetchInteractionData();
      }
    }
  }, [user, placeId, activeMutes, refetchInteractionData, toast]);

  const handleBlock = useCallback(async (targetUserId: string) => {
    if (!user) return;

    const existingBlock = blocks.find(
      b => b.user_id === user.id && b.blocked_user_id === targetUserId
    );

    if (existingBlock) {
      const { error } = await supabase.rpc('unblock_user', {
        p_user_id: user.id,
        p_blocked_user_id: targetUserId,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao remover bloqueio' });
      } else {
        toast({ title: 'Bloqueio removido' });
        await refetchInteractionData();
      }
    } else {
      const { error } = await supabase.rpc('block_user', {
        p_user_id: user.id,
        p_blocked_user_id: targetUserId,
      });
      if (error) {
        if (error.message.includes('BLOCK_ALREADY_EXISTS')) {
          toast({ title: 'Usuário já está bloqueado' });
        } else {
          toast({ variant: 'destructive', title: 'Erro ao bloquear' });
        }
      } else {
        toast({ title: 'Usuário bloqueado' });
        await refetchInteractionData();
      }
    }
  }, [user, blocks, refetchInteractionData, toast]);

  return { handleWave, handleMute, handleBlock };
}
