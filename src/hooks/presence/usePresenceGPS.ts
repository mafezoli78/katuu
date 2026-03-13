import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  PRESENCE_RADIUS_METERS,
  GPS_CHECK_INTERVAL_MS,
  GPS_EXIT_THRESHOLD_COUNT,
  GPS_ACCURACY_THRESHOLD_METERS,
  calculateDistanceMeters,
} from '@/config/presence';
import { PresenceEndReason, END_REASON_MESSAGES } from '@/types/presence';
import type { Presence } from './types';
import type { Place } from '@/services/placesService';
import { logger } from '@/lib/logger';

interface UsePresenceGPSOptions {
  userId: string | undefined;
  currentPresence: Presence | null;
  currentPlace: Place | null;
  onPresenceEnded: (reason: PresenceEndReason) => void;
}

/**
 * Sub-hook: GPS monitoring for presence radius enforcement.
 * GPS NEVER ends presence directly — reports to backend which decides.
 */
export function usePresenceGPS({
  userId,
  currentPresence,
  currentPlace,
  onPresenceEnded,
}: UsePresenceGPSOptions) {
  const gpsWatchIdRef = useRef<number | null>(null);
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
    if (gpsWatchIdRef.current !== null) {
      logger.debug('[GPS] 🛑 Stopping position monitoring');
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
      outsideRadiusCountRef.current = 0;
      baselineEstablishedRef.current = false;
    }
  }, []);

  const confirmPresenceOnBackend = useCallback(async () => {
    const uid = userIdRef.current;
    const place = currentPlaceRef.current;
    if (!uid || !place) return false;

    try {
      const { data, error } = await supabase.rpc('confirm_presence', {
        p_place_id: place.id,
      });

      if (error) {
        console.error('[GPS] Error confirming presence:', error);
        return false;
      }

      if (data) {
        logger.debug('[GPS] ✅ Presence confirmed on backend');
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
    (position: GeolocationPosition) => {
      if (!presenceLocationRef.current || !currentPresenceRef.current) return;

      const { latitude, longitude, accuracy } = position.coords;
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
          confirmPresenceOnBackend();
        }
        return;
      }

      // CRITICAL: Don't count outside readings until baseline is established
      // Initial GPS readings can be very inaccurate and cause false exits
      if (!baselineEstablishedRef.current) {
        logger.debug('[GPS] ⏳ Outside radius but baseline not established yet - ignoring');
        return;
      }

      outsideRadiusCountRef.current++;
      logger.debug(`[GPS] Outside radius (${outsideRadiusCountRef.current}/${GPS_EXIT_THRESHOLD_COUNT})`);

      if (outsideRadiusCountRef.current >= GPS_EXIT_THRESHOLD_COUNT) {
        logger.debug('[GPS] 🚪 Exit threshold reached - reporting to backend');
        reportGPSExitToBackend();
      }
    },
    [confirmPresenceOnBackend, reportGPSExitToBackend]
  );

  const startGPSMonitoring = useCallback(() => {
    if (!navigator.geolocation || gpsWatchIdRef.current !== null) return;

    logger.debug('[GPS] 📍 Starting position monitoring...');
    outsideRadiusCountRef.current = 0;
    baselineEstablishedRef.current = false;

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      checkGPSPosition,
      (error) => {
        console.error('[GPS] Error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: GPS_CHECK_INTERVAL_MS,
        timeout: 15000,
      }
    );
  }, [checkGPSPosition]);

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
