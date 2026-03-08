import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * IMPORTANTE: Este hook mantém estado local de waves para a UI da página Waves.
 * 
 * Para validação de ações (sendWave, acceptWave), usamos a função canônica
 * de interactionRules.ts após buscar dados frescos do banco.
 * 
 * O useInteractionData é a fonte de verdade para o estado do botão no PersonCard.
 * Este hook NÃO deve ser usado para determinar se uma ação é permitida - 
 * a validação deve sempre ir ao banco via função canônica.
 */

export interface Wave {
  id: string;
  de_user_id: string;
  para_user_id: string;
  location_id: string;
  place_id: string | null;
  criado_em: string;
  visualizado: boolean;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string | null;
  accepted_by: string | null;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  place_id: string;
  origem_wave_id: string | null;
  criado_em: string;
  ativo: boolean;
  encerrado_por: string | null;
  encerrado_em: string | null;
  encerrado_motivo: string | null;
  reinteracao_permitida_em: string | null;
}

export function useWaves() {
  const { user } = useAuth();
  const [sentWaves, setSentWaves] = useState<Wave[]>([]);
  const [receivedWaves, setReceivedWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filter valid waves (pending and not expired by time or status)
  const filterValidWaves = useCallback((waves: Wave[]) => {
    const now = new Date();
    return waves.filter(wave => {
      // Exclude waves with expired status (set when user changes location)
      if (wave.status === 'expired') return false;
      // Only include pending waves
      if (wave.status !== 'pending') return false;
      // Check time-based expiration
      if (wave.expires_at && new Date(wave.expires_at) <= now) return false;
      return true;
    });
  }, []);

  const fetchWaves = useCallback(async () => {
    if (!user) {
      setSentWaves([]);
      setReceivedWaves([]);
      setLoading(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      
      const [sentResult, receivedResult] = await Promise.all([
        supabase
          .from('waves')
          .select('*')
          .eq('de_user_id', user.id)
          .eq('status', 'pending')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('criado_em', { ascending: false }),
        supabase
          .from('waves')
          .select('*')
          .eq('para_user_id', user.id)
          .eq('status', 'pending')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('criado_em', { ascending: false })
      ]);

      if (!sentResult.error) {
        setSentWaves(filterValidWaves(sentResult.data as Wave[] || []));
      }
      if (!receivedResult.error) {
        const validReceived = filterValidWaves(receivedResult.data as Wave[] || []);
        setReceivedWaves(validReceived);
        setUnreadCount(validReceived.filter(w => !w.visualizado).length);
      }
    } catch (error) {
      console.error('Error fetching waves:', error);
    } finally {
      setLoading(false);
    }
  }, [user, filterValidWaves]);

  useEffect(() => {
    fetchWaves();
  }, [fetchWaves]);

  /**
   * Send a wave to another user at a specific place.
   * USA A FUNÇÃO CANÔNICA de interactionRules.ts para validação.
   */
  const sendWave = async (toUserId: string, placeId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    if (!placeId) {
      return { error: new Error('place_id é obrigatório para enviar aceno') };
    }

    if (toUserId === user.id) {
      return { error: new Error('Você não pode acenar para si mesmo') };
    }

    // =========================================================================
    // RPC ATÔMICA: Toda validação acontece no backend
    // =========================================================================
    try {
      const { data: waveId, error: rpcError } = await supabase.rpc('send_wave', {
        p_from_user_id: user.id,
        p_to_user_id: toUserId,
        p_place_id: placeId,
      });

      if (rpcError) {
        // Map backend error codes to user-friendly messages
        const errorMessage = mapSendWaveError(rpcError.message);
        return { error: new Error(errorMessage) };
      }

      // Fetch the created wave to update local state
      if (waveId) {
        const { data: newWave } = await supabase
          .from('waves')
          .select('*')
          .eq('id', waveId)
          .single();

        if (newWave) {
          setSentWaves(prev => [newWave as Wave, ...prev]);
        }
      }

      return { error: null, data: { id: waveId } as Wave | null };
    } catch (error) {
      console.error('[useWaves] Error sending wave:', error);
      return { error: new Error('Erro ao enviar aceno') };
    }
  };

  /**
   * Maps backend RPC error codes to user-friendly messages.
   */
  const mapSendWaveError = (errorMessage: string): string => {
    if (errorMessage.includes('WAVE_SELF')) return 'Você não pode acenar para si mesmo';
    if (errorMessage.includes('WAVE_BLOCKED')) return 'Usuário bloqueado';
    if (errorMessage.includes('WAVE_MUTED')) return 'Usuário silenciado';
    if (errorMessage.includes('WAVE_ACTIVE_CHAT')) return 'Você já tem uma conversa ativa com esta pessoa';
    if (errorMessage.includes('WAVE_COOLDOWN')) return 'Não é possível acenar - interação recente neste local';
    if (errorMessage.includes('WAVE_DUPLICATE')) return 'Você já acenou para esta pessoa neste local';
    if (errorMessage.includes('WAVE_IGNORE_COOLDOWN')) return 'Aguarde para enviar novo aceno';
    if (errorMessage.includes('WAVE_NO_PRESENCE_SENDER')) return 'Você precisa estar presente neste local';
    if (errorMessage.includes('WAVE_NO_PRESENCE_RECIPIENT')) return 'Esta pessoa não está mais neste local';
    return 'Erro ao enviar aceno';
  };

  /**
   * Accept a wave and create a conversation.
   * USA A FUNÇÃO CANÔNICA de interactionRules.ts para validação.
   */
  const acceptWave = async (waveId: string): Promise<{ error: Error | null; conversation: Conversation | null }> => {
    if (!user) return { error: new Error('Not authenticated'), conversation: null };

    // =========================================================================
    // RPC ATÔMICA: Toda validação e execução acontece no backend
    // =========================================================================
    try {
      const { data: conversationId, error: rpcError } = await supabase.rpc('accept_wave', {
        p_wave_id: waveId,
        p_user_id: user.id,
      });

      if (rpcError) {
        const errorMessage = mapAcceptWaveError(rpcError.message);
        // Remove wave from local state if it's no longer valid
        if (rpcError.message.includes('EXPIRED') || 
            rpcError.message.includes('NOT_PENDING') || 
            rpcError.message.includes('ALREADY_ACCEPTED') ||
            rpcError.message.includes('NOT_FOUND')) {
          setReceivedWaves(prev => prev.filter(w => w.id !== waveId));
        }
        return { error: new Error(errorMessage), conversation: null };
      }

      // Fetch the created conversation
      if (conversationId) {
        const { data: conversationData } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        // Update local state
        setReceivedWaves(prev => prev.filter(w => w.id !== waveId));
        setUnreadCount(prev => Math.max(0, prev - 1));

        return { error: null, conversation: conversationData as Conversation };
      }

      return { error: new Error('Erro inesperado ao aceitar aceno'), conversation: null };
    } catch (error) {
      console.error('[useWaves] Error accepting wave:', error);
      return { error: error as Error, conversation: null };
    }
  };

  /**
   * Maps backend accept_wave error codes to user-friendly messages.
   */
  const mapAcceptWaveError = (errorMessage: string): string => {
    if (errorMessage.includes('ACCEPT_WAVE_NOT_FOUND')) return 'Aceno não encontrado';
    if (errorMessage.includes('ACCEPT_WAVE_NOT_RECIPIENT')) return 'Este aceno não é para você';
    if (errorMessage.includes('ACCEPT_WAVE_SELF')) return 'Você não pode aceitar seu próprio aceno';
    if (errorMessage.includes('ACCEPT_WAVE_NO_PLACE')) return 'Aceno sem local válido';
    if (errorMessage.includes('ACCEPT_WAVE_NOT_PENDING')) return 'Este aceno não está mais disponível';
    if (errorMessage.includes('ACCEPT_WAVE_EXPIRED')) return 'Este aceno expirou';
    if (errorMessage.includes('ACCEPT_WAVE_BLOCKED')) return 'Usuário bloqueado';
    if (errorMessage.includes('ACCEPT_WAVE_MUTED')) return 'Usuário silenciado';
    if (errorMessage.includes('ACCEPT_WAVE_ACTIVE_CHAT')) return 'Já existe uma conversa ativa';
    if (errorMessage.includes('ACCEPT_WAVE_COOLDOWN')) return 'Período de espera ativo';
    if (errorMessage.includes('ACCEPT_WAVE_NO_PRESENCE_SENDER')) return 'A outra pessoa não está mais neste local';
    if (errorMessage.includes('ACCEPT_WAVE_NO_PRESENCE_RECIPIENT')) return 'Você precisa estar presente neste local';
    if (errorMessage.includes('ACCEPT_WAVE_ALREADY_ACCEPTED')) return 'Este aceno já foi aceito';
    return 'Erro ao aceitar aceno';
  };

  const ignoreWave = async (waveId: string) => {
    // Optimistically remove from local state
    setReceivedWaves(prev => prev.filter(w => w.id !== waveId));
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Persist: set status to 'expired' with 2h cooldown
    const { error } = await supabase
      .from('waves')
      .update({
        status: 'expired',
        visualizado: true,
        ignored_at: new Date().toISOString(),
        ignore_cooldown_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      } as any)
      .eq('id', waveId);

    if (error) {
      console.error('[useWaves] Error ignoring wave:', error);
    }
  };

  const markAsRead = async (waveId: string) => {
    const { error } = await supabase
      .from('waves')
      .update({ visualizado: true })
      .eq('id', waveId);

    if (!error) {
      setReceivedWaves(prev => 
        prev.map(w => w.id === waveId ? { ...w, visualizado: true } : w)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    return { error };
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('waves')
      .update({ visualizado: true })
      .eq('para_user_id', user.id)
      .eq('visualizado', false);

    setReceivedWaves(prev => prev.map(w => ({ ...w, visualizado: true })));
    setUnreadCount(0);
  };

  /**
   * Check if user has already waved to another user at a specific place.
   */
  const hasWavedTo = (userId: string, placeId: string) => {
    return sentWaves.some(w => 
      w.para_user_id === userId && 
      (w.place_id === placeId || w.location_id === placeId)
    );
  };

  // Delete all waves for current user (called when presence ends)
  const deleteUserWaves = async () => {
    if (!user) return;

    await supabase
      .from('waves')
      .delete()
      .or(`de_user_id.eq.${user.id},para_user_id.eq.${user.id}`)
      .eq('status', 'pending');

    setSentWaves([]);
    setReceivedWaves([]);
    setUnreadCount(0);
  };

  return {
    sentWaves,
    receivedWaves,
    unreadCount,
    loading,
    sendWave,
    acceptWave,
    ignoreWave,
    markAsRead,
    markAllAsRead,
    hasWavedTo,
    deleteUserWaves,
    refetch: fetchWaves,
  };
}
