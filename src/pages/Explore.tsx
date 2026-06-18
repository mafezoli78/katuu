import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Users, Loader2, MapPin } from 'lucide-react';
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

      const rows = (data || []) as ExploreCard[];

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

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, FEED_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const handleEnter = () => {
    if (!placeId) return;
    validateAndProceed(placeCoordsRef.current, placeCategoryRef.current, () => {
      navigate('/location', { state: { preSelectedPlaceId: placeId } });
    });
  };

  const enterButton = (
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
  );

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 page-fade">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold leading-tight">{placeName || 'Explorar'}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {cards.length} {cards.length === 1 ? 'pessoa aqui' : 'pessoas aqui'}
            </p>
          </div>
        </div>

        {enterButton}

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
          <div className="space-y-3">
            {cards.map((card) => {
              const age = card.data_nascimento ? calculateAge(card.data_nascimento) : null;
              const initials = card.nome?.[0]?.toUpperCase() || '?';
              const gLabel = genderLabel(card.gender);

              return (
                <Card key={card.user_id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex h-full">
                      <div className="w-[36%] flex items-center p-2.5">
                        {card.checkin_selfie_url ? (
                          <img
                            src={card.checkin_selfie_url}
                            alt={card.nome || ''}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center font-bold text-xl bg-muted text-muted-foreground rounded-lg">
                            {initials}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-center p-4">
                        <div className="font-semibold text-base">{card.nome}</div>

                        {(gLabel || age !== null) && (
                          <span className="inline-block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1 w-fit">
                            {gLabel}
                            {gLabel && age !== null && ' • '}
                            {age !== null && age}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
