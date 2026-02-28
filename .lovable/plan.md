## Plan: Fix build error + Configure Edge Function secret + Refactor search-places

### 1. Fix build error in `src/hooks/useWaves.ts`

The `Conversation` interface (line 36-47) is missing `reinteracao_permitida_em` and has `encerrado_motivo` typed too narrowly. Add the missing field and align the type with the DB schema:

```typescript
export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  place_id: string;
  origem_wave_id: string | null;
  criado_em: string;
  ativo: boolean;
  encerrado_por: string | null;
  encerrado_em: string | null;
  encerrado_motivo: "manual" | "presence_end" | null;
  reinteracao_permitida_em: string | null;
}
```

### 2. Add Supabase secrets

Use the secrets tool to set:

- `FOURSQUARE_API_KEY` = `4BY3B3MUNVX4GF3GN2UPPCCSBLU3VIPGNPTPPRPD1XXCQAKE`
- `PLACE_PROVIDER` = `foursquare`

### 3. Refactor Edge Function `search-places`

The current function is 799 lines with all Foursquare logic inline. The user wants a provider-based architecture. However, Supabase Edge Functions do not support subdirectories/multiple files per function — all code must be in `index.ts`.

**Approach**: Keep everything in `supabase/functions/search-places/index.ts` but organize the code with clear provider sections:

- Define `PlaceProvider` interface and `StandardPlace` type at the top
- Implement `FoursquareProvider` class (wrapping the existing logic)
- Implement `MapboxProvider` stub class
- Read `PLACE_PROVIDER` env var to select provider
- Keep the existing category filtering, DB persistence, and response format unchanged

The existing curadoria logic (ALLOWED/EXCLUDED category IDs) stays as-is since it's Foursquare-specific. The provider abstraction will handle the API call and mapping to standard format, while filtering remains provider-specific.

### Technical details

- Edge Functions only support a single `index.ts` file — no `providers/` subfolder imports
- The `FOURSQUARE_API_KEY` error will be resolved by adding the secret via Supabase
- The provider pattern uses a factory function reading `PLACE_PROVIDER` env var
- MapboxProvider will return a controlled JSON error:
  return new Response(JSON.stringify({ error: "Mapbox provider not implemented yet" }), { status: 501 });
- Response contract with frontend remains: `{ places: Place[], source: string }`