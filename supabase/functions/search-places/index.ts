import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  categories_raw: { id?: string; fsq_category_id?: string; name: string }[];
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
// CURADORIA DE CATEGORIAS KATUU - BASEADA EXCLUSIVAMENTE EM fsq_category_id
// =============================================================================

const ALLOWED_CATEGORY_IDS = new Set([
  // ===== NIGHTLIFE =====
  "4d4b7105d754a06376d81259", "4bf58dd8d48988d116941735", "52e81612bcbc57f1066b7a0d",
  "4bf58dd8d48988d117941735", "50327c8591d4c4b30a586d5d", "52e81612bcbc57f1066b7a0e",
  "4bf58dd8d48988d11e941735", "4bf58dd8d48988d118941735", "4bf58dd8d48988d119941735",
  "4bf58dd8d48988d1d5941735", "4bf58dd8d48988d120941735", "4bf58dd8d48988d121941735",
  "4bf58dd8d48988d11f941735", "4bf58dd8d48988d11a941735", "4bf58dd8d48988d11b941735",
  "4bf58dd8d48988d11c941735", "4bf58dd8d48988d1d4941735", "4bf58dd8d48988d11d941735",
  "4bf58dd8d48988d122941735", "4bf58dd8d48988d123941735", "4bf58dd8d48988d1e8931735",
  "4bf58dd8d48988d1e3931735", "4bf58dd8d48988d1ea941735",
  // ===== DINING =====
  "4bf58dd8d48988d1c4941735", "503288ae91d4c4b30a586d67", "4bf58dd8d48988d1c8941735",
  "4bf58dd8d48988d14e941735", "4bf58dd8d48988d152941735", "4bf58dd8d48988d107941735",
  "4bf58dd8d48988d142941735", "4bf58dd8d48988d169941735", "52e81612bcbc57f1066b7a01",
  "4bf58dd8d48988d1df931735", "52e81612bcbc57f1066b79f1", "4bf58dd8d48988d16b941735",
  "52939a643cf9994f4e043a33", "4bf58dd8d48988d143941735", "52e81612bcbc57f1066b79f4",
  "4bf58dd8d48988d16c941735", "4bf58dd8d48988d17a941735", "4bf58dd8d48988d144941735",
  "4bf58dd8d48988d145941735", "4bf58dd8d48988d154941735", "52f2ae52bcbc57f1066b8b81",
  "4bf58dd8d48988d1f5931735", "4bf58dd8d48988d147941735", "4e0e22f5a56208c4ea9a85a0",
  "4bf58dd8d48988d10a941735", "4eb1bd1c3b7b55596b4a748f", "52e81612bcbc57f1066b7a09",
  "4bf58dd8d48988d10c941735", "4bf58dd8d48988d155941735", "4bf58dd8d48988d10d941735",
  "4bf58dd8d48988d10e941735", "52e81612bcbc57f1066b79fe", "4bf58dd8d48988d10f941735",
  "4deefc054765f83613cdba6f", "52e81612bcbc57f1066b7a06", "4bf58dd8d48988d110941735",
  "4bf58dd8d48988d111941735", "4bf58dd8d48988d113941735", "4bf58dd8d48988d1be941735",
  "4bf58dd8d48988d156941735", "4bf58dd8d48988d1c0941735", "4bf58dd8d48988d1c1941735",
  "4bf58dd8d48988d115941735", "52e81612bcbc57f1066b79f9", "4bf58dd8d48988d1c2941735",
  "4eb1d5724b900d56c88a45fe", "4bf58dd8d48988d1c3941735", "4bf58dd8d48988d157941735",
  "52e81612bcbc57f1066b79f8", "4eb1bfa43b7b52c0e1adc2e8", "4bf58dd8d48988d1ca941735",
  "52e81612bcbc57f1066b7a04", "4def73e84765ae376e57713a", "5293a7563cf9994f4e043a44",
  "4bf58dd8d48988d1c6941735", "4bf58dd8d48988d1ce941735", "4bf58dd8d48988d14f941735",
  "4bf58dd8d48988d1cd941735", "4bf58dd8d48988d150941735", "4bf58dd8d48988d1cc941735",
  "4bf58dd8d48988d1d2941735", "4bf58dd8d48988d158941735", "4bf58dd8d48988d1db931735",
  "4bf58dd8d48988d1dc931735", "4bf58dd8d48988d149941735", "52af39fb3cf9994f4e043be9",
  "4f04af1f2fb6e1c99f3db0bb", "52e928d0bcbc57f1066b7e96", "4bf58dd8d48988d14a941735",
  "4bf58dd8d48988d14b941735", "4bf58dd8d48988d1d1941735", "52af0bd33cf9994f4e043bdd",
  // ===== CAFÉS & COFFEE =====
  "4bf58dd8d48988d1e0931735", "4bf58dd8d48988d16d941735", "52e81612bcbc57f1066b7a0c",
  // ===== ARTS & ENTERTAINMENT =====
  "4d4b7104d754a06370d81259", "4fceea171983d5d06c3e9823", "4bf58dd8d48988d1e1931735",
  "4bf58dd8d48988d1e2931735", "4bf58dd8d48988d1e4931735", "4bf58dd8d48988d17c941735",
  "52e81612bcbc57f1066b79e7", "4bf58dd8d48988d18e941735", "5032792091d4c4b30a586d5c",
  "52e81612bcbc57f1066b79ef", "4bf58dd8d48988d1f1931735", "52e81612bcbc57f1066b79ea",
  "52e81612bcbc57f1066b7a11", "52e81612bcbc57f1066b79eb", "4bf58dd8d48988d17f941735",
  "4bf58dd8d48988d17e941735", "4bf58dd8d48988d180941735", "4bf58dd8d48988d181941735",
  "4bf58dd8d48988d18f941735", "4bf58dd8d48988d190941735", "4bf58dd8d48988d192941735",
  "4bf58dd8d48988d191941735", "4bf58dd8d48988d1e5931735", "4bf58dd8d48988d1e7931735",
  "4bf58dd8d48988d1e9931735", "4bf58dd8d48988d1f2931735", "4bf58dd8d48988d136941735",
  "4bf58dd8d48988d137941735", "4bf58dd8d48988d1f4931735", "52e81612bcbc57f1066b79e9",
  "52e81612bcbc57f1066b79ec", "4bf58dd8d48988d184941735", "4bf58dd8d48988d18c941735",
  "4bf58dd8d48988d18b941735", "4bf58dd8d48988d189941735", "4bf58dd8d48988d185941735",
  "4bf58dd8d48988d188941735", "4bf58dd8d48988d182941735", "5109983191d435c0d71c2bb1",
  "4bf58dd8d48988d193941735", "4bf58dd8d48988d17b941735",
  // ===== EVENTS =====
  "4d4b7105d754a06373d81259", "5267e4d9e4b0ec79466e48c6", "5267e4d9e4b0ec79466e48c9",
  "5267e4d9e4b0ec79466e48c7", "5267e4d9e4b0ec79466e48d1", "5267e4d9e4b0ec79466e48c8",
  "52741d85e4b0d5d1e3c6a6d9", "52f2ab2ebcbc57f1066b8b54", "5267e4d8e4b0ec79466e48c5",
  // ===== OUTDOORS & RECREATION =====
  "4d4b7105d754a06377d81259", "4f4528bc4b90abdf24c9de85", "4bf58dd8d48988d1e8941735",
  "4bf58dd8d48988d1e6941735", "4bf58dd8d48988d167941735", "4bf58dd8d48988d168941735",
  "4cce455aebf7b749d5e191f5", "4e39a956bd410d7aed40cbc3", "4eb1bf013b7b6f98df247e07",
  "52e81612bcbc57f1066b7a22", "4bf58dd8d48988d1e5941735", "4bf58dd8d48988d15a941735",
  "4bf58dd8d48988d1e0941735", "4bf58dd8d48988d160941735", "50aaa4314b90af0d42d5de10",
  "4bf58dd8d48988d161941735", "4bf58dd8d48988d15d941735", "4eb1d4d54b900d56c88a45fc",
  "52e81612bcbc57f1066b7a21", "52e81612bcbc57f1066b7a13", "4bf58dd8d48988d163941735",
  "52e81612bcbc57f1066b7a25", "4bf58dd8d48988d1e7941735", "4bf58dd8d48988d164941735",
  "4bf58dd8d48988d15e941735", "52e81612bcbc57f1066b7a26", "4eb1d4dd4b900d56c88a45fd",
  "50328a4b91d4c4b30a586d6b", "4bf58dd8d48988d165941735", "4bf58dd8d48988d166941735",
  "4bf58dd8d48988d1e9941735", "4eb1c0ed3b7b52c0e1adc2ea", "4bf58dd8d48988d1ec941735",
  "4bf58dd8d48988d1eb941735", "4bf58dd8d48988d1de941735", "52e81612bcbc57f1066b7a10",
  "50aaa49e4b90af0d42d5de11",
  // ===== COLLEGE & UNIVERSITY =====
  "4d4b7105d754a06372d81259", "4bf58dd8d48988d198941735", "4bf58dd8d48988d199941735",
  "4bf58dd8d48988d19a941735", "4bf58dd8d48988d19e941735", "4bf58dd8d48988d197941735",
  "4bf58dd8d48988d1af941735", "4bf58dd8d48988d1b1941735", "4bf58dd8d48988d1a1941735",
  "4bf58dd8d48988d1b2941735", "4bf58dd8d48988d1aa941735", "4bf58dd8d48988d1a9941735",
  "4bf58dd8d48988d1b4941735", "4bf58dd8d48988d1ac941735", "4bf58dd8d48988d1a2941735",
  "4bf58dd8d48988d1b0941735", "4bf58dd8d48988d1a8941735", "4bf58dd8d48988d141941735",
  "4bf58dd8d48988d1ab941735", "4bf58dd8d48988d1ae941735",
  // ===== SHOPPING MALLS =====
  "4bf58dd8d48988d1fd941735", "52e816a6bcbc57f1066b7a54",
  // ===== COWORKING & WORKSPACES =====
  "4bf58dd8d48988d174941735",
  // ===== SOCIAL CLUBS & COMMUNITY =====
  "52e81612bcbc57f1066b7a33", "52e81612bcbc57f1066b7a34", "52e81612bcbc57f1066b7a32",
  "4bf58dd8d48988d171941735", "4bf58dd8d48988d1ff931735",
]);

const EXCLUDED_CATEGORY_IDS = new Set([
  // ===== HEALTH & MEDICAL =====
  "4bf58dd8d48988d104941735", "52e81612bcbc57f1066b7a3b", "52e81612bcbc57f1066b7a3c",
  "52e81612bcbc57f1066b7a3a", "4bf58dd8d48988d178941735", "4bf58dd8d48988d177941735",
  "4bf58dd8d48988d194941735", "522e32fae4b09b556e370f19", "4bf58dd8d48988d196941735",
  "4f4531b14b9074f6e4fb0103", "52e81612bcbc57f1066b7a39", "4d954af4a243a5684765b473",
  // ===== PHARMACY =====
  "4bf58dd8d48988d10f951735",
  // ===== FAST FOOD & QUICK SERVICE =====
  "4bf58dd8d48988d16e941735", "4bf58dd8d48988d16f941735", "4bf58dd8d48988d1c9941735",
  "4bf58dd8d48988d112941735", "52f2ab2ebcbc57f1066b8b41", "4bf58dd8d48988d179941735",
  "4bf58dd8d48988d16a941735", "4bf58dd8d48988d117951735", "4bf58dd8d48988d1bc941735",
  "4bf58dd8d48988d1d0941735", "4bf58dd8d48988d148941735", "4bf58dd8d48988d108941735",
  "4bf58dd8d48988d10b941735", "4bf58dd8d48988d1cb941735", "4d4ae6fc7a7b7dea34424761",
  "512e7cae91d4cbb4e5efe0af", "4bf58dd8d48988d1bd941735", "4bf58dd8d48988d1c5941735",
  "4bf58dd8d48988d1c7941735", "4bf58dd8d48988d1dd931735", "4bf58dd8d48988d14c941735",
  "4bf58dd8d48988d151941735", "4bf58dd8d48988d153941735",
  // ===== RETAIL & STORES =====
  "4d4b7105d754a06378d81259", "4bf58dd8d48988d116951735", "4bf58dd8d48988d127951735",
  "4bf58dd8d48988d124951735", "4bf58dd8d48988d10a951735", "52f2ab2ebcbc57f1066b8b56",
  "52f2ab2ebcbc57f1066b8b42", "4bf58dd8d48988d115951735", "4bf58dd8d48988d114951735",
  "4bf58dd8d48988d103951735", "4d954b0ea243a5684a65b473", "4bf58dd8d48988d10c951735",
  "4bf58dd8d48988d1f6941735", "4bf58dd8d48988d122951735", "4bf58dd8d48988d1f7941735",
  "4bf58dd8d48988d11b951735", "4bf58dd8d48988d1f9941735", "4bf58dd8d48988d1fa941735",
  "4bf58dd8d48988d113951735", "4bf58dd8d48988d128951735", "4bf58dd8d48988d118951735",
  "4bf58dd8d48988d112951735", "4bf58dd8d48988d1fb941735", "4bf58dd8d48988d111951735",
  "52f2ab2ebcbc57f1066b8b33", "4bf58dd8d48988d1fc941735", "4bf58dd8d48988d186941735",
  "52f2ab2ebcbc57f1066b8b3c", "4bf58dd8d48988d1ff941735", "4f04afc02fb6e1c99f3db0bc",
  "4bf58dd8d48988d1fe941735", "4f04aa0c2fb6e1c99f3db0b8", "4d954afda243a5684865b473",
  "4bf58dd8d48988d100951735", "4bf58dd8d48988d0d951735", "4bf58dd8d48988d110951735",
  "4bf58dd8d48988d123951735", "4bf58dd8d48988d1ed941735", "4bf58dd8d48988d1f2941735",
  "52f2ab2ebcbc57f1066b8b46", "4bf58dd8d48988d1f3941735",
  // ===== GROCERY & FOOD RETAIL =====
  "4bf58dd8d48988d11d951735", "4bf58dd8d48988d11e951735", "4bf58dd8d48988d10e951735",
  // ===== GOVERNMENT =====
  "4bf58dd8d48988d126941735", "4bf58dd8d48988d12a941735", "4bf58dd8d48988d129941735",
  "4bf58dd8d48988d12b941735", "4bf58dd8d48988d12c951735", "4bf58dd8d48988d12c941735",
  "4bf58dd8d48988d12e941735", "52e81612bcbc57f1066b7a38", "4e52adeebd41615f56317744",
  "4bf58dd8d48988d172941735",
  // ===== RELIGION =====
  "4bf58dd8d48988d131941735", "52e81612bcbc57f1066b7a3e", "4bf58dd8d48988d132941735",
  "52e81612bcbc57f1066b7a3f", "4bf58dd8d48988d138941735", "4eb1d80a4b900d56c88a45ff",
  "4bf58dd8d48988d139941735", "4bf58dd8d48988d13a941735",
  // ===== SCHOOLS =====
  "4bf58dd8d48988d13b941735", "4f4533804b9074f6e4fb0105", "4bf58dd8d48988d13d941735",
  "4f4533814b9074f6e4fb0106", "4f4533814b9074f6e4fb0107", "52e81612bcbc57f1066b7a45",
  "52e81612bcbc57f1066b7a46", "52e81612bcbc57f1066b7a42",
  // ===== RESIDENTIAL =====
  "4e67e38e036454776db1fb3a", "5032891291d4c4b30a586d68", "4bf58dd8d48988d103941735",
  "4f2a210c4b9023bd5841ed28", "4d954b06a243a5684965b473", "52f2ab2ebcbc57f1066b8b55",
  // ===== TRANSPORT =====
  "4d4b7105d754a06379d81259", "4bf58dd8d48988d1ed931735", "4bf58dd8d48988d1ef931735",
  "4bf58dd8d48988d1f0931735", "4eb1bc533b7b2c5b1d4306cb", "4bf58dd8d48988d1eb931735",
  "4e4c9077bd41f78e849722f9", "4bf58dd8d48988d12d951735", "52f2ab2ebcbc57f1066b8b4b",
  "4bf58dd8d48988d1fe931735", "4bf58dd8d48988d12b951735", "52f2ab2ebcbc57f1066b8b4f",
  "52f2ab2ebcbc57f1066b8b50", "4bf58dd8d48988d1f6931735", "4bf58dd8d48988d1fa931735",
  "4bf58dd8d48988d1f8931735", "4bf58dd8d48988d1ee931735", "4bf58dd8d48988d1fb931735",
  "4bf58dd8d48988d12f951735", "4bf58dd8d48988d1fc931735", "4f2a23984b9023bd5841ed2c",
  "4e74f6cabd41c4836eac4c31", "4bf58dd8d48988d1ef941735", "4d954b16a243a5684b65b473",
  "4bf58dd8d48988d1f9931735", "52f2ab2ebcbc57f1066b8b52", "4bf58dd8d48988d1fd931735",
  "4bf58dd8d48988d130951735", "52f2ab2ebcbc57f1066b8b4d", "52f2ab2ebcbc57f1066b8b4e",
  "4bf58dd8d48988d129951735", "52f2ab2ebcbc57f1066b8b51",
  // ===== AUTOMOTIVE =====
  "4eb1c1623b7b52c0e1adc2ec", "4f04ae1f2fb6e1c99f3db0ba", "52f2ab2ebcbc57f1066b8b44",
  // ===== PROFESSIONAL SERVICES =====
  "4bf58dd8d48988d124941735", "52e81612bcbc57f1066b7a3d", "4bf58dd8d48988d130941735",
  "4eb1bea83b7b6f98df247e06", "4f4534884b9074f6e4fb0174", "52f2ab2ebcbc57f1066b8b3f",
  "4bf58dd8d48988d12f941735", "50328a8e91d4c4b30a586d6c", "4c38df4de52ce0d596b336e1",
  "5310b8e5bcbc57f1066bcbf1", "5032856091d4c4b30a586d63", "5032885091d4c4b30a586d66",
  "52f2ab2ebcbc57f1066b8b37", "4f4531084b9074f6e4fb0101", "4f04b1572fb6e1c99f3db0bf",
  "52e81612bcbc57f1066b7a36", "52e81612bcbc57f1066b7a31",
  // ===== GEOGRAPHIC =====
  "4bf58dd8d48988d15c941735", "4deefb944765f83613cdba6e", "4bf58dd8d48988d159941735",
  "4bf58dd8d48988d1e4941735", "52e81612bcbc57f1066b7a23", "4bf58dd8d48988d1df941735",
  // ===== NEIGHBORHOODS & STATES =====
  "530e33ccbcbc57f1066bbfe4", "50aa9e094b90af0d42d5de0d", "5345731ebcbc57f1066c39b2",
  "530e33ccbcbc57f1066bbff7", "4f2a25ac4b909258e854f55f", "530e33ccbcbc57f1066bbff8",
  "530e33ccbcbc57f1066bbff3", "530e33ccbcbc57f1066bbff9",
  // ===== FITNESS =====
  "4bf58dd8d48988d175941735", "52f2ab2ebcbc57f1066b8b47", "503289d391d4c4b30a586d6a",
  "4bf58dd8d48988d176941735", "4bf58dd8d48988d101941735", "4bf58dd8d48988d102941735",
]);

// =============================================================================
// FOURSQUARE PROVIDER
// =============================================================================

interface FoursquareCategory {
  id?: string;
  fsq_category_id?: string;
  name: string;
  short_name?: string;
}

interface FoursquarePlace {
  fsq_id?: string;
  fsq_place_id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  geocodes?: {
    main: { latitude: number; longitude: number };
  };
  location: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    postcode?: string;
    formatted_address?: string;
  };
  categories: FoursquareCategory[];
  distance?: number;
}

function getCategoryIds(place: FoursquarePlace): string[] {
  if (!place.categories || place.categories.length === 0) return [];
  return place.categories.map(cat => cat.id || cat.fsq_category_id).filter(Boolean) as string[];
}

function shouldIncludePlace(place: FoursquarePlace): boolean {
  const categoryIds = getCategoryIds(place);
  if (categoryIds.length === 0) return false;
  for (const id of categoryIds) {
    if (EXCLUDED_CATEGORY_IDS.has(id)) return false;
  }
  for (const id of categoryIds) {
    if (ALLOWED_CATEGORY_IDS.has(id)) return true;
  }
  return false;
}

class FoursquareProvider implements PlaceProvider {
  name = "foursquare";

  async search(params: SearchParams): Promise<StandardPlace[]> {
    const apiKey = Deno.env.get("FOURSQUARE_API_KEY");
    if (!apiKey) {
      throw new Error("FOURSQUARE_API_KEY not configured");
    }

    const { latitude, longitude, radius = 100, limit = 20, query } = params;

    const fsqUrl = new URL("https://places-api.foursquare.com/places/search");
    fsqUrl.searchParams.set("ll", `${latitude},${longitude}`);
    fsqUrl.searchParams.set("radius", String(radius));
    fsqUrl.searchParams.set("limit", String(Math.min(limit * 3, 50)));
    fsqUrl.searchParams.set("sort", "distance");
    if (query) fsqUrl.searchParams.set("query", query);

    console.log(`[search-places] 🔍 Calling Foursquare API`);

    const fsqResponse = await fetch(fsqUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });

    console.log(`[search-places] 📡 Foursquare response: ${fsqResponse.status}`);

    if (!fsqResponse.ok) {
      const errorText = await fsqResponse.text();
      console.error(`[search-places] ❌ Foursquare error: ${fsqResponse.status} - ${errorText}`);
      return [];
    }

    const fsqData = await fsqResponse.json();
    const rawPlaces: FoursquarePlace[] = fsqData.results || [];

    // Apply category curadoria
    const filtered = rawPlaces.filter(shouldIncludePlace);
    console.log(`[search-places] ✅ Foursquare: ${rawPlaces.length} raw → ${filtered.length} after curadoria`);

    // Log filtered out places
    const excluded = rawPlaces.filter(p => !shouldIncludePlace(p));
    if (excluded.length > 0) {
      console.log(`[search-places] 🚫 Filtered: ${excluded.slice(0, 5).map(p =>
        `${p.name} [${getCategoryIds(p).join(',')}]`
      ).join(', ')}${excluded.length > 5 ? ` +${excluded.length - 5} more` : ''}`);
    }

    // Map to standard format
    return filtered.map(place => ({
      provider_id: place.fsq_id || place.fsq_place_id || "",
      name: place.name,
      latitude: place.latitude || place.geocodes?.main?.latitude || 0,
      longitude: place.longitude || place.geocodes?.main?.longitude || 0,
      address: place.location?.address || null,
      city: place.location?.locality || null,
      state: place.location?.region || null,
      country: place.location?.country || null,
      category: place.categories?.[0]?.name || null,
      categories_raw: place.categories || [],
      raw_data: place as unknown as Record<string, unknown>,
    }));
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
  const providerName = (Deno.env.get("PLACE_PROVIDER") || "foursquare").toLowerCase();
  switch (providerName) {
    case "mapbox":
      return new MapboxProvider();
    case "foursquare":
    default:
      return new FoursquareProvider();
  }
}

// =============================================================================
// DB FILTERING (for cached places)
// =============================================================================

function shouldIncludePlaceFromDb(place: any): boolean {
  const rawData = place.dados_brutos as FoursquarePlace | null;
  if (rawData && rawData.categories && rawData.categories.length > 0) {
    return shouldIncludePlace(rawData);
  }
  return false;
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

    let standardPlaces: StandardPlace[] = [];
    let providerSuccess = false;

    try {
      standardPlaces = await provider.search({ latitude, longitude, radius, limit, query });
      providerSuccess = true;
    } catch (apiError) {
      console.error(`[search-places] ⚠️ Provider ${provider.name} failed:`, apiError);
      // For non-foursquare providers that aren't implemented, return 501
      if (provider.name !== "foursquare" && (apiError as Error).message?.includes("not implemented")) {
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

    // Return places from database with distance and active user count
    const latDelta = (radius * 2) / 111000;
    const lngDelta = (radius * 2) / (111000 * Math.cos(latitude * Math.PI / 180));

    let dbQuery = supabase
      .from("places")
      .select("*")
      .eq("ativo", true)
      .eq("is_temporary", false)
      .gte("latitude", latitude - latDelta)
      .lte("latitude", latitude + latDelta)
      .gte("longitude", longitude - lngDelta)
      .lte("longitude", longitude + lngDelta);

    if (query && query.trim()) {
      dbQuery = dbQuery.ilike("nome", `%${query.trim()}%`);
      console.log(`[search-places] 🔤 Filtering DB by name: "${query.trim()}"`);
    }

    const { data: dbPlaces, error: dbError } = await dbQuery.limit(limit * 2);

    if (dbError) {
      console.error("[search-places] ❌ DB error:", dbError);
      throw dbError;
    }

    const filteredDbPlaces = (dbPlaces || []).filter(place => shouldIncludePlaceFromDb(place));

    const placesWithDistancePromises = filteredDbPlaces.map(async (place) => {
      const R = 6371000;
      const dLat = (place.latitude - latitude) * Math.PI / 180;
      const dLon = (place.longitude - longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(latitude * Math.PI / 180) * Math.cos(place.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      const { count } = await supabase
        .from("presence")
        .select("*", { count: "exact", head: true })
        .eq("place_id", place.id)
        .eq("ativo", true);

      return {
        ...place,
        distance_meters: Math.round(distance),
        active_users: count || 0,
      };
    });

    const placesWithDistance = (await Promise.all(placesWithDistancePromises))
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, limit);

    console.log(`[search-places] 📤 Returning ${placesWithDistance.length} places (from ${dbPlaces?.length || 0} in DB, ${filteredDbPlaces.length} after curadoria)`);

    return new Response(
      JSON.stringify({
        places: placesWithDistance,
        source: providerSuccess ? provider.name : "cache",
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
