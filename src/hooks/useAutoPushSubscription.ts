// src/hooks/useAutoPushSubscription.ts
// Solicita permissão e registra subscription a cada login
// Apenas em ambiente web/PWA — não no app nativo

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BMjJdgmsVCtRExT2_2vs0eQmoDrZ8ObtjwxatJaEYyAdYAzDPdeUtBCUSuKLmrU4PllBY0QCnlYryostL0iVCQ8';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function subscribeUser(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    const registration = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const sub = subscription.toJSON();
    if (!sub.keys) return;

    await (supabase.from('push_subscriptions' as any).upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    } as any, { onConflict: 'endpoint' }));

  } catch (err) {
    console.error('[useAutoPushSubscription] Error:', err);
  }
}

export function useAutoPushSubscription() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Não executa no app nativo — push nativo será implementado via FCM na Fase 1
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) return;

      const timer = setTimeout(() => {
        subscribeUser(user.id);
      }, 2000);

      return () => clearTimeout(timer);
    });
  }, [user?.id]);
}
