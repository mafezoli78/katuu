// supabase/functions/send-push/index.ts
// Edge Function para enviar Web Push Notifications
// Deploy: supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Web Push via VAPID — implementação manual sem dependências externas
// (Deno/Edge Functions não suportam a lib 'web-push' do Node)

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:suporte@katuu.com.br';

// Converte base64url para Uint8Array
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Converte Uint8Array para base64url
function uint8ArrayToBase64Url(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Gera JWT VAPID para autenticação
async function generateVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encodedHeader = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

// Envia push para um único endpoint
async function sendPushToEndpoint(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ success: boolean; endpoint: string; status?: number }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await generateVapidJwt(audience);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        TTL: '86400',
      },
      body: new TextEncoder().encode(payload),
    });

    return {
      success: response.status === 201 || response.status === 200,
      endpoint: subscription.endpoint,
      status: response.status,
    };
  } catch (err) {
    console.error('[send-push] Error sending to endpoint:', err);
    return { success: false, endpoint: subscription.endpoint };
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verifica que a chamada vem do próprio Supabase (service role)
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
    url?: string;
  };

  const { user_id, title, body: message, url } = body;

  if (!user_id || !title || !message) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Busca todas as subscriptions do usuário
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id);

  if (error || !subscriptions?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify({ title, body: message, url: url || '/' });

  // Envia para todos os dispositivos do usuário
  const results = await Promise.all(
    subscriptions.map(sub => sendPushToEndpoint(sub, payload))
  );

  // Remove subscriptions inválidas (dispositivo desinstalou o app)
  const invalidEndpoints = results
    .filter(r => r.status === 410 || r.status === 404)
    .map(r => r.endpoint);

  if (invalidEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', invalidEndpoints);
  }

  const sent = results.filter(r => r.success).length;

  return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
