import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { toast } from '@/components/ui/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export type NormalizedWave = Pick<Tables<'waves'>,
  'id' | 'de_user_id' | 'para_user_id' | 'place_id' | 'status' | 'expires_at' | 'ignore_cooldown_until'
> & { place_id: string };

export type NormalizedConversation = Pick<Tables<'conversations'>,
  'id' | 'user1_id' | 'user2_id' | 'place_id' | 'ativo' | 'encerrado_por' | 'reinteracao_permitida_em'
>;

export type NormalizedMute = Pick<Tables<'user_mutes'>,
  'id' | 'user_id' | 'muted_user_id' | 'expira_em'
>;

export type NormalizedBlock = Pick<Tables<'user_blocks'>,
  'id' | 'user_id' | 'blocked_user_id'
>;

interface UseInteractionDataResult {
  sentWaves: NormalizedWave[];
  receivedWaves: NormalizedWave[];
  conversations: NormalizedConversation[];
  activeMutes: NormalizedMute[];
  blocks: NormalizedBlock[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Busca todos os dados de interação via RPC consolidada (get_interaction_context).
 * Uma única query substitui as 5 queries paralelas anteriores.
 * Canais Realtime para mutes e blocks removidos — gerenciados pelo RealtimeContext.
 */
export function useInteractionData(placeId: string | null): UseInteractionDataResult {
  const { user } = useAuth();
  const { addConversationUpdateListener } = useConversations();
  const [sentWaves, setSentWaves] = useState<NormalizedWave[]>([]);
  const [receivedWaves, setReceivedWaves] = useState<NormalizedWave[]>([]);
  const [conversations, setConversations] = useState<NormalizedConversation[]>([]);
  const [activeMutes, setActiveMutes] = useState<NormalizedMute[]>([]);
  const [blocks, setBlocks] = useState<NormalizedBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIdRef = useRef(0);
  const userIdRef = useRef<string | undefined>(undefined);
  const placeIdRef = useRef<string | null>(null);
  const toastedIgnoreCooldownWaveIds = useRef<Set<string>>(new Set());

  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  useEffect(() => { placeIdRef.current = placeId; }, [placeId]);

  const fetchData = useCallback(async () => {
    const currentUserId = userIdRef.current;
    const currentPlaceId = placeIdRef.current;

    if (!currentUserId || !currentPlaceId) {
      setSentWaves([]);
      setReceivedWaves([]);
      setConversations([]);
      setActiveMutes([]);
      setBlocks([]);
      setLoading(false);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;

    try {
      // Uma única RPC substitui as 5 queries paralelas
      const { data, error } = await supabase.rpc('get_interaction_context', {
        p_place_id: currentPlaceId,
      });

      if (currentFetchId !== fetchIdRef.current) return;
      if (error) throw error;

      const ctx = data as any;

      const normalizeWave = (w: any): NormalizedWave => ({
        id: w.id,
        de_user_id: w.de_user_id,
        para_user_id: w.para_user_id,
        place_id: w.place_id || '',
        status: w.status,
        expires_at: w.expires_at,
        ignore_cooldown_until: w.ignore_cooldown_until ?? null,
      });

      setSentWaves((ctx.sent_waves || []).map(normalizeWave).filter((w: NormalizedWave) => w.place_id));
      setReceivedWaves((ctx.received_waves || []).map(normalizeWave).filter((w: NormalizedWave) => w.place_id));
      setConversations(ctx.conversations || []);
      setActiveMutes(ctx.mutes || []);
      setBlocks(ctx.blocks || []);

    } catch (error) {
      console.error('[useInteractionData] Error fetching data:', error);
    } finally {
      if (currentFetchId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id && placeId) {
      fetchData();
    } else if (!user?.id || !placeId) {
      setSentWaves([]);
      setReceivedWaves([]);
      setConversations([]);
      setActiveMutes([]);
      setBlocks([]);
      setLoading(false);
    }
  }, [user?.id, placeId, fetchData]);

  // Escuta atualizações de conversas via listener centralizado
  useEffect(() => {
    if (!user?.id || !placeId) return;
    const unsubscribe = addConversationUpdateListener((payload) => {
      const record = payload.new as any;
      const oldRecord = payload.old as any;
      const involvesUser =
        record?.user1_id === user.id || record?.user2_id === user.id ||
        oldRecord?.user1_id === user.id || oldRecord?.user2_id === user.id;
      const isCurrentPlace =
        record?.place_id === placeId || oldRecord?.place_id === placeId;
      if (involvesUser && isCurrentPlace) fetchData();
    });
    return () => unsubscribe();
  }, [user?.id, placeId, fetchData, addConversationUpdateListener]);

  // Canal Realtime apenas para waves — mutes e blocks são gerenciados globalmente
  useEffect(() => {
    if (!user?.id || !placeId) return;

    const channel = supabase
      .channel(`interaction-waves-${placeId}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waves' }, (payload) => {
        const record = payload.new as any;
        const oldRecord = payload.old as any;
        const involvesUser =
          record?.de_user_id === user.id || record?.para_user_id === user.id ||
          oldRecord?.de_user_id === user.id || oldRecord?.para_user_id === user.id;
        const isCurrentPlace =
          record?.place_id === placeId || oldRecord?.place_id === placeId;

        if (involvesUser && isCurrentPlace) {
          if (payload.eventType === 'INSERT' && record?.para_user_id === user.id && record?.status === 'pending') {
            toast({ title: 'Você recebeu um aceno! 👋' });
          }
          if (
            payload.eventType === 'UPDATE' &&
            record?.status === 'expired' &&
            record?.de_user_id === user.id &&
            record?.ignore_cooldown_until &&
            new Date(record.ignore_cooldown_until) > new Date() &&
            !toastedIgnoreCooldownWaveIds.current.has(record.id)
          ) {
            toastedIgnoreCooldownWaveIds.current.add(record.id);
            toast({ title: 'A pessoa está indisponível no momento', description: 'Tente novamente mais tarde.' });
          }
          fetchData();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, placeId, fetchData]);

  // Listener global para mutes e blocks — dispara refetch quando mudam
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global-mutes-blocks-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_mutes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchData]);

  return { sentWaves, receivedWaves, conversations, activeMutes, blocks, loading, refetch: fetchData };
}
