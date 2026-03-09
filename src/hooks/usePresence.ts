import { useProfile } from '@/hooks/useProfile';
import { useState, useEffect, useCallback, useRef } from 'react';
import { isProfileComplete as checkProfileComplete } from '@/utils/profileCompletion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { placesService, Place } from '@/services/placesService';
import {
  PRESENCE_RADIUS_METERS,
  SEARCH_RADIUS_METERS,
  PRESENCE_DURATION_MS,
} from '@/config/presence';
import {
  PresenceLogicalState,
  PresenceEndReason,
  PresenceState,
  mapToSemanticReason,
  END_REASON_MESSAGES,
} from '@/types/presence';

// Sub-hooks
import { usePresenceTimer } from './presence/usePresenceTimer';
import { usePresenceGPS } from './presence/usePresenceGPS';
import { usePresenceState } from './presence/usePresenceState';
import { usePresenceLifecycle } from './presence/usePresenceLifecycle';

// Re-export types for consumers
export type { PresenceLogicalState, PresenceEndReason, PresenceState };
export type { Intention, Presence, NearbyTemporaryPlace } from './presence/types';

// Temporary place default expiration (6 hours)
const TEMPORARY_PLACE_DURATION_MS = 6 * 60 * 60 * 1000;

export function usePresence() {
  const { user } = useAuth();
  const { profile, interests, loading: profileLoading } = useProfile();
  const activationPromiseRef = useRef<Promise<any> | null>(null);

  const [intentions, setIntentions] = useState<import('./presence/types').Intention[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [nearbyTemporaryPlaces, setNearbyTemporaryPlaces] = useState<import('./presence/types').NearbyTemporaryPlace[]>([]);
  const [currentPresence, setCurrentPresence] = useState<import('./presence/types').Presence | null>(null);
  const [currentPlace, setCurrentPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);

  // === Sub-hooks ===

  const stateHook = usePresenceState(currentPresence);
  const {
    presenceState,
    lastEndReason,
    setLastEndReason,
    setIsRevalidating,
    setLastValidatedAt,
    isSuspended,
    setIsSuspended,
    isEnteringPlace,
    setIsEnteringPlace,
  } = stateHook;

  // Ref for endPresence (used in callbacks before it's defined)
  const endPresenceRef = useRef<((reason: 'manual' | 'expired') => Promise<void>) | null>(null);

  // GPS exit handler
  const handleGPSPresenceEnded = useCallback((reason: PresenceEndReason) => {
    setCurrentPresence(null);
    setCurrentPlace(null);
    setIsSuspended(false);
    setLastEndReason(reason);
  }, [setIsSuspended, setLastEndReason]);

  const gpsHook = usePresenceGPS({
    userId: user?.id,
    currentPresence,
    currentPlace,
    onPresenceEnded: handleGPSPresenceEnded,
  });

  const { startGPSMonitoring, stopGPSMonitoring, setPresenceLocation } = gpsHook;

  // Refs for functions used inside fetchCurrentPresence
  const startGPSMonitoringRef = useRef<(() => void) | null>(null);
  useEffect(() => { startGPSMonitoringRef.current = startGPSMonitoring; }, [startGPSMonitoring]);

  // === Data fetching ===

  const fetchIntentions = async () => {
    const { data, error } = await supabase.from('intentions').select('*');
    if (!error && data) setIntentions(data);
  };

  const fetchNearbyTemporaryPlaces = async (lat: number, lng: number) => {
    try {
      const { data, error } = await supabase.rpc('find_nearby_temporary_places', {
        user_lat: lat,
        user_lng: lng,
        radius_meters: PRESENCE_RADIUS_METERS,
      });
      if (error) {
        console.error('[usePresence] Error fetching nearby temporary places:', error);
        return [];
      }
      const places = (data || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        distance_meters: p.distance_meters,
        active_users: p.active_users,
      }));
      setNearbyTemporaryPlaces(places);
      return places;
    } catch (error) {
      console.error('[usePresence] Error in fetchNearbyTemporaryPlaces:', error);
      return [];
    }
  };

  const fetchNearbyPlaces = async (lat: number, lng: number) => {
    setPlacesLoading(true);
    try {
      console.log(`[usePresence] 🔍 Searching places: lat=${lat}, lng=${lng}, radius=${SEARCH_RADIUS_METERS}m`);
      const [places, temporaryPlaces] = await Promise.all([
        placesService.searchNearby({ latitude: lat, longitude: lng, radius: SEARCH_RADIUS_METERS }),
        fetchNearbyTemporaryPlaces(lat, lng),
      ]);
      console.log(`[usePresence] ✅ ${places.length} places found, ${temporaryPlaces.length} temporary places nearby`);
      setNearbyPlaces(places);
    } catch (error) {
      console.error('[usePresence] ❌ Error fetching places:', error);
      setNearbyPlaces([]);
    } finally {
      setPlacesLoading(false);
    }
  };

  // === Core fetch ===

  const fetchCurrentPresence = useCallback(async (isRevalidation = false) => {
    if (!user) {
      setCurrentPresence(null);
      setCurrentPlace(null);
      setIsSuspended(false);
      return { valid: false };
    }

    if (isRevalidation) {
      setIsRevalidating(true);
      setIsSuspended(true);
      console.log('[usePresence] 🔄 Revalidation started - marked as suspended');
    }

    try {
      const { data, error } = await supabase
        .from('presence')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        console.error('[usePresence] ❌ Error fetching presence:', error);
        if (!isRevalidation) {
          setCurrentPresence(null);
          setCurrentPlace(null);
        }
        setIsSuspended(false);
        return { valid: false };
      }

      if (data) {
        const lastActivity = new Date(data.ultima_atividade).getTime();
        const now = Date.now();

        if (now - lastActivity > PRESENCE_DURATION_MS) {
          endPresenceRef.current?.('expired').catch(err =>
            console.error('[usePresence] Error ending expired presence:', err)
          );
          setCurrentPresence(null);
          setCurrentPlace(null);
          setIsSuspended(false);
          return { valid: false };
        }

        setCurrentPresence(data);
        setLastValidatedAt(new Date().toISOString());
        setIsSuspended(false);

        const placeId = data.place_id;
        if (placeId) {
          try {
            const { data: placeData } = await supabase
              .from('places')
              .select('*')
              .eq('id', placeId)
              .maybeSingle();

            if (placeData) {
              setCurrentPlace(placeData as Place);
              setPresenceLocation(placeData.latitude, placeData.longitude);
              startGPSMonitoringRef.current?.();
            }
          } catch (placeError) {
            console.error('[usePresence] Error fetching place details:', placeError);
          }
        }
        console.log('[usePresence] ✅ Presence validated successfully');
        return { valid: true };
      } else {
        if (isRevalidation) {
          console.log('[usePresence] ⚠️ Revalidation found no presence - keeping stale state as suspended');
          setLastEndReason({
            type: 'presence_lost_background',
            message: END_REASON_MESSAGES.presence_lost_background,
            timestamp: new Date().toISOString(),
            isHumanInitiated: false,
          });
          return { valid: false };
        } else {
          console.log('[usePresence] ℹ️ Initial fetch found no presence');
          setCurrentPresence(null);
          setCurrentPlace(null);
          setIsSuspended(false);
          return { valid: false };
        }
      }
    } catch (unexpectedError) {
      console.error('[usePresence] 🚨 Unexpected error in fetchCurrentPresence:', unexpectedError);
      if (!isRevalidation) {
        setCurrentPresence(null);
        setCurrentPlace(null);
      }
      setIsSuspended(false);
      return { valid: false };
    } finally {
      if (isRevalidation) {
        setIsRevalidating(false);
      }
    }
  }, [user, setIsSuspended, setIsRevalidating, setLastValidatedAt, setLastEndReason, setPresenceLocation]);

  // === Presence actions ===

  const endPresence = useCallback(async (reason: 'manual' | 'expired') => {
    if (!user) return;

    const semanticReason = mapToSemanticReason(reason);
    const message = END_REASON_MESSAGES[semanticReason];

    console.log(`[Presence] 🔚 Ending presence: ${reason} → ${semanticReason} (human-initiated)`);
    stopGPSMonitoring();

    const placeId = currentPresence?.place_id || currentPlace?.id;

    if (placeId) {
      try {
        const { error } = await supabase.rpc('end_presence_cascade', {
          p_user_id: user.id,
          p_place_id: placeId,
          p_motivo: reason,
          p_force: true,
        });
        if (error) {
          console.error('[Presence] Error in cascade cleanup:', error);
        } else {
          console.log('[Presence] ✅ Cascade cleanup completed with reason:', reason);
        }
      } catch (err) {
        console.error('[Presence] Error calling end_presence_cascade:', err);
      }
    }

    await supabase.from('presence').delete().eq('user_id', user.id);

    setCurrentPresence(null);
    setCurrentPlace(null);
    setIsSuspended(false);
    setLastEndReason({
      type: semanticReason,
      message,
      timestamp: new Date().toISOString(),
      isHumanInitiated: true,
    });
  }, [user, currentPresence, currentPlace, stopGPSMonitoring, setIsSuspended, setLastEndReason]);

  // Keep endPresence ref updated
  useEffect(() => { endPresenceRef.current = endPresence; }, [endPresence]);

  // Timer sub-hook (uses endPresence callback)
  const onTimerExpired = useCallback(() => {
    endPresence('expired');
  }, [endPresence]);

  const timerHook = usePresenceTimer({
    currentPresence,
    onExpired: onTimerExpired,
  });

  // Lifecycle sub-hook
  const onBackground = useCallback(() => {
    if (currentPresence) setIsSuspended(true);
  }, [currentPresence, setIsSuspended]);

  const onForeground = useCallback(() => {
    fetchCurrentPresence(true);
  }, [fetchCurrentPresence]);

  usePresenceLifecycle({
    userId: user?.id,
    hasFetchedOnce,
    currentPresence,
    onBackground,
    onForeground,
  });

  // === Activation ===

  const activatePresenceAtPlace = async (placeId: string, intentionId: string, assuntoAtual?: string) => {
    if (profileLoading) throw new Error('PROFILE_LOADING');
    if (!checkProfileComplete(profile, interests)) throw new Error('PROFILE_INCOMPLETE');
    if (!user) return { error: new Error('Not authenticated'), presenceId: null };
    if (!placeId) return { error: new Error('place_id é obrigatório para criar presença'), presenceId: null };

    if (activationPromiseRef.current) return activationPromiseRef.current;

    if (currentPresence?.place_id === placeId && currentPresence?.ativo) {
      console.log('[Presence] Already active at this place, returning existing');
      return { error: null, presenceId: currentPresence.id };
    }

    console.log(`[Presence] 🔄 Activating presence at place: ${placeId}`);
    setIsEnteringPlace(true);
    setLastEndReason(null);
    stopGPSMonitoring();

    const promise = (async () => {
      try {
        const { data: newPresenceId, error } = await supabase.rpc('activate_presence', {
          p_user_id: user.id,
          p_place_id: placeId,
          p_intention_id: intentionId,
          p_assunto_atual: assuntoAtual?.trim() || null,
        });

        if (error) {
          console.error('[Presence] ❌ Error in activate_presence RPC:', error);
          setIsEnteringPlace(false);
          return { error, presenceId: null };
        }

        console.log(`[Presence] ✅ Presence activated: ${newPresenceId}`);
        timerHook.resetTimer();
        await fetchCurrentPresence();

        return { error: null, presenceId: newPresenceId as string | null };
      } finally {
        setIsEnteringPlace(false);
        console.log('[Presence] ✅ Entry transition completed');
      }
    })();

    activationPromiseRef.current = promise;
    promise.finally(() => { activationPromiseRef.current = null; });
    return promise;
  };

  const createTemporaryPlace = async (
    nome: string,
    latitude: number,
    longitude: number,
    intentionId: string,
    assuntoAtual?: string
  ) => {
    if (!user) return { error: new Error('Not authenticated'), placeId: null, presenceId: null };

    const expiresAt = new Date(Date.now() + TEMPORARY_PLACE_DURATION_MS).toISOString();

    const { data: placeData, error: placeError } = await supabase
      .from('places')
      .insert({
        provider: 'user',
        provider_id: `temp_${user.id}_${Date.now()}`,
        nome: nome.trim(),
        latitude,
        longitude,
        origem: 'user_created',
        is_temporary: true,
        created_by: user.id,
        expires_at: expiresAt,
        ativo: true,
      })
      .select('id')
      .single();

    if (placeError) {
      console.error('[usePresence] Error creating temporary place:', placeError);
      return { error: new Error('Não foi possível criar o local temporário'), placeId: null, presenceId: null };
    }

    console.log(`[usePresence] ✅ Temporary place created: ${placeData.id}`);
    const { error: presenceError, presenceId } = await activatePresenceAtPlace(placeData.id, intentionId, assuntoAtual);

    if (presenceError) return { error: presenceError, placeId: null, presenceId: null };
    return { error: null, placeId: placeData.id, presenceId };
  };

  const renewPresence = async () => {
    if (!user || !currentPresence) return { error: new Error('No active presence') };

    const { error } = await supabase
      .from('presence')
      .update({ ultima_atividade: new Date().toISOString() })
      .eq('id', currentPresence.id);

    if (error) {
      if (error.message?.includes('RENEWAL_LIMIT') || error.code === 'P0001') {
        console.log('[usePresence] ⏰ Renewal limit reached (2h max) - ending presence');
        await endPresence('expired');
        return { error: new Error('Presença atingiu o limite de 2 horas') };
      }
      return { error };
    }

    timerHook.resetTimer();
    await fetchCurrentPresence();
    return { error: null };
  };

  const deactivatePresence = async () => {
    await endPresence('manual');
  };

  // === Initial fetch ===

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setCurrentPresence(null);
        setCurrentPlace(null);
        setLoading(false);
        setHasFetchedOnce(false);
        return;
      }

      if (!hasFetchedOnce) setLoading(true);

      await fetchIntentions();
      await fetchCurrentPresence();

      setLoading(false);
      setHasFetchedOnce(true);
    };
    init();

    return () => { stopGPSMonitoring(); };
  }, [user]);

  return {
    // Data
    intentions,
    nearbyPlaces,
    nearbyTemporaryPlaces,
    currentPresence,
    currentPlace,
    loading,
    profileLoading,
    placesLoading,
    remainingTime: timerHook.remainingTime,
    lastEndReason,

    // Logical state
    presenceState,

    // Config
    presenceRadiusMeters: PRESENCE_RADIUS_METERS,
    presenceDurationMs: PRESENCE_DURATION_MS,

    // Actions
    formatRemainingTime: timerHook.getFormattedRemainingTime,
    fetchNearbyPlaces,
    fetchNearbyTemporaryPlaces,
    activatePresenceAtPlace,
    createTemporaryPlace,
    renewPresence,
    deactivatePresence,
    refetch: fetchCurrentPresence,
    clearLastEndReason: () => setLastEndReason(null),

    // Transition states
    isEnteringPlace,
  };
}
