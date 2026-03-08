import { useState, useEffect, useCallback } from 'react';
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
 * 
 * IMPORTANT: This hook returns ALL users present at the location
 * (excluding blocked/muted). Visibility filtering for interactions
 * is handled EXCLUSIVELY by PersonCard via useInteractionState.
 */
export function usePeopleNearby(placeId: string | null) {
  const { user } = useAuth();
  const [people, setPeople] = useState<PersonNearby[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchPeopleNearby();
    const interval = setInterval(fetchPeopleNearby, 30000);
    return () => clearInterval(interval);
  }, [fetchPeopleNearby]);

  // Realtime subscription for user_mutes — refetch when mute state changes
  useEffect(() => {
    if (!user?.id || !placeId) return;

    const channel = supabase
      .channel(`people-mutes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_mutes',
      }, () => {
        fetchPeopleNearby();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, placeId, fetchPeopleNearby]);

  return {
    people,
    loading,
    refetch: fetchPeopleNearby,
  };
}
