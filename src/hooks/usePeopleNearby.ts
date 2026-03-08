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
 * 
 * IMPORTANT: This hook returns ALL users present at the location
 * (excluding blocked/muted). Visibility filtering for interactions
 * is handled EXCLUSIVELY by PersonCard via useInteractionState.
 */
export function usePeopleNearby(placeId: string | null) {
  const { user } = useAuth();
  const [people, setPeople] = useState<PersonNearby[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPeopleNearby = useCallback(async () => {
    if (!user || !placeId) {
      setPeople([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_users_at_place_feed', {
        p_user_id: user.id,
        p_place_id: placeId,
      });

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
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [user, placeId]);

  // Debounced fetch — coalesces multiple Realtime events into one RPC call
  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPeopleNearby();
    }, 300);
  }, [fetchPeopleNearby]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Initial fetch (no debounce)
  useEffect(() => {
    fetchPeopleNearby();
  }, [fetchPeopleNearby]);

  // Realtime: presence changes at this place
  useEffect(() => {
    if (!placeId) return;

    const channel = supabase
      .channel(`presence-feed-${placeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'presence',
        filter: `place_id=eq.${placeId}`,
      }, () => {
        scheduleFetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [placeId, scheduleFetch]);

  // Realtime: block changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`people-blocks-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_blocks',
      }, () => {
        scheduleFetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, scheduleFetch]);

  // Realtime: mute changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`people-mutes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_mutes',
      }, () => {
        scheduleFetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, scheduleFetch]);

  return {
    people,
    loading,
    refetch: fetchPeopleNearby,
  };
}
