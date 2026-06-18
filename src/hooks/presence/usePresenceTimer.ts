import { useState, useEffect, useCallback } from 'react';
import { PRESENCE_DURATION_MS, formatRemainingTime } from '@/config/presence';
import type { Presence } from './types';

interface UsePresenceTimerOptions {
  currentPresence: Presence | null;
  onExpired: () => void;
}

/**
 * Sub-hook: countdown timer for active presence.
 * Purely UI hint — real expiration is enforced by backend cron.
 */
export function usePresenceTimer({ currentPresence, onExpired }: UsePresenceTimerOptions) {
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Initialize remaining time when presence changes
  useEffect(() => {
    if (!currentPresence) {
      setRemainingTime(0);
      return;
    }

    const remaining = Math.max(0, new Date(currentPresence.expires_at).getTime() - Date.now());
    setRemainingTime(remaining);
  }, [currentPresence?.id, currentPresence?.expires_at]);

  // Countdown interval
  useEffect(() => {
    if (!currentPresence || remainingTime <= 0) return;

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1000) {
          onExpired();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPresence, onExpired]);

  const resetTimer = useCallback((expiresAt?: string) => {
    if (expiresAt) {
      setRemainingTime(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    } else {
      setRemainingTime(PRESENCE_DURATION_MS);
    }
  }, []);

  const getFormattedRemainingTime = useCallback(() => {
    return formatRemainingTime(remainingTime);
  }, [remainingTime]);

  return {
    remainingTime,
    resetTimer,
    getFormattedRemainingTime,
  };
}
