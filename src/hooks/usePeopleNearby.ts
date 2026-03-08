import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, UserInterest } from './useProfile';

export interface PersonNearby {
  id: string;
  profile: Profile;
  interests: UserInterest[];
  commonInterests: string[];
  assuntoAtual: string | null;
  checkinSelfieUrl: string | null;
}

/**
 * Fetch people with active presence at the same place.
 * Uses a single RPC call instead of N+1 queries.
 * Realtime subscriptions with 300ms debounce to prevent event storms.
 * Hardened against unmount races, duplicate channels, and state leaks.
 */
export function usePeopleNearby(placeId: string | null) {
  const { user } = useAuth();
  const [people, setPeople] = useState<PersonNearby[]>([]);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const blocksChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mutesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Mark unmounted
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPeopleNearby = useCallback(async () => {
    if (!user || !placeId) {
      if (mountedRef.current) {
        setPeople([]);
        setLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_users_at_place_feed', {
        p_user_id: user.id,
        p_place_id: placeId,
      });

      if (!mountedRef.current) return;

      if (error) {
        console.error('[usePeopleNearby] RPC error:', error);
        setPeople([]);
        return;
      }

      const mapped: PersonNearby[] = (data || []).map((row: any) => ({
        id: row.user_id,
        profile: {
          id: row.user_id,
          nome: row.nome,
          foto_url: row.foto_url,
          bio: row.bio,
          data_nascimento: row.data_nascimento,
          criado_em: '',
          atualizado_em: '',
        } as Profile,
        interests: (row.interests || []).map((tag: string) => ({
          id: '',
          user_id: row.user_id,
          tag,
        })) as UserInterest[],
        commonInterests: row.mutual_interests || [],
        assuntoAtual: row.assunto_atual || null,
        checkinSelfieUrl: row.checkin_selfie_url || null,
      }));

      setPeople(mapped);
    } catch (error) {
      console.error('[usePeopleNearby] Error:', error);
      if (mountedRef.current) setPeople([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user, placeId]);

  // Debounced fetch
  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPeopleNearby();
    }, 300);
  }, [fetchPeopleNearby]);

  // Initial fetch
  useEffect(() => {
    fetchPeopleNearby();
  }, [fetchPeopleNearby]);

  // Realtime: presence
  useEffect(() => {
    if (!placeId) return;

    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    presenceChannelRef.current = supabase
      .channel(`presence-feed-${placeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'presence',
        filter: `place_id=eq.${placeId}`,
      }, scheduleFetch)
      .subscribe();

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [placeId, scheduleFetch]);

  // Realtime: blocks
  useEffect(() => {
    if (!user?.id) return;

    if (blocksChannelRef.current) {
      supabase.removeChannel(blocksChannelRef.current);
    }

    blocksChannelRef.current = supabase
      .channel(`people-blocks-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_blocks',
      }, scheduleFetch)
      .subscribe();

    return () => {
      if (blocksChannelRef.current) {
        supabase.removeChannel(blocksChannelRef.current);
        blocksChannelRef.current = null;
      }
    };
  }, [user?.id, scheduleFetch]);

  // Realtime: mutes
  useEffect(() => {
    if (!user?.id) return;

    if (mutesChannelRef.current) {
      supabase.removeChannel(mutesChannelRef.current);
    }

    mutesChannelRef.current = supabase
      .channel(`people-mutes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_mutes',
      }, scheduleFetch)
      .subscribe();

    return () => {
      if (mutesChannelRef.current) {
        supabase.removeChannel(mutesChannelRef.current);
        mutesChannelRef.current = null;
      }
    };
  }, [user?.id, scheduleFetch]);

  // Global cleanup
  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
      if (blocksChannelRef.current) supabase.removeChannel(blocksChannelRef.current);
      if (mutesChannelRef.current) supabase.removeChannel(mutesChannelRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    people,
    loading,
    refetch: fetchPeopleNearby,
  };
}
