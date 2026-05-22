// supabase/functions/process-notification-queue/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: FIREBASE_SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const privateKeyPem = FIREBASE_SERVICE_ACCOUNT.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const privateKeyBytes = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sendToToken(
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; token: string; unregistered?: boolean }> {
  const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: data || {},
          android: {
            priority: 'high',
            notification: { sound: 'default' },
          },
        },
      }),
    }
  );

  const result = await res.json();
  if (!res.ok) {
    const isUnregistered = result.error?.details?.[0]?.errorCode === 'UNREGISTERED';
    console.error('[FCM] Erro:', result.error?.message);
    return { success: false, token: fcmToken, unregistered: isUnregistered };
  }
  return { success: true, token: fcmToken };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

  // Busca notificações pendentes
  const { data: pendingItems, error: fetchError } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error('[process-queue] Erro ao buscar fila:', fetchError);
    return new Response('Error fetching queue', { status: 500 });
  }

  if (!pendingItems || pendingItems.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  console.log(`[process-queue] Processando ${pendingItems.length} notificações...`);

  // Gera access token FCM uma vez para todos os itens
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('[process-queue] Erro ao obter access token FCM:', err);
    return new Response('FCM auth error', { status: 500 });
  }

  const results = await Promise.allSettled(
    pendingItems.map(async (item) => {
      try {
        await supabase.from('notification_queue').update({ status: 'processing' }).eq('id', item.id);

        // Busca tokens FCM do usuário
        const { data: tokens } = await supabase
          .from('fcm_tokens')
          .select('token')
          .eq('user_id', item.user_id);

        if (!tokens?.length) {
          await supabase.from('notification_queue').update({ status: 'no_tokens' }).eq('id', item.id);
          return { id: item.id, success: true };
        }

        // Envia para todos os dispositivos
        const sendResults = await Promise.all(
          tokens.map(t => sendToToken(accessToken, t.token, item.title, item.body, item.payload))
        );

        // Remove tokens inválidos
        const invalidTokens = sendResults.filter(r => r.unregistered).map(r => r.token);
        if (invalidTokens.length > 0) {
          await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
        }

        const sent = sendResults.filter(r => r.success).length;
        await supabase.from('notification_queue').update({
          status: sent > 0 ? 'sent' : 'failed',
          error_message: sent === 0 ? 'FCM failed for all tokens' : null
        }).eq('id', item.id);

        return { id: item.id, success: sent > 0 };
      } catch (err) {
        console.error(`[process-queue] Erro no item ${item.id}:`, err);
        await supabase.from('notification_queue').update({
          status: 'error',
          error_message: err.message
        }).eq('id', item.id);
        return { id: item.id, success: false };
      }
    })
  );

  const processedCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
  console.log(`[process-queue] Concluído: ${processedCount}/${pendingItems.length} enviados`);

  return new Response(JSON.stringify({ processed: processedCount, total: pendingItems.length }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
});
