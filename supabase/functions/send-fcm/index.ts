// supabase/functions/send-fcm/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Logo após a primeira linha de import, antes de qualquer código
const rawAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
console.log('[send-fcm] FIREBASE_SERVICE_ACCOUNT length:', rawAccount?.length);
console.log('[send-fcm] Starts with:', rawAccount?.substring(0, 20));

const FIREBASE_SERVICE_ACCOUNT = JSON.parse(rawAccount!);

// ... (Funções getAccessToken e sendToToken permanecem as mesmas) ...

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth removida — função só é chamada internamente
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey!);
  const payload = await req.json();
  const record = payload.record || payload;
  const { user_id, title, body: message, payload: data, id: queue_id } = record;

  try {
    const { data: tokens } = await supabase.from('fcm_tokens').select('token').eq('user_id', user_id);

    if (!tokens?.length) {
      if (queue_id) await supabase.from('notification_queue').update({ status: 'no_tokens' }).eq('id', queue_id);
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const accessToken = await getAccessToken();
    const results = await Promise.all(tokens.map(t => sendToToken(accessToken, t.token, title, message, data)));

    const sent = results.filter(r => r.success).length;
    if (queue_id) {
      await supabase.from('notification_queue').update({
        status: sent > 0 ? 'sent' : 'failed',
        error_message: sent === 0 ? 'FCM failed for all tokens' : null
      }).eq('id', queue_id);
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (err) {
    if (queue_id) await supabase.from('notification_queue').update({ status: 'error', error_message: err.message }).eq('id', queue_id);
    return new Response('Error', { status: 500 });
  }
});