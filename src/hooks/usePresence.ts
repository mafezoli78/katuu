import { useProfile } from '@/hooks/useProfile';
import { useState, useEffect, useCallback, useRef } from 'react';
import { isProfileComplete as checkProfileComplete } from '@/utils/profileCompletion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { placesService, Place } from '@/services/placesService';
import { logger } from '@/lib/logger';
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
      logger.debug(
        `[usePresence] 🔍 Searching places: lat=${lat}, lng=${lng}, radius=${SEARCH_RADIUS_METERS}m`
      );
      const [places, temporaryPlaces] = await Promise.all([
        placesService.searchNearby({ latitude: lat, longitude: lng, radius: SEARCH_RADIUS_METERS }),
        fetchNearbyTemporaryPlaces(lat, lng),
      ]);
      logger.debug(
        `[usePresence] ✅ ${places.length} places found, ${temporaryPlaces.length} temporary places nearby`
      );
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
      logger.debug('[usePresence] 🔄 Revalidation started - marked as suspended');
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
        const expiresAt = new Date(data.expires_at).getTime();
        const now = Date.now();

        if (now > expiresAt) {
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
        logger.debug('[usePresence] ✅ Presence validated successfully');
        return { valid: true };
      } else {
        if (isRevalidation) {
          logger.debug('[usePresence] ⚠️ Revalidation found no presence - keeping stale state as suspended');
          setLastEndReason({
            type: 'presence_lost_background',
            message: END_REASON_MESSAGES.presence_lost_background,
            timestamp: new Date().toISOString(),
            isHumanInitiated: false,
          });
          return { valid: false };
        } else {
          logger.debug('[usePresence] ℹ️ Initial fetch found no presence');
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

    logger.debug(`[Presence] 🔚 Ending presence: ${reason} → ${semanticReason} (human-initiated)`);
    stopGPSMonitoring();

    const placeId = currentPresence?.place_id || currentPlace?.id;

    if (placeId) {
      try {
        const { error } = await supabase.rpc('end_presence_cascade', {
          p_user_id: user.id,
          p_place_id: placeId,
          p_motivo: reason,
          p_force: true,
        } as any);
        if (error) {
          console.error('[Presence] Error in cascade cleanup:', error);
        } else {
          logger.debug('[Presence] ✅ Cascade cleanup completed with reason:', reason);
        }
      } catch (err) {
        console.error('[Presence] Error calling end_presence_cascade:', err);
      }
    }

    // REMOVIDO: hard-delete de presence (supabase.from('presence').delete()).
    // O cascade acima já encerra (ativo=false). O delete destruía o histórico
    // (regra de negócio: efêmero p/ usuário, não p/ negócio) e gerava os
    // eventos DELETE "fantasmas" no Realtime. Confirmação prévia (PASSO 0a do
    // hardening): presence não tem unique(user_id, place_id), então linhas
    // antigas inativas não conflitam com novas ativações.

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
      logger.debug('[Presence] Already active at this place, returning existing');
      return { error: null, presenceId: currentPresence.id };
    }

    logger.debug(`[Presence] 🔄 Activating presence at place: ${placeId}`);
    setIsEnteringPlace(true);
    setLastEndReason(null);
    stopGPSMonitoring();

    const promise = (async () => {
      try {
        const callActivateRPC = async (attempt = 1): Promise<{ data: any; error: any }> => {
          const result = await supabase.rpc('activate_presence', {
            p_place_id: placeId,
            p_intention_id: intentionId,
            p_assunto_atual: assuntoAtual?.trim() || null,
          });

          // Schema cache error — retry up to 3 times with increasing delay
          const isSchemaCacheError = result.error?.message?.includes('schema cache') ||
            result.error?.message?.includes('Could not find the function');

          if (isSchemaCacheError && attempt < 3) {
            logger.debug(`[Presence] Schema cache miss — retrying (attempt ${attempt + 1}/3)...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            return callActivateRPC(attempt + 1);
          }

          return result;
        };

        const { data: newPresenceId, error } = await callActivateRPC();

        if (error) {
          console.error('[Presence] ❌ Error in activate_presence RPC:', error);
          setIsEnteringPlace(false);
          return { error, presenceId: null };
        }

        logger.debug(`[Presence] ✅ Presence activated: ${newPresenceId}`);
        timerHook.resetTimer();
        await fetchCurrentPresence();

        return { error: null, presenceId: newPresenceId as string | null };
      } finally {
        setIsEnteringPlace(false);
        logger.debug('[Presence] ✅ Entry transition completed');
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

    // Server-side: valida nome/coords, limita a 2 locais temporários ativos
    // por usuário e crava o expires_at no SERVIDOR (antes era INSERT direto)
    const { data: placeId, error: placeError } = await supabase.rpc('create_temporary_place', {
      p_nome: nome.trim(),
      p_lat: latitude,
      p_lng: longitude,
    });

    if (placeError || !placeId) {
      console.error('[usePresence] Error creating temporary place:', placeError);
      const msg = placeError?.message || '';
      const friendly = msg.includes('TEMP_PLACE_LIMIT_REACHED')
        ? 'Você já tem locais temporários ativos demais. Aguarde expirarem.'
        : msg.includes('TEMP_PLACE_NAME_TOO_SHORT')
          ? 'O nome do local precisa ter pelo menos 3 caracteres'
          : msg.includes('TEMP_PLACE_NAME_TOO_LONG')
            ? 'O nome do local pode ter no máximo 60 caracteres'
            : 'Não foi possível criar o local temporário';
      return { error: new Error(friendly), placeId: null, presenceId: null };
    }

    logger.debug(`[usePresence] ✅ Temporary place created: ${placeId}`);
    const { error: presenceError, presenceId } = await activatePresenceAtPlace(placeId as string, intentionId, assuntoAtual);

    if (presenceError) return { error: presenceError, placeId: null, presenceId: null };
    return { error: null, placeId: placeId as string, presenceId };
  };

  const mapExtendPresenceError = (errorMessage: string): string => {
    if (errorMessage.includes('EXTEND_COOLDOWN')) return 'Aguarde um pouco para estender novamente';
    if (errorMessage.includes('EXTEND_MAX_REACHED')) return 'Você atingiu o limite de 8 horas neste local';
    if (errorMessage.includes('EXTEND_NO_PRESENCE')) return 'Nenhuma presença ativa encontrada';
    return 'Erro ao estender presença';
  };

  const renewPresence = async () => {
    if (!user || !currentPresence) return { error: new Error('No active presence') };

    const { data: newExpiresAt, error } = await supabase.rpc('extend_presence' as any);

    if (error) {
      return { error: new Error(mapExtendPresenceError(error.message || '')) };
    }

    timerHook.resetTimer(newExpiresAt as string);
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
