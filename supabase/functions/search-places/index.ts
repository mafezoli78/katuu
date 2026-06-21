import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache-first: hit se o box já tem cobertura mínima E foi preenchido
// recentemente. Único lugar onde essas duas constantes são definidas.
// ⚠️ FASE DE TESTES: COVERAGE_TTL_DAYS=1 é proposital pra forçar miss/refetch
// com frequência enquanto validamos a migração Geoapify. Subir pro valor de
// produção (ex.: 60) ANTES de publicar na Play Store.
const COVERAGE_MIN_PLACES = 4;
const COVERAGE_TTL_DAYS = 1;

// =============================================================================
// PROVIDER ARCHITECTURE - Types & Interfaces
// =============================================================================

interface StandardPlace {
  provider_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  categories_raw: { name: string }[];
  raw_data: Record<string, unknown>;
}

interface SearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  limit?: number;
  query?: string;
}

interface PlaceProvider {
  name: string;
  search(params: SearchParams): Promise<StandardPlace[]>;
}

// =============================================================================
// GEOAPIFY PROVIDER
// =============================================================================

// Allow-list expressa diretamente no parâmetro categories= do request — a
// Geoapify filtra no servidor dela, então não é preciso curadoria pós-fetch.
const GEOAPIFY_ALLOWED_CATEGORIES = [
  "catering.bar",
  "catering.pub",
  "catering.biergarten",
  "catering.restaurant",
  "catering.cafe",
  "catering.ice_cream",
  "adult.nightclub",
  "entertainment",
  "leisure.park",
  "national_park",
  "beach",
  "education.university",
  "education.college",
  "commercial.shopping_mall",
  "sport.fitness",
  "sport.sports_centre",
];

interface GeoapifyOsmRaw {
  osm_id?: number;
  osm_type?: string;
  phone?: string;
  website?: string;
  email?: string;
  opening_hours?: string;
  cuisine?: string;
  capacity?: number;
  brand?: string;
  [key: string]: unknown;
}

interface GeoapifyProperties {
  place_id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  categories?: string[];
  distance?: number;
  datasource?: { raw?: GeoapifyOsmRaw };
  contact?: { phone?: string; email?: string };
  website?: string;
  opening_hours?: string;
  catering?: { cuisine?: string; capacity?: number };
  brand?: string;
  [key: string]: unknown;
}

interface GeoapifyFeature {
  type: "Feature";
  properties: GeoapifyProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
}

// Checagem leve de prefixo — rede de segurança contra a API devolver algo
// fora do allow-list pedido em categories=. Reutilizada pela Fase 2
// (import Geofabrik/Overpass), por isso vive como helper independente do
// GeoapifyProvider.
function matchesGeoapifyAllowList(cats: string[]): boolean {
  return cats.some(c => GEOAPIFY_ALLOWED_CATEGORIES.some(a => c === a || c.startsWith(a + ".")));
}

class GeoapifyProvider implements PlaceProvider {
  name = "geoapify";

  async search(params: SearchParams): Promise<StandardPlace[]> {
    const apiKey = Deno.env.get("GEOAPIFY_API_KEY");
    if (!apiKey) {
      throw new Error("GEOAPIFY_API_KEY not configured");
    }

    const { latitude, longitude, radius = 100, limit = 20 } = params;

    // NOTA: params.query (busca por nome) NÃO é usado aqui ainda — a Geoapify
    // Places API não tem busca textual livre equivalente ao Foursquare; o
    // parâmetro `name=` dela exige categories= junto e o comportamento
    // (parcial/fuzzy vs exato) não está documentado. Decisão de como tratar
    // busca por nome fica pendente (ver Etapa 7).

    const geoapifyUrl = new URL("https://api.geoapify.com/v2/places");
    geoapifyUrl.searchParams.set("categories", GEOAPIFY_ALLOWED_CATEGORIES.join(","));
    geoapifyUrl.searchParams.set("filter", `circle:${longitude},${latitude},${radius}`);
    geoapifyUrl.searchParams.set("bias", `proximity:${longitude},${latitude}`);
    geoapifyUrl.searchParams.set("limit", String(Math.min(limit * 3, 500)));
    geoapifyUrl.searchParams.set("lang", "pt");
    geoapifyUrl.searchParams.set("apiKey", apiKey);

    console.log(`[search-places] 🔍 Calling Geoapify API`);

    const geoapifyResponse = await fetch(geoapifyUrl.toString());

    console.log(`[search-places] 📡 Geoapify response: ${geoapifyResponse.status}`);

    if (!geoapifyResponse.ok) {
      const errorText = await geoapifyResponse.text();
      console.error(`[search-places] ❌ Geoapify error: ${geoapifyResponse.status} - ${errorText}`);
      return [];
    }

    const geoapifyData = await geoapifyResponse.json();
    const rawFeatures: GeoapifyFeature[] = geoapifyData.features || [];

    // Checagem leve de prefixo na escrita — rede de segurança contra a API
    // devolver algo fora do categories= pedido (ver matchesGeoapifyAllowList).
    const features = rawFeatures.filter(f =>
      !!f.properties.name && matchesGeoapifyAllowList(f.properties.categories || [])
    );
    if (features.length < rawFeatures.length) {
      console.log(`[search-places] 🚫 Geoapify: ${rawFeatures.length - features.length} fora do allow-list, descartadas na escrita`);
    }

    console.log(`[search-places] ✅ Geoapify: ${features.length} places (curados via categories= no request)`);

    return features.map(({ properties, geometry }) => {
      const cats = properties.categories || [];
      const category =
        cats.find(c => GEOAPIFY_ALLOWED_CATEGORIES.some(a => c === a || c.startsWith(a + "."))) ||
        cats.find(c => !c.startsWith("building")) ||
        cats[0] || null;

      return {
        provider_id: properties.place_id || "",
        name: properties.name || "",
        latitude: properties.lat ?? geometry.coordinates[1],
        longitude: properties.lon ?? geometry.coordinates[0],
        address: properties.address_line1 || null,
        city: properties.city || null,
        state: properties.state || null,
        country: properties.country || null,
        category,
        categories_raw: cats.map(name => ({ name })),
        raw_data: {
          place_id: properties.place_id ?? null,
          osm_id: properties.datasource?.raw?.osm_id ?? null,
          osm_type: properties.datasource?.raw?.osm_type ?? null,
          categories: cats,
          phone: properties.contact?.phone ?? properties.datasource?.raw?.phone ?? null,
          email: properties.contact?.email ?? properties.datasource?.raw?.email ?? null,
          website: properties.website ?? properties.datasource?.raw?.website ?? null,
          opening_hours: properties.opening_hours ?? properties.datasource?.raw?.opening_hours ?? null,
          cuisine: properties.catering?.cuisine ?? properties.datasource?.raw?.cuisine ?? null,
          capacity: properties.catering?.capacity ?? properties.datasource?.raw?.capacity ?? null,
          brand: properties.brand ?? properties.datasource?.raw?.brand ?? null,
        },
      };
    });
  }
}

// =============================================================================
// MAPBOX PROVIDER (stub)
// =============================================================================

class MapboxProvider implements PlaceProvider {
  name = "mapbox";

  async search(_params: SearchParams): Promise<StandardPlace[]> {
    throw new Error("Mapbox provider not implemented yet");
  }
}

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

function getProvider(): PlaceProvider {
  const providerName = (Deno.env.get("PLACE_PROVIDER") || "geoapify").toLowerCase();
  switch (providerName) {
    case "mapbox":
      return new MapboxProvider();
    case "geoapify":
    default:
      return new GeoapifyProvider();
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

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

    const provider = getProvider();

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      latitude,
      longitude,
      radius = 100,
      limit = 20,
      query,
    }: SearchParams = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[search-places] 📍 Searching: lat=${latitude}, lng=${longitude}, radius=${radius}m, provider=${provider.name}`);

    // Single bounding box at `radius` — the DB SELECT has no ORDER BY distance
    // (PostgREST can't sort by Haversine without an RPC), so sorting/slicing by
    // distance happens after fetching all candidates in the box. CANDIDATE_FETCH_CAP
    // is just a safety ceiling against a pathologically dense cache, not a proximity cut.
    const CANDIDATE_FETCH_CAP = 150;

    // Sem filtro de query aqui de propósito: a decisão de cobertura (e o cache
    // que ela protege) é sobre o AMBIENTE inteiro do box, nunca sobre o
    // subconjunto que casa um nome — senão uma busca por nome com poucos
    // matches dispararia miss falso e chamaria o provider sem necessidade.
    const fetchCuratedCandidates = async (boxRadiusMeters: number) => {
      const latDelta = boxRadiusMeters / 111000;
      const lngDelta = boxRadiusMeters / (111000 * Math.cos(latitude * Math.PI / 180));

      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("ativo", true)
        .eq("is_temporary", false)
        .gte("latitude", latitude - latDelta)
        .lte("latitude", latitude + latDelta)
        .gte("longitude", longitude - lngDelta)
        .lte("longitude", longitude + lngDelta)
        .limit(CANDIDATE_FETCH_CAP);

      if (error) {
        console.error("[search-places] ❌ DB error:", error);
        throw error;
      }

      return data || [];
    };

    let curatedCandidates = await fetchCuratedCandidates(radius);

    // HIT: o box já tem cobertura mínima E foi preenchido recentemente — o
    // sinal é o atualizado_em MAIS RECENTE entre os candidatos, não o mais
    // antigo, porque uma única linha velha não deve forçar re-fetch de uma
    // área bem coberta.
    const mostRecentUpdate = curatedCandidates.reduce<string | null>(
      (latest, place) => (!latest || place.atualizado_em > latest ? place.atualizado_em : latest),
      null
    );
    const ttlCutoffMs = Date.now() - COVERAGE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const isCacheHit =
      curatedCandidates.length >= COVERAGE_MIN_PLACES &&
      mostRecentUpdate !== null &&
      new Date(mostRecentUpdate).getTime() >= ttlCutoffMs;

    let source = "cache";

    if (isCacheHit) {
      console.log(`[search-places] ✅ Cache hit: ${curatedCandidates.length} candidatos, mais recente=${mostRecentUpdate}`);
    } else {
      console.log(`[search-places] 🔄 Cache miss: ${curatedCandidates.length} candidatos (min=${COVERAGE_MIN_PLACES}), mais recente=${mostRecentUpdate ?? "—"} — chamando provider=${provider.name}`);

      let standardPlaces: StandardPlace[] = [];
      let providerSuccess = false;

      try {
        standardPlaces = await provider.search({ latitude, longitude, radius, limit, query });
        providerSuccess = true;
      } catch (apiError) {
        console.error(`[search-places] ⚠️ Provider ${provider.name} failed:`, apiError);
        // For providers that aren't implemented (e.g. Mapbox), return 501
        if ((apiError as Error).message?.includes("not implemented")) {
          return new Response(
            JSON.stringify({ error: "Mapbox provider not implemented yet" }),
            { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Persist places to database
      if (providerSuccess && standardPlaces.length > 0) {
        let persistedCount = 0;

        const upsertPromises = standardPlaces.map(async (place) => {
          if (!place.provider_id) {
            console.warn(`[search-places] ⚠️ Missing provider_id:`, place.name);
            return null;
          }

          const placeData = {
            provider: provider.name,
            provider_id: place.provider_id,
            nome: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            endereco: place.address,
            cidade: place.city,
            estado: place.state,
            pais: place.country,
            categoria: place.category,
            dados_brutos: place.raw_data,
            ativo: true,
            origem: "api",
            atualizado_em: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("places")
            .upsert(placeData, { onConflict: "provider,provider_id" });

          if (error) {
            console.error(`[search-places] ⚠️ Upsert error ${place.provider_id}:`, error.message);
          } else {
            persistedCount++;
          }
          return placeData;
        });

        await Promise.all(upsertPromises);
        console.log(`[search-places] 💾 Persisted ${persistedCount}/${standardPlaces.length} places`);
      }

      curatedCandidates = await fetchCuratedCandidates(radius);
      source = providerSuccess ? provider.name : "cache";
    }

    // O query só filtra a lista final de exibição — nunca a decisão de
    // cobertura acima (ver comentário em fetchCuratedCandidates).
    // TODO (Etapa 7): este filtro por nome é provisório; será redesenhado
    // via autocomplete.
    if (query && query.trim()) {
      const needle = query.trim().toLowerCase();
      console.log(`[search-places] 🔤 Filtering by name: "${query.trim()}"`);
      curatedCandidates = curatedCandidates.filter(place => place.nome?.toLowerCase().includes(needle));
    }

    const placesWithDistance = curatedCandidates
      .map(place => {
        const R = 6371000;
        const dLat = (place.latitude - latitude) * Math.PI / 180;
        const dLon = (place.longitude - longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(latitude * Math.PI / 180) * Math.cos(place.latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return { ...place, distance_meters: Math.round(R * c) };
      })
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, limit);

    // active_users count only runs for the final, already-trimmed list.
    const placesWithActiveUsers = await Promise.all(
      placesWithDistance.map(async (place) => {
        const { count } = await supabase
          .from("presence")
          .select("*", { count: "exact", head: true })
          .eq("place_id", place.id)
          .eq("ativo", true);

        return { ...place, active_users: count || 0 };
      })
    );

    // Display order only — selection above is already final (by distance).
    // More Katuu users first; ties broken by proximity.
    placesWithActiveUsers.sort((a, b) =>
      b.active_users - a.active_users || a.distance_meters - b.distance_meters
    );

    console.log(`[search-places] 📤 Returning ${placesWithActiveUsers.length} places (${curatedCandidates.length} curated candidates)`);

    return new Response(
      JSON.stringify({
        places: placesWithActiveUsers,
        source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[search-places] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
