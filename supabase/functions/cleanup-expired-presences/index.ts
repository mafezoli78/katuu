import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all active presences that have expired (ultima_atividade older than 1 hour)
    const { data: expiredPresences, error: fetchError } = await supabase
      .from("presence")
      .select("user_id, place_id")
      .eq("ativo", true)
      .lt("ultima_atividade", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error("[cleanup] Error fetching expired presences:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredPresences || expiredPresences.length === 0) {
      console.log("[cleanup] No expired presences found");
      return new Response(JSON.stringify({ cleaned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[cleanup] Found ${expiredPresences.length} expired presences`);

    let cleaned = 0;
    let errors = 0;

    for (const presence of expiredPresences) {
      const { error } = await supabase.rpc("end_presence_cascade", {
        p_user_id: presence.user_id,
        p_place_id: presence.place_id,
        p_motivo: "presence_expired",
        p_force: true, // Force end regardless of confirmation status
      });

      if (error) {
        console.error(
          `[cleanup] Error ending presence for user ${presence.user_id} at ${presence.place_id}:`,
          error
        );
        errors++;
      } else {
        cleaned++;
      }
    }

    // Also run close_conversations_without_presence
    const { error: closeError } = await supabase.rpc("close_conversations_without_presence");
    if (closeError) {
      console.error("[cleanup] Error closing orphan conversations:", closeError);
    }

    console.log(`[cleanup] Done: ${cleaned} cleaned, ${errors} errors`);

    return new Response(
      JSON.stringify({ cleaned, errors, total: expiredPresences.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cleanup] Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
