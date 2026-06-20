import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeCandidate {
  label: string;
  lat: number;
  lon: number;
}

interface GeoapifyResult {
  formatted: string;
  lat: number;
  lon: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH CHECK ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text }: { text: string } = await req.json();

    if (!text || text.trim().length < 3) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEOAPIFY_API_KEY");
    if (!apiKey) {
      console.error("[geocode-autocomplete] ❌ GEOAPIFY_API_KEY not configured");
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmed = text.trim();
    const geoapifyUrl = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    geoapifyUrl.searchParams.set("text", trimmed);
    geoapifyUrl.searchParams.set("format", "json");
    geoapifyUrl.searchParams.set("lang", "pt");
    geoapifyUrl.searchParams.set("limit", "5");
    geoapifyUrl.searchParams.set("bias", "countrycode:br");
    geoapifyUrl.searchParams.set("apiKey", apiKey);

    console.log(`[geocode-autocomplete] 🔍 Calling Geoapify for: "${trimmed}"`);

    const geoapifyResponse = await fetch(geoapifyUrl.toString());

    if (!geoapifyResponse.ok) {
      console.error(`[geocode-autocomplete] ❌ Geoapify error: ${geoapifyResponse.status}`);
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geoapifyData = await geoapifyResponse.json();
    const rawResults: GeoapifyResult[] = geoapifyData.results || [];

    const candidates: GeocodeCandidate[] = rawResults.slice(0, 5).map((r) => ({
      label: r.formatted,
      lat: r.lat,
      lon: r.lon,
    }));

    console.log(`[geocode-autocomplete] 📤 Returning ${candidates.length} candidates:`,
      candidates.map(c => `${c.label} (${c.lat}, ${c.lon})`).join(' | '));

    return new Response(
      JSON.stringify({ results: candidates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[geocode-autocomplete] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
