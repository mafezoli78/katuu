// supabase/functions/send-fcm/index.ts
// Edge Function para enviar notificações via Firebase Cloud Messaging V1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);

// Gera access token OAuth2 para FCM V1
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

  // Importa chave privada RSA
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

  // Troca JWT por access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Envia notificação para um token FCM
async function sendToToken(
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; token: string; error?: string }> {
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
            notification: {
              sound: 'default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
        },
      }),
    }
  );

  const result = await res.json();

  if (!res.ok) {
    console.error('[send-fcm] Erro FCM:', result);
    return { success: false, token: fcmToken, error: result.error?.message };
  }

  return { success: true, token: fcmToken };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey!
  );

  const body = await req.json() as {
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  };

  const { user_id, title, body: message, data } = body;

  if (!user_id || !title || !message) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Busca tokens FCM do usuário
  const { data: tokens, error } = await supabase
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', user_id);

  if (error || !tokens?.length) {
    console.log('[send-fcm] Nenhum token encontrado para:', user_id);
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Gera access token OAuth2
  const accessToken = await getAccessToken();

  // Envia para todos os dispositivos do usuário
  const results = await Promise.all(
    tokens.map(t => sendToToken(accessToken, t.token, title, message, data))
  );

  // Remove tokens inválidos
  const invalidTokens = results
    .filter(r => !r.success && r.error?.includes('UNREGISTERED'))
    .map(r => r.token);

  if (invalidTokens.length > 0) {
    await supabase
      .from('fcm_tokens')
      .delete()
      .in('token', invalidTokens);
  }

  const sent = results.filter(r => r.success).length;
  console.log(`[send-fcm] Enviado para ${sent}/${tokens.length} dispositivos`);

  return new Response(JSON.stringify({ sent, total: tokens.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
