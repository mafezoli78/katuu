import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { savePendingAction, getPendingAction, clearPendingAction } from '@/utils/pendingAction';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence, NearbyTemporaryPlace } from '@/hooks/usePresence';
import { ProfileGateModal } from '@/components/profile/ProfileGateModal';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, MapPin, ArrowLeft } from 'lucide-react';
import { Place, placesService, PROXIMITY_THRESHOLD_METERS, EXPANDED_SEARCH_RADIUS_METERS } from '@/services/placesService';
import { PlaceSelector } from '@/components/location/PlaceSelector';
import { CheckinSelfie } from '@/components/location/CheckinSelfie';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { logger } from '@/lib/logger';
import { useDeviceLocation } from '@/contexts/LocationContext';

export default function Location() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const navLocation = useLocation();
  const { toast } = useToast();
  const { requestPosition } = useDeviceLocation();
  // Vindo do "Entrar" do Modo Explorar (/explore/:placeId) — pula a etapa de listagem
  const preSelectedPlaceId = (navLocation.state as { preSelectedPlaceId?: string } | null)?.preSelectedPlaceId;

  const {
    intentions,
    nearbyTemporaryPlaces,
    fetchNearbyTemporaryPlaces,
    activatePresenceAtPlace,
    createTemporaryPlace,
    loading,
    presenceRadiusMeters,
    currentPresence,
  } = usePresence();

  const [showProfileGate, setShowProfileGate] = useState(false);
  const { isProfileComplete } = useProfile();
  const [step, setStep] = useState<'permission' | 'detecting' | 'select' | 'create_temp' | 'confirm_temp' | 'expression' | 'selfie'>('detecting');
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'blocked'>('prompt');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Centro do mapa: segue a busca ativa. Setado so em acoes discretas (primeiro
  // fix de GPS, escolher candidato remoto, "usar minha localizacao") — nunca a
  // cada drift do GPS, pra nao arrastar a vista. userCoords segue so-GPS.
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [activating, setActivating] = useState(false);
  const [expressionText, setExpressionText] = useState('');
  const [nearbyTempToConfirm, setNearbyTempToConfirm] = useState<NearbyTemporaryPlace | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [closestPlace, setClosestPlace] = useState<Place | null>(null);
  const [searchingByName, setSearchingByName] = useState(false);

  // Places que o usuário já recusou no card "Você está aqui?" durante esta
  // sessão da tela (A+C). Em ref para o fetchPlaces consultar sem virar
  // dependência. Some ao entrar num local ou sair da tela (componente
  // desmonta); volta a perguntar ao reabrir o app — recusa é efêmera.
  const dismissedClosestRef = useRef<Set<string>>(new Set());

  // Busca remota por endereço/região: a coordenada vem do geocoding, NÃO do GPS.
  // Mantida separada de userCoords para nunca contaminar fluxos que assumem
  // presença física (criar local temporário, ativar presença).
  const [isRemoteSearch, setIsRemoteSearch] = useState(false);
  const [remoteSearchLabel, setRemoteSearchLabel] = useState<string | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [addressCandidates, setAddressCandidates] = useState<{ label: string; lat: number; lon: number }[]>([]);

  const DEFAULT_INTENTION_ID = 'fe9396db-a8d8-4064-a5f5-c1220e6722f1';

  const fetchPlacesRef = useRef<((lat: number, lng: number, opts?: { skipClosest?: boolean }) => Promise<void>) | null>(null);

  const fetchPlaces = useCallback(async (lat: number, lng: number, opts?: { skipClosest?: boolean }) => {
    const skipClosest = opts?.skipClosest ?? false;
    setPlacesLoading(true);
    let failed = false;
    try {
      // Locais temporários assumem presença física — não fazem sentido numa busca remota.
      if (!skipClosest) await fetchNearbyTemporaryPlaces(lat, lng);

      // Foursquare é sempre consultado a 600m numa única ida; a expansão
      // progressiva (300→600) de candidatos por proximidade acontece dentro
      // da Edge search-places, sobre o cache do banco.
      const results = await placesService.searchNearby({ latitude: lat, longitude: lng, radius: EXPANDED_SEARCH_RADIUS_METERS, limit: 20 });

      setPlaces(results);

      // "Você está aqui?" pressupõe presença física — nunca em busca remota.
      // Não reabre para um place que o usuário já recusou nesta sessão.
      if (!skipClosest && results.length > 0 && results[0].distance_meters !== undefined) {
        if (results[0].distance_meters <= PROXIMITY_THRESHOLD_METERS && !dismissedClosestRef.current.has(results[0].id)) {
          setClosestPlace(results[0]);
        } else {
          setClosestPlace(null);
        }
      } else {
        setClosestPlace(null);
      }
    } catch (error) {
      console.error('[Location] Error fetching places, retrying...', error);
      failed = true;
    } finally {
      if (!failed) setPlacesLoading(false);
    }

    // Retry silencioso após 3s
    if (failed) {
      setTimeout(async () => {
        try {
          const results = await placesService.searchNearby({ latitude: lat, longitude: lng, radius: EXPANDED_SEARCH_RADIUS_METERS, limit: 20 });
          setPlaces(results);
          if (!skipClosest && results.length > 0 && results[0].distance_meters !== undefined) {
            if (results[0].distance_meters <= PROXIMITY_THRESHOLD_METERS && !dismissedClosestRef.current.has(results[0].id)) {
              setClosestPlace(results[0]);
            } else {
              setClosestPlace(null);
            }
          } else {
            setClosestPlace(null);
          }
        } catch {
          toast({ variant: 'destructive', title: 'Não foi possível carregar os locais', description: 'Verifique sua conexão e tente novamente.' });
        } finally {
          setPlacesLoading(false);
        }
      }, 3000);
    }
  }, [fetchNearbyTemporaryPlaces, toast]);

  fetchPlacesRef.current = fetchPlaces;

  const hasFetchedRef = useRef(false);
  const pendingRef = useRef(getPendingAction());

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (loading) return;
    if (currentPresence) {
      navigate('/home', { replace: true });
      return;
    }
    if (preSelectedPlaceId) {
      setPermissionChecked(true);
      setSelectedPlaceId(preSelectedPlaceId);
      setStep('expression');
      return;
    }
    if (pendingRef.current) {
      setPermissionChecked(true);
      return;
    }

    // Verifica se usuário já autorizou antes (persistido no localStorage)
    const alreadyGranted = localStorage.getItem('location_permission_granted') === 'true';

    if (alreadyGranted) {
      setPermissionChecked(true);
      setPermissionStatus('granted');
      setStep('detecting');
      handleRequestLocation();
      return;
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionChecked(true);

        if (result.state === 'granted') {
          // Já tem permissão — vai direto
          localStorage.setItem('location_permission_granted', 'true');
          setPermissionStatus('granted');
          setStep('detecting');
          handleRequestLocation();
        } else if (result.state === 'prompt') {
          // Primeira vez — chama popup nativo direto
          setPermissionStatus('prompt');
          setStep('detecting');
          handleRequestLocation();
        } else {
          // Negou antes — mostra tela de bloqueado
          setPermissionStatus('blocked');
          setStep('permission');
        }
      }).catch(() => {
        // Fallback: navegador não suporta permissions.query
        setPermissionChecked(true);
        setStep('detecting');
        handleRequestLocation();
      });
    } else {
      // Dispositivo sem API permissions — tenta direto
      setPermissionChecked(true);
      setStep('detecting');
      handleRequestLocation();
    }
  }, [user, navigate, loading, currentPresence, preSelectedPlaceId]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.type !== 'ACTIVATE_PRESENCE') return;
    pendingRef.current = null;
    clearPendingAction();

    if (pending.placeId) {
      setSelectedPlaceId(pending.placeId);
      if (pending.expressionText) setExpressionText(pending.expressionText);
      if (pending.selfieUrl) {
        // Selfie já foi tirada e enviada — ativa presença diretamente
        handleActivatePresence(pending.selfieUrl, pending.selfieSource || 'camera');
      } else {
        setStep('expression');
        handleRequestLocation();
      }
    }
  }, []);

  const handleRequestLocation = useCallback(() => {
    if (isRequestingPermission || hasFetchedRef.current) return;

    setIsRequestingPermission(true);
    setStep('detecting');

    requestPosition({ maximumAge: 30000 })
      .then((fix) => {
        hasFetchedRef.current = true;
        setIsRequestingPermission(false);
        setPermissionStatus('granted');
        localStorage.setItem('location_permission_granted', 'true');
        const coords = { lat: fix.lat, lng: fix.lng };
        setUserCoords(coords);
        setMapCenter(prev => prev ?? coords);
        fetchPlacesRef.current?.(coords.lat, coords.lng);
        if (!pendingRef.current) setStep('select');
      })
      .catch((error) => {
        setIsRequestingPermission(false);

        if (error instanceof Error && error.message === 'GEOLOCATION_UNSUPPORTED') {
          setPermissionStatus('blocked');
          toast({ variant: 'destructive', title: 'Geolocalização não suportada' });
          return;
        }

        if (error.code === error.PERMISSION_DENIED) {
          if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
              setPermissionStatus(result.state === 'denied' ? 'blocked' : 'denied');
            }).catch(() => setPermissionStatus('denied'));
          } else {
            setPermissionStatus('denied');
          }
        }
        setStep('permission');
      });
  }, [isRequestingPermission, toast, requestPosition]);



  // Corrige o retorno do background/hibernação
  useEffect(() => {
    let wasVisible = true;

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';

      // Só age quando volta de invisível para visível
      if (isVisible && !wasVisible) {
        // Reseta os bloqueios e refaz a detecção
        hasFetchedRef.current = false;
        setIsRequestingPermission(false);

        if (permissionStatus === 'granted') {
          setStep('detecting');
          setTimeout(() => handleRequestLocation(), 300);
        }
      }

      wasVisible = isVisible;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [permissionStatus, handleRequestLocation]);

  const handleSelectPlace = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setStep('expression');
  };

  // "Não" no card "Você está aqui?": registra a recusa (para não reabrir ao
  // voltar do background) e some com o card mostrando a lista.
  const handleDismissClosest = useCallback(() => {
    if (closestPlace) dismissedClosestRef.current.add(closestPlace.id);
    setClosestPlace(null);
  }, [closestPlace]);

  const handleSearchByName = async (query: string) => {
    if (!userCoords) return;
    setSearchingByName(true);
    try {
      const results = await placesService.searchByName({ latitude: userCoords.lat, longitude: userCoords.lng, query, limit: 20 });
      setPlaces(results);
      setClosestPlace(null);
    } catch {
      toast({ variant: 'destructive', title: 'Erro na busca', description: 'Tente novamente' });
    } finally {
      setSearchingByName(false);
    }
  };

  // Busca remota: converte texto de endereço/região em candidatos via Edge
  // geocode-autocomplete (Geoapify) e exibe a lista para o usuário escolher —
  // sem geocodar de novo ao tocar no candidato. O usuário não está fisicamente
  // lá, então isRemoteSearch trava o fluxo de "Entrar" na UI.
  const handleSearchByAddress = async (addressText: string) => {
    const trimmed = addressText.trim();
    if (trimmed.length < 3) return;

    setGeocodingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-autocomplete', {
        body: { text: trimmed },
      });

      if (error) {
        logger.error('[Location] geocode-autocomplete invoke error', error);
        toast({ variant: 'destructive', title: 'Não foi possível buscar esse endereço', description: 'Tente novamente.' });
        return;
      }

      const results = data?.results ?? [];
      if (results.length === 0) {
        toast({ variant: 'destructive', title: 'Endereço não encontrado', description: 'Tente algo mais específico, como rua e bairro.' });
        return;
      }

      setAddressCandidates(results);
    } catch (error) {
      logger.error('[Location] Geocoding error', error);
      toast({ variant: 'destructive', title: 'Não foi possível buscar esse endereço', description: 'Tente novamente.' });
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleSelectCandidate = async (candidate: { label: string; lat: number; lon: number }) => {
    setIsRemoteSearch(true);
    setRemoteSearchLabel(candidate.label);
    setMapCenter({ lat: candidate.lat, lng: candidate.lon });
    setAddressCandidates([]);
    await fetchPlaces(candidate.lat, candidate.lon, { skipClosest: true });
  };

  const handleUseMyLocation = () => {
    setIsRemoteSearch(false);
    setRemoteSearchLabel(null);
    setAddressCandidates([]);
    if (userCoords) {
      setMapCenter(userCoords);
      fetchPlaces(userCoords.lat, userCoords.lng);
    }
  };

  // Refresh manual da lista. Respeita o contexto: em busca remota, recarrega a
  // região pesquisada (mapCenter); caso normal, usa o GPS (skipClosest evita
  // reabrir o card "Você está aqui?" num refresh manual).
  const handleRefresh = () => {
    if (isRemoteSearch && mapCenter) {
      fetchPlaces(mapCenter.lat, mapCenter.lng, { skipClosest: true });
    } else if (userCoords) {
      fetchPlaces(userCoords.lat, userCoords.lng, { skipClosest: true });
    }
  };

  const handleCreateTemporaryPlace = async () => {
    if (!newPlaceName.trim() || !userCoords) {
      toast({ variant: 'destructive', title: 'Preencha o nome do local' });
      return;
    }
    const nearbyTemp = await fetchNearbyTemporaryPlaces(userCoords.lat, userCoords.lng);
    if (nearbyTemp.length > 0) {
      setNearbyTempToConfirm(nearbyTemp[0]);
      setStep('confirm_temp');
      return;
    }
    setStep('expression');
  };

  const handleConfirmUseExistingTemp = () => {
    if (nearbyTempToConfirm) {
      setSelectedPlaceId(nearbyTempToConfirm.id);
      setStep('expression');
    }
  };

  const handleConfirmCreateNewTemp = () => {
    setNearbyTempToConfirm(null);
    setStep('expression');
  };

  const handleActivatePresence = async (selfieUrl: string, selfieSource: 'camera' | 'upload') => {
    if (!user || !selfieUrl) return;
    setActivating(true);

    try {
      let error: Error | null = null;
      let presenceId: string | null = null;
      const trimmedExpression = expressionText.trim() || undefined;

      try {
        let result;
        if (selectedPlaceId) {
          result = await activatePresenceAtPlace(selectedPlaceId, DEFAULT_INTENTION_ID, trimmedExpression);
        } else if (newPlaceName.trim() && userCoords) {
          result = await createTemporaryPlace(newPlaceName.trim(), userCoords.lat, userCoords.lng, DEFAULT_INTENTION_ID, trimmedExpression);
        } else {
          error = new Error('Nenhum local selecionado');
          return;
        }
        error = result.error;
        presenceId = result.presenceId;
      } catch (err: any) {
        if (err.message === 'PROFILE_LOADING') return;
        if (err?.message === 'PROFILE_INCOMPLETE' || err?.code === 'PROFILE_INCOMPLETE') {
          savePendingAction({ type: 'ACTIVATE_PRESENCE', placeId: selectedPlaceId || '', expressionText: expressionText?.trim() || undefined, selfieUrl, selfieSource });
          setShowProfileGate(true);
          return;
        }
        throw err;
      }

      if (error) {
        if (error?.message === 'PROFILE_INCOMPLETE' || (error as any)?.code === 'PROFILE_INCOMPLETE') {
          savePendingAction({ type: 'ACTIVATE_PRESENCE', placeId: selectedPlaceId || '', expressionText: expressionText?.trim() || undefined, selfieUrl, selfieSource });
          setShowProfileGate(true);
          return;
        }
        toast({ variant: 'destructive', title: 'Erro ao ativar presença', description: error.message });
      } else {
        if (!presenceId) throw new Error('Presence ID not returned after activation');
        await supabase.from('presence').update({
          checkin_selfie_url: selfieUrl,
          checkin_selfie_created_at: new Date().toISOString(),
          selfie_provided: selfieSource === 'camera',
          selfie_source: selfieSource,
        }).eq('id', presenceId);
        navigate('/home', { replace: true });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro inesperado' });
    } finally {
      setActivating(false);
    }
  };

  const handleSelfieConfirm = async (blob: Blob, source: 'camera' | 'upload') => {
    if (!user) return;
    setActivating(true);
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('checkin-selfies')
        .upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

      if (uploadError) {
        toast({ variant: 'destructive', title: 'Erro ao enviar foto' });
        setActivating(false);
        return;
      }

      await handleActivatePresence(fileName, source);
    } catch {
      toast({ variant: 'destructive', title: 'Erro inesperado' });
      setActivating(false);
    }
  };

  const handleSelfieCancel = () => {
    setStep('expression');
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 page-fade">

        {/* Loader inicial */}
        {!permissionChecked && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 text-katu-blue mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        )}

        {/* Permissão de localização */}
        {permissionChecked && step === 'permission' && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6">
              <MapPin className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">
              {permissionStatus === 'blocked' ? 'Localização bloqueada' : 'Precisamos da sua localização'}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-8 max-w-[280px]">
              {permissionStatus === 'blocked'
                ? 'A permissão foi negada. Abra as configurações do dispositivo e permita o acesso à localização.'
                : 'Para encontrar locais perto de você, precisamos acessar sua localização.'}
            </p>
            {permissionStatus === 'blocked' ? (
              <Button
                onClick={() => toast({ title: 'Abra as configurações', description: 'Permita o acesso à localização nas configurações do dispositivo.' })}
                className="w-full max-w-[280px] h-12 rounded-xl font-semibold text-base"
                variant="outline"
              >
                Como permitir
              </Button>
            ) : (
              <Button
                onClick={handleRequestLocation}
                disabled={isRequestingPermission}
                className="w-full max-w-[280px] h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-base"
              >
                {isRequestingPermission ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Solicitando...</>
                ) : (
                  <><MapPin className="h-5 w-5 mr-2" />Permitir localização</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Detectando localização */}
        {step === 'detecting' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 text-katu-blue mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Detectando sua localização...</p>
          </div>
        )}

        {/* Seleção de local */}
        {step === 'select' && (
          <PlaceSelector
            loading={loading || placesLoading}
            places={places}
            temporaryPlaces={nearbyTemporaryPlaces}
            closestPlace={closestPlace}
            onSelectPlace={handleSelectPlace}
            onDismissClosest={handleDismissClosest}
            onCreateTemporary={() => setStep('create_temp')}
            onSearchByName={handleSearchByName}
            searchingByName={searchingByName}
            presenceRadius={presenceRadiusMeters}
            userCoords={userCoords}
            mapCenter={mapCenter}
            isRemoteSearch={isRemoteSearch}
            addressInput={addressInput}
            onAddressInputChange={setAddressInput}
            onSearchByAddress={handleSearchByAddress}
            geocodingLoading={geocodingLoading}
            remoteSearchLabel={remoteSearchLabel}
            addressCandidates={addressCandidates}
            onSelectCandidate={handleSelectCandidate}
            onUseMyLocation={handleUseMyLocation}
            onRefresh={handleRefresh}
          />
        )}

        {/* Criar local temporário */}
        {step === 'create_temp' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setStep('select')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold">Criar local temporário</h2>
                <p className="text-sm text-muted-foreground">Expira após 6 horas sem atividade</p>
              </div>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="placeName" className="text-sm font-medium">Nome do local</Label>
                  <Input
                    id="placeName"
                    placeholder="Ex: Festa do João, Churrasco no parque..."
                    value={newPlaceName}
                    onChange={(e) => setNewPlaceName(e.target.value)}
                    className="mt-2 h-11 rounded-xl"
                  />
                </div>
                <Button
                  onClick={handleCreateTemporaryPlace}
                  disabled={!newPlaceName.trim()}
                  className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmar local temporário existente */}
        {step === 'confirm_temp' && nearbyTempToConfirm && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">Local temporário próximo</h2>
              <p className="text-sm text-muted-foreground mt-1">Já existe um local muito próximo. Deseja entrar?</p>
            </div>
            <Card className="border-2 border-katu-green/30">
              <CardContent className="pt-6">
                <div className="p-4 bg-katu-green/10 rounded-xl">
                  <p className="font-semibold text-lg">{nearbyTempToConfirm.nome}</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{nearbyTempToConfirm.active_users} {nearbyTempToConfirm.active_users === 1 ? 'pessoa' : 'pessoas'}</span>
                    <span>•</span>
                    <span>{Math.round(nearbyTempToConfirm.distance_meters)}m de você</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <Button onClick={handleConfirmUseExistingTemp} className="h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                    Entrar neste local
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl" onClick={handleConfirmCreateNewTemp}>
                    Criar outro local mesmo assim
                  </Button>
                  <Button variant="ghost" className="h-11 rounded-xl" onClick={() => { setNearbyTempToConfirm(null); setStep('select'); }}>
                    Voltar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expressão momentânea */}
        {step === 'expression' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => {
                  if (nearbyTempToConfirm) setStep('confirm_temp');
                  else if (newPlaceName.trim()) setStep('create_temp');
                  else setStep('select');
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-bold">Seu momento aqui</h2>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div>
                  <p className="text-base text-foreground mb-4">
                    O que as pessoas precisam saber sobre você aqui e agora?
                  </p>
                  <Textarea
                    placeholder="Ex: Aberto a conversar."
                    value={expressionText}
                    onChange={(e) => setExpressionText(e.target.value.slice(0, 80))}
                    className="min-h-[100px] rounded-xl resize-none"
                    maxLength={80}
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    {expressionText.length}/80
                  </p>
                </div>
                <Button
                  onClick={() => setStep('selfie')}
                  className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-base"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Selfie */}
        {step === 'selfie' && (
          <CheckinSelfie
            onConfirm={handleSelfieConfirm}
            onCancel={handleSelfieCancel}
            uploading={activating}
          />
        )}
      </div>
      <ProfileGateModal open={showProfileGate} onClose={() => setShowProfileGate(false)} />
    </MobileLayout>
  );
}
