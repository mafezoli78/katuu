import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Users, Loader2, MapPin, RefreshCw, X } from 'lucide-react';
import { calculateAge } from '@/utils/date';
import { getSignedSelfieUrls } from '@/lib/storage';
import { useValidatePlaceDistance } from '@/hooks/useValidatePlaceDistance';

const FEED_REFRESH_INTERVAL_MS = 20 * 1000;

interface ExploreCard {
  user_id: string;
  nome: string;
  checkin_selfie_url: string | null;
  gender: string | null;
  data_nascimento: string | null;
  mutual_interests: string[];
  mutual_count: number;
}

function genderLabel(gender: string | null): string | null {
  if (!gender) return null;
  if (gender === 'man') return 'Homem';
  if (gender === 'woman') return 'Mulher';
  if (gender === 'non_binary') return 'Não-binário';
  return 'Outro';
}

export default function Explore() {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();

  const [placeName, setPlaceName] = useState<string | null>(null);
  const [cards, setCards] = useState<ExploreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ExploreCard | null>(null);
  const { validating, validateAndProceed } = useValidatePlaceDistance();

  const mountedRef = useRef(true);
  const placeCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const placeCategoryRef = useRef<{ categoria: string | null; isTemporary: boolean } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Dados do local (nome + coords + categoria para validar o raio no "Entrar")
  useEffect(() => {
    if (!placeId) return;
    supabase
      .from('places')
      .select('nome, latitude, longitude, categoria, is_temporary')
      .eq('id', placeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mountedRef.current || !data) return;
        setPlaceName(data.nome);
        placeCoordsRef.current = { latitude: data.latitude, longitude: data.longitude };
        placeCategoryRef.current = { categoria: data.categoria, isTemporary: data.is_temporary };
      });
  }, [placeId]);

  const fetchFeed = useCallback(async () => {
    if (!placeId) return;
    try {
      const { data, error } = await supabase.rpc('get_place_explore_feed' as any, {
        p_place_id: placeId,
      });

      if (!mountedRef.current) return;

      if (error) {
        console.error('[Explore] Error fetching explore feed:', error);
        setCards([]);
        return;
      }

      // Regra do app: sem selfie não há presença. Um card sem selfie seria um
      // bug a montante — omitimos da galeria (o explorador nunca vê quadro
      // quebrado; a linha continua no banco para investigação).
      const rows = ((data || []) as ExploreCard[]).filter(r => !!r.checkin_selfie_url);

      const selfiePaths = rows
        .map(r => r.checkin_selfie_url)
        .filter((p): p is string => !!p && !p.startsWith('http'));
      let signedUrls = new Map<string, string>();
      if (selfiePaths.length > 0) {
        signedUrls = await getSignedSelfieUrls(selfiePaths);
      }

      if (!mountedRef.current) return;

      setCards(rows.map(r => ({
        ...r,
        checkin_selfie_url: r.checkin_selfie_url && signedUrls.has(r.checkin_selfie_url)
          ? signedUrls.get(r.checkin_selfie_url)!
          : r.checkin_selfie_url,
      })));
    } catch (err) {
      console.error('[Explore] Unexpected error fetching explore feed:', err);
      if (mountedRef.current) setCards([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [placeId]);

  // Ciclo de vida da exploração: registra o explorador ao montar e remove a
  // linha ao desmontar (voltar, entrar no local, fechar). A saída é ponto
  // único — o cleanup cobre todos os caminhos. Dependência vazia: a tela
  // sempre monta com o placeId da rota e só se explora um local por vez
  // (sempre via Home), então enter/leave seguem o montar/desmontar real.
  useEffect(() => {
    mountedRef.current = true;

    if (placeId) {
      supabase.rpc('enter_as_explorer' as any, { p_place_id: placeId }).then(({ error }) => {
        // ALREADY_PRESENT: usuário já está presente num local — o backend barra
        // a exploração de propósito; o cliente apenas ignora.
        if (error && error.message !== 'ALREADY_PRESENT') {
          console.error('[Explore] enter_as_explorer:', error);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      supabase.rpc('leave_exploration' as any).then(({ error }) => {
        if (error) console.error('[Explore] leave_exploration:', error);
      });
    };
  }, []);

  // Feed: primeira carga + refresh periódico (também serve de heartbeat no
  // servidor — get_place_explore_feed renova o expires_at da exploração).
  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, FEED_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchFeed();
    setTimeout(() => { if (mountedRef.current) setRefreshing(false); }, 600);
  }, [refreshing, fetchFeed]);

  const handleEnter = () => {
    if (!placeId) return;
    validateAndProceed(placeCoordsRef.current, placeCategoryRef.current, () => {
      navigate('/location', { state: { preSelectedPlaceId: placeId } });
    });
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 page-fade">
        {/* Cabeçalho: voltar + nome do local + atualizar (canto direito) */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold leading-tight flex-1 truncate">{placeName || 'Explorar'}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Entrar */}
        <Button
          onClick={handleEnter}
          disabled={validating}
          className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
        >
          {validating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando localização...</>
          ) : (
            <><MapPin className="h-4 w-4 mr-2" />Entrar</>
          )}
        </Button>

        {/* Explicativo */}
        <p className="text-sm text-muted-foreground">Veja quem já está presente</p>

        {/* Galeria */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-katu-blue" />
          </div>
        ) : cards.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Ninguém aqui ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cards.map((card) => (
              <button
                key={card.user_id}
                onClick={() => setSelected(card)}
                className="block w-full aspect-square rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-katu-blue"
              >
                <img
                  src={card.checkin_selfie_url!}
                  alt={card.nome || ''}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal: foto ampliada + dados (ao tocar numa foto) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-background rounded-2xl overflow-hidden max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selected.checkin_selfie_url!}
                alt={selected.nome || ''}
                className="w-full aspect-square object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60"
                onClick={() => setSelected(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <div className="font-semibold text-lg">{selected.nome}</div>
              {(() => {
                const age = selected.data_nascimento ? calculateAge(selected.data_nascimento) : null;
                const gLabel = genderLabel(selected.gender);
                if (!gLabel && age === null) return null;
                return (
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {gLabel}
                    {gLabel && age !== null && ' • '}
                    {age !== null && age}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
