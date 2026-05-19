import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

function isNative(): boolean {
  const win = window as any;
  return !!(win.Capacitor?.isNativePlatform?.()) ||
    win.Capacitor?.getPlatform?.() === 'android' ||
    win.Capacitor?.getPlatform?.() === 'ios';
}

export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || !isNative() || registeredRef.current) return;

    const setup = async () => {
      try {
        const win = window as any;
        const PushNotifications = win.Capacitor?.Plugins?.PushNotifications;

        if (!PushNotifications) {
          console.warn('[Push] PushNotifications plugin não disponível');
          return;
        }

        // Pede permissão
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          console.warn('[Push] Permissão negada');
          return;
        }

        // Registra no FCM
        await PushNotifications.register();

        // Recebe o token FCM
        PushNotifications.addListener('registration', async (token: { value: string }) => {
          console.log('[Push] Token FCM:', token.value);
          registeredRef.current = true;

          // Salva no Supabase
          const { error } = await supabase
            .from('fcm_tokens')
            .upsert(
              {
                user_id: user.id,
                token: token.value,
                platform: 'android',
              },
              { onConflict: 'user_id,token' }
            );

          if (error) {
            console.error('[Push] Erro ao salvar token:', error);
          } else {
            console.log('[Push] Token salvo com sucesso');
          }
        });

        // Erro de registro
        PushNotifications.addListener('registrationError', (err: any) => {
          console.error('[Push] Erro de registro FCM:', err);
        });

        // Notificação recebida com app aberto
        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('[Push] Notificação recebida:', notification);
        });

        // Usuário tocou na notificação
        PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
          console.log('[Push] Ação na notificação:', action);
          const url = action.notification?.data?.url;
          if (url) {
            window.location.href = url;
          }
        });

      } catch (err) {
        console.error('[Push] Erro ao configurar push:', err);
      }
    };

    setup();
  }, [user?.id]);
}
