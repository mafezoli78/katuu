// src/hooks/useAutoPushSubscription.ts
// Solicita permissão de notificação automaticamente após login
// Deve ser chamado uma vez no App.tsx ou num componente raiz

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BHUSEzK8keNZfL_zVoS3C4pLYfVysNqAODzaw89SlvHDJ879fqzez8v2DTC7OZzC1peI-AnDTBtADe0Uz8qQKnQ';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function subscribeUser(userId: string) {
  try {
    // Verifica suporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    // Aguarda SW estar pronto
    const registration = await navigator.serviceWorker.ready;

    // Verifica se já tem subscription ativa
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Garante que está salva no banco
      const sub = existing.toJSON();
      if (sub.keys) {
        await (supabase.from('push_subscriptions' as any).upsert({
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        } as any, { onConflict: 'endpoint' }));
      }
      return;
    }

    // Pede permissão ao usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Cria nova subscription
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

    // Pequeno delay para garantir que o SW está registrado
    const timer = setTimeout(() => {
      subscribeUser(user.id);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user?.id]);
}
