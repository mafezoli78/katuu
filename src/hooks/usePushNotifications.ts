// src/hooks/usePushNotifications.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Cole aqui a Public Key gerada pelo comando: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BHUSEzK8keNZfL_zVoS3C4pLYfVysNqAODzaw89SlvHDJ879fqzez8v2DTC7OZzC1peI-AnDTBtADe0Uz8qQKnQ';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = async (): Promise<boolean> => {
    if (!supported || !user) return false;

    try {
      // Pede permissão ao usuário
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;

      // Registra o service worker
      const registration = await navigator.serviceWorker.ready;

      // Cria a subscription no navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const sub = subscription.toJSON();
      if (!sub.keys) return false;

      // Salva no Supabase
      const { error } = await (supabase
        .from('push_subscriptions' as any)
        .upsert({
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        } as any, { onConflict: 'endpoint' }));

      if (error) {
        console.error('[usePushNotifications] Error saving subscription:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[usePushNotifications] Error subscribing:', err);
      return false;
    }
  };

  const unsubscribe = async (): Promise<void> => {
    if (!supported || !user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      await subscription.unsubscribe();

      await (supabase
        .from('push_subscriptions' as any)
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint));
    } catch (err) {
      console.error('[usePushNotifications] Error unsubscribing:', err);
    }
  };

  return { permission, supported, subscribe, unsubscribe };
}
