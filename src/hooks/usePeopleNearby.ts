import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeContext } from '@/contexts/RealtimeContext';
import { Profile } from './useProfile';
import { getSignedSelfieUrls } from '@/lib/storage';

export interface PersonNearby {
  id: string;
  profile: Profile;
  interestNames: string[];
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
  const { addListener: addRealtimeListener } = useRealtimeContext();
  const [people, setPeople] = useState<PersonNearby[]>([]);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

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
          gender: row.gender || null,
          gender_custom: row.gender_custom || null,
          criado_em: '',
          atualizado_em: '',
        } as Profile,
        interestNames: row.interests || [],
        commonInterests: row.mutual_interests || [],
        assuntoAtual: row.assunto_atual || null,
        checkinSelfieUrl: row.checkin_selfie_url || null,
      }));

      // Resolve signed URLs for selfie file paths (bucket is private)
      const selfiePaths = mapped
        .map(p => p.checkinSelfieUrl)
        .filter((p): p is string => !!p && !p.startsWith('http'));
      if (selfiePaths.length > 0) {
        const signedUrls = await getSignedSelfieUrls(selfiePaths);
        mapped.forEach(p => {
          if (p.checkinSelfieUrl && signedUrls.has(p.checkinSelfieUrl)) {
            p.checkinSelfieUrl = signedUrls.get(p.checkinSelfieUrl)!;
          }
        });
      }

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
      // Filtros server-side NÃO se aplicam a DELETE (payload só tem PK):
      // sem este listener extra, quem sai do local vira fantasma no feed
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'presence',
      }, scheduleFetch)
      // SAÍDAS: o UPDATE ativo=false em presence é SUPRIMIDO pela RLS
      // (policy exige ativo=true) — o cascade então "toca" o local
      // (places.last_activity_at), que é visível a todos, e o feed
      // escuta o local para saber que alguém saiu
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'places',
        filter: `id=eq.${placeId}`,
      }, scheduleFetch)
      .subscribe();

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [placeId, scheduleFetch]);

  // Reage a blocks/mutes via RealtimeContext centralizado (sem canal próprio)
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = addRealtimeListener((table) => {
      if (table === 'user_blocks' || table === 'user_mutes') scheduleFetch();
    });
    return () => unsubscribe();
  }, [user?.id, addRealtimeListener, scheduleFetch]);

  // Global cleanup
  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    people,
    loading,
    refetch: fetchPeopleNearby,
  };
}
