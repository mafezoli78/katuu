import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  PRESENCE_RADIUS_METERS,
  GPS_CHECK_INTERVAL_MS,
  GPS_EXIT_THRESHOLD_COUNT,
  GPS_ACCURACY_THRESHOLD_METERS,
  GPS_EXIT_ENABLED,
  calculateDistanceMeters,
} from '@/config/presence';
import { PresenceEndReason, END_REASON_MESSAGES } from '@/types/presence';
import type { Presence } from './types';
import type { Place } from '@/services/placesService';
import { logger } from '@/lib/logger';
import { useDeviceLocation, type GpsFix } from '@/contexts/LocationContext';

interface UsePresenceGPSOptions {
  userId: string | undefined;
  currentPresence: Presence | null;
  currentPlace: Place | null;
  onPresenceEnded: (reason: PresenceEndReason) => void;
}

/**
 * Sub-hook: GPS monitoring for presence.
 *
 * Com GPS_EXIT_ENABLED = false (atual):
 *   O GPS valida apenas a ENTRADA — primeira leitura dentro do raio
 *   estabelece o baseline, dispara confirm_presence no backend e o
 *   monitoramento é ENCERRADO (economia de bateria). Nenhuma leitura
 *   jamais expulsa o usuário do local.
 *
 * Com GPS_EXIT_ENABLED = true (legado):
 *   Após o baseline, leituras fora do raio são contadas e, ao atingir
 *   o threshold, o backend decide encerrar a presença.
 */
export function usePresenceGPS({
  userId,
  currentPresence,
  currentPlace,
  onPresenceEnded,
}: UsePresenceGPSOptions) {
  const { watchPosition } = useDeviceLocation();

  const gpsStopRef = useRef<(() => void) | null>(null);
  const outsideRadiusCountRef = useRef(0);
  const presenceLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const baselineEstablishedRef = useRef(false);

  // Stable refs for callback dependencies
  const currentPresenceRef = useRef(currentPresence);
  currentPresenceRef.current = currentPresence;
  const currentPlaceRef = useRef(currentPlace);
  currentPlaceRef.current = currentPlace;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const stopGPSMonitoring = useCallback(() => {
    if (gpsStopRef.current !== null) {
      logger.debug('[GPS] 🛑 Stopping position monitoring');
      gpsStopRef.current();
      gpsStopRef.current = null;
      outsideRadiusCountRef.current = 0;
      baselineEstablishedRef.current = false;
    }
  }, []);

  const confirmPresenceOnBackend = useCallback(async (lat?: number, lng?: number) => {
    const uid = userIdRef.current;
    const place = currentPlaceRef.current;
    if (!uid || !place) return false;

    try {
      const { data, error } = await supabase.rpc('confirm_presence', {
        p_place_id: place.id,
        p_lat: lat ?? null,
        p_lng: lng ?? null,
      });

      if (error) {
        if (error.message.includes('PRESENCE_TOO_FAR')) {
          console.error('[GPS] Backend rejected confirmation: too far from place');
        } else {
          console.error('[GPS] Error confirming presence:', error);
        }
        return false;
      }

      if (data) {
        logger.debug('[GPS] ✅ Presence confirmed on backend (with coords proof)');
      }
      return !!data;
    } catch (err) {
      console.error('[GPS] Error calling confirm_presence:', err);
      return false;
    }
  }, []);

  const reportGPSExitToBackend = useCallback(async () => {
    const uid = userIdRef.current;
    const place = currentPlaceRef.current;
    if (!uid || !place) return;

    logger.debug('[GPS] 📤 Reporting GPS exit to backend...');

    try {
      const { error } = await supabase.rpc('end_presence_cascade', {
        p_user_id: uid,
        p_place_id: place.id,
        p_motivo: 'gps_exit',
        p_force: false,
      } as any);

      if (error) {
        console.error('[GPS] Backend rejected GPS exit:', error);
        return;
      }

      logger.debug('[GPS] ✅ Backend accepted GPS exit - presence ended definitively');
      stopGPSMonitoring();

      onPresenceEnded({
        type: 'gps_exit',
        message: END_REASON_MESSAGES.gps_exit,
        timestamp: new Date().toISOString(),
        isHumanInitiated: true, // Backend approved = definitive end
      });
    } catch (err) {
      console.error('[GPS] Error reporting GPS exit:', err);
    }
  }, [stopGPSMonitoring, onPresenceEnded]);

  const checkGPSPosition = useCallback(
    (fix: GpsFix) => {
      if (!presenceLocationRef.current || !currentPresenceRef.current) return;

      const { lat: latitude, lng: longitude, accuracy } = fix;
      const { lat: locLat, lng: locLng } = presenceLocationRef.current;

      if (accuracy && accuracy > GPS_ACCURACY_THRESHOLD_METERS) {
        logger.debug(`[GPS] Ignoring reading with poor accuracy: ${accuracy}m (threshold: ${GPS_ACCURACY_THRESHOLD_METERS}m)`);
        return;
      }

      const distance = calculateDistanceMeters(latitude, longitude, locLat, locLng);
      const isInside = distance <= PRESENCE_RADIUS_METERS;

      logger.debug(
        `[GPS] Distance from place: ${Math.round(distance)}m (radius: ${PRESENCE_RADIUS_METERS}m) - ${isInside ? '✅ Inside' : '⚠️ Outside'}`
      );

      if (isInside) {
        if (outsideRadiusCountRef.current > 0) {
          logger.debug('[GPS] ✅ Back inside radius');
        }
        outsideRadiusCountRef.current = 0;

        if (!baselineEstablishedRef.current) {
          baselineEstablishedRef.current = true;
          confirmPresenceOnBackend(latitude, longitude);

          // Saída por GPS desligada: com o baseline confirmado, o GPS já
          // cumpriu seu papel (integridade na entrada). Encerra o watcher
          // e economiza bateria pelo resto da sessão.
          if (!GPS_EXIT_ENABLED) {
            logger.debug('[GPS] ✅ Baseline confirmado — monitoramento encerrado (GPS_EXIT_ENABLED=false)');
            stopGPSMonitoring();
          }
        }
        return;
      }

      // CRITICAL: Don't count outside readings until baseline is established
      // Initial GPS readings can be very inaccurate and cause false exits
      if (!baselineEstablishedRef.current) {
        logger.debug('[GPS] ⏳ Outside radius but baseline not established yet - ignoring');
        return;
      }

      // Saída por GPS desligada: leituras fora do raio nunca expulsam.
      // (Na prática este ponto nem é alcançado, pois o watcher é encerrado
      // no baseline — guarda dupla por segurança.)
      if (!GPS_EXIT_ENABLED) return;

      outsideRadiusCountRef.current++;
      logger.debug(`[GPS] Outside radius (${outsideRadiusCountRef.current}/${GPS_EXIT_THRESHOLD_COUNT})`);

      if (outsideRadiusCountRef.current >= GPS_EXIT_THRESHOLD_COUNT) {
        logger.debug('[GPS] 🚪 Exit threshold reached - reporting to backend');
        reportGPSExitToBackend();
      }
    },
    [confirmPresenceOnBackend, reportGPSExitToBackend, stopGPSMonitoring]
  );

  const startGPSMonitoring = useCallback(() => {
    if (gpsStopRef.current !== null) return;

    logger.debug('[GPS] 📍 Starting position monitoring...');
    outsideRadiusCountRef.current = 0;
    baselineEstablishedRef.current = false;

    // Erro de leitura é logado dentro do LocationProvider (watchPosition).
    gpsStopRef.current = watchPosition(checkGPSPosition, {
      maximumAge: GPS_CHECK_INTERVAL_MS,
      timeout: 15000,
    });
  }, [checkGPSPosition, watchPosition]);

  const setPresenceLocation = useCallback((lat: number, lng: number) => {
    presenceLocationRef.current = { lat, lng };
  }, []);

  return {
    startGPSMonitoring,
    stopGPSMonitoring,
    setPresenceLocation,
    presenceLocationRef,
  };
}
