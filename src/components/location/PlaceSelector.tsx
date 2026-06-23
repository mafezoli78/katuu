import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MapPin, Navigation, Loader2, Clock, Search, Plus, Check, X, UtensilsCrossed, Coffee, Beer, Music, ShoppingBag, Dumbbell, Briefcase, Building2, Store, List, Map, Users, RefreshCw } from 'lucide-react';
import { TemporaryPlaceIcon } from '@/components/icons/TemporaryPlaceIcon';
import { Place, PROXIMITY_THRESHOLD_METERS } from '@/services/placesService';
import { NearbyTemporaryPlace } from '@/hooks/usePresence';
import { supabase } from '@/integrations/supabase/client';
import { useValidatePlaceDistance } from '@/hooks/useValidatePlaceDistance';
import { useToast } from '@/components/ui/use-toast';

const PlaceMap = lazy(() => import('@/components/location/PlaceMap'));

interface PlaceSelectorProps {
  loading: boolean;
  places: Place[];
  temporaryPlaces: NearbyTemporaryPlace[];
  closestPlace: Place | null;
  onSelectPlace: (placeId: string) => void;
  onCreateTemporary: () => void;
  onSearchByName: (query: string) => void;
  searchingByName: boolean;
  presenceRadius: number;
  userCoords: { lat: number; lng: number } | null;
  /** Centro do mapa: segue a busca ativa (GPS ou coord geocodificada). */
  mapCenter: { lat: number; lng: number } | null;
  /** Lista vem de um endereço pesquisado (geocoding), não do GPS — usuário não está fisicamente lá. */
  isRemoteSearch?: boolean;
  addressInput: string;
  onAddressInputChange: (value: string) => void;
  onSearchByAddress: (text: string) => void;
  geocodingLoading: boolean;
  remoteSearchLabel: string | null;
  addressCandidates: { label: string; lat: number; lon: number }[];
  onSelectCandidate: (candidate: { label: string; lat: number; lon: number }) => void;
  onUseMyLocation: () => void;
  onRefresh: () => void;
}

// Map category to icon
function getCategoryIcon(categoria?: string | null) {
  if (!categoria) return Store;
  const cat = categoria.toLowerCase();
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('cervej')) return Beer;
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('comida')) return UtensilsCrossed;
  if (cat.includes('café') || cat.includes('coffee') || cat.includes('padaria') || cat.includes('bakery')) return Coffee;
  if (cat.includes('music') || cat.includes('club') || cat.includes('balada') || cat.includes('show')) return Music;
  if (cat.includes('shop') || cat.includes('loja') || cat.includes('mall')) return ShoppingBag;
  if (cat.includes('gym') || cat.includes('academia') || cat.includes('fitness')) return Dumbbell;
  if (cat.includes('office') || cat.includes('cowork') || cat.includes('escritório')) return Briefcase;
  if (cat.includes('hotel') || cat.includes('building')) return Building2;
  return Store;
}

// Map category to background color class
function getCategoryBgColor(categoria?: string | null) {
  if (!categoria) return 'bg-muted';
  const cat = categoria.toLowerCase();
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('cervej')) return 'bg-amber-100';
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('comida')) return 'bg-orange-100';
  if (cat.includes('café') || cat.includes('coffee') || cat.includes('padaria') || cat.includes('bakery')) return 'bg-yellow-100';
  if (cat.includes('music') || cat.includes('club') || cat.includes('balada') || cat.includes('show')) return 'bg-purple-100';
  if (cat.includes('shop') || cat.includes('loja') || cat.includes('mall')) return 'bg-pink-100';
  if (cat.includes('gym') || cat.includes('academia') || cat.includes('fitness')) return 'bg-green-100';
  if (cat.includes('office') || cat.includes('cowork') || cat.includes('escritório')) return 'bg-blue-100';
  return 'bg-muted';
}
function getCategoryIconColor(categoria?: string | null) {
  if (!categoria) return 'text-muted-foreground';
  const cat = categoria.toLowerCase();
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('cervej')) return 'text-amber-600';
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('comida')) return 'text-orange-600';
  if (cat.includes('café') || cat.includes('coffee') || cat.includes('padaria') || cat.includes('bakery')) return 'text-yellow-700';
  if (cat.includes('music') || cat.includes('club') || cat.includes('balada') || cat.includes('show')) return 'text-purple-600';
  if (cat.includes('shop') || cat.includes('loja') || cat.includes('mall')) return 'text-pink-600';
  if (cat.includes('gym') || cat.includes('academia') || cat.includes('fitness')) return 'text-green-600';
  if (cat.includes('office') || cat.includes('cowork') || cat.includes('escritório')) return 'text-blue-600';
  return 'text-muted-foreground';
}
export function PlaceSelector({
  loading,
  places,
  temporaryPlaces,
  closestPlace,
  onSelectPlace,
  onCreateTemporary,
  onSearchByName,
  searchingByName,
  presenceRadius,
  userCoords,
  mapCenter,
  isRemoteSearch = false,
  addressInput,
  onAddressInputChange,
  onSearchByAddress,
  geocodingLoading,
  remoteSearchLabel,
  addressCandidates,
  onSelectCandidate,
  onUseMyLocation,
  onRefresh,
}: PlaceSelectorProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { validateAndProceed } = useValidatePlaceDistance();
  const [searchQuery, setSearchQuery] = useState('');
  const [showList, setShowList] = useState(!closestPlace);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [tempPlacesCoords, setTempPlacesCoords] = useState<{ id: string; latitude: number; longitude: number }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleExplore = (e: React.MouseEvent, placeId: string) => {
    e.stopPropagation();
    navigate(`/explore/${placeId}`);
  };

  const handleExploreTemporaryBlocked = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: 'Locais temporários não podem ser explorados' });
  };

  // Fetch coords for temporary places (RPC doesn't return them)
  useEffect(() => {
    if (temporaryPlaces.length === 0) {
      setTempPlacesCoords([]);
      return;
    }
    const ids = temporaryPlaces.map(tp => tp.id);
    supabase
      .from('places')
      .select('id, latitude, longitude')
      .in('id', ids)
      .then(({ data }) => {
        if (data) setTempPlacesCoords(data);
      });
  }, [temporaryPlaces]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearchByName(searchQuery.trim());
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Show direct suggestion for very close place — nunca em busca remota
  // (pressupõe presença física que a busca por endereço não garante).
  if (closestPlace && !showList && !isRemoteSearch) {
    const CategoryIcon = getCategoryIcon(closestPlace.categoria);
    const bgColor = getCategoryBgColor(closestPlace.categoria);
    const iconColor = getCategoryIconColor(closestPlace.categoria);
    return <div className="space-y-4 animate-fade-in">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">Você está aqui?</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Encontramos um local muito próximo
          </p>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
              <CategoryIcon className={`h-7 w-7 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{closestPlace.nome}</h3>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {closestPlace.distance_meters}m de você
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setShowList(true)}>
              <X className="h-4 w-4 mr-2" />
              Não
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              onClick={() => validateAndProceed(
                { latitude: closestPlace.latitude, longitude: closestPlace.longitude },
                { categoria: closestPlace.categoria, isTemporary: closestPlace.is_temporary },
                () => onSelectPlace(closestPlace.id)
              )}
            >
              <Check className="h-4 w-4 mr-2" />
              Sim
            </Button>
          </div>
        </div>
      </div>;
  }

  // Show full list or map
  return <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        {userCoords ? (
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'list' | 'map')} size="sm" className="bg-muted rounded-lg p-0.5">
            <ToggleGroupItem value="list" aria-label="Lista" className="rounded-md px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Mapa" className="rounded-md px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
              <Map className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        ) : <div />}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          aria-label="Atualizar"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? <div className="text-center py-12">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-katu-blue" />
          <p className="text-sm text-muted-foreground mt-4">Buscando locais próximos...</p>
        </div> : viewMode === 'map' && userCoords ? (
          <Suspense fallback={<div className="text-center py-12"><Loader2 className="h-10 w-10 animate-spin mx-auto text-katu-blue" /></div>}>
            <div style={{ height: 'calc(100dvh - 220px)' }}>
              <PlaceMap
                places={places}
                temporaryPlaces={temporaryPlaces}
                temporaryPlacesCoords={tempPlacesCoords}
                userCoords={userCoords}
                center={mapCenter}
                isRemoteSearch={isRemoteSearch}
                onExplore={(id) => navigate(`/explore/${id}`)}
                onSelectPlace={onSelectPlace}
              />
            </div>
          </Suspense>
        ) : <div className="space-y-4">
          {/* Temporary Places Section (prioritized) */}
          {temporaryPlaces.length > 0 && <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-1">
                <Clock className="h-4 w-4 text-katu-green" />
                <span>Locais temporários ativos</span>
              </div>
              {temporaryPlaces.map(place => {
                return <div key={place.id} onClick={() => {
                  const coords = tempPlacesCoords.find(c => c.id === place.id) ?? null;
                  validateAndProceed(coords, { categoria: null, isTemporary: true }, () => onSelectPlace(place.id));
                }} className="bg-card rounded-xl p-3 shadow-sm border-2 border-katu-green/30 place-card cursor-pointer hover:border-katu-green/50">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-xl bg-katu-green/10 flex items-center justify-center flex-shrink-0">
                      <TemporaryPlaceIcon className="h-8 w-8 text-katu-green" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <h3 className="font-semibold truncate">{place.nome}</h3>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="flex-1 rounded-lg font-semibold" onClick={handleExploreTemporaryBlocked}>
                          Explorar
                        </Button>
                        <Button size="sm" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg font-semibold">
                          Entrar
                        </Button>
                        <div className="flex items-center justify-center gap-1 w-16 h-9 rounded-lg bg-katu-green/10 text-katu-green text-sm font-semibold shrink-0">
                          <Users className="h-4 w-4" />
                          {place.active_users}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>;
              })}
            </div>}

          {/* Foursquare Places Section */}
          {places.length > 0 && <div className="space-y-2">
              {places.map(place => {
          const CategoryIcon = getCategoryIcon(place.categoria);
          const bgColor = getCategoryBgColor(place.categoria);
          const iconColor = getCategoryIconColor(place.categoria);
          return <div key={place.id} onClick={isRemoteSearch ? undefined : () => validateAndProceed(
                    { latitude: place.latitude, longitude: place.longitude },
                    { categoria: place.categoria, isTemporary: place.is_temporary },
                    () => onSelectPlace(place.id)
                  )} className={`bg-card rounded-xl p-3 shadow-sm border border-border place-card ${isRemoteSearch ? '' : 'cursor-pointer'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-16 w-16 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
                        <CategoryIcon className={`h-8 w-8 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <h3 className="font-semibold truncate">{place.nome}</h3>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="flex-1 rounded-lg font-semibold" onClick={(e) => handleExplore(e, place.id)}>
                            Explorar
                          </Button>
                          {!isRemoteSearch && (
                            <Button size="sm" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg font-semibold">
                              Entrar
                            </Button>
                          )}
                          <div className="flex items-center justify-center gap-1 w-16 h-9 rounded-lg bg-katu-green/10 text-katu-green text-sm font-semibold shrink-0">
                            <Users className="h-4 w-4" />
                            {place.active_users ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>;
        })}
            </div>}

          {/* Empty state */}
          {places.length === 0 && temporaryPlaces.length === 0 && <div className="text-center py-8 bg-card rounded-xl border border-border">
              <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum local encontrado por perto</p>
            </div>}

          {/* Search by name section */}
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              Não encontrou? Busque por nome:
            </p>
            <div className="flex gap-2">
              <Input placeholder="Nome do local..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 h-11 rounded-xl bg-card" />
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={handleSearch} disabled={!searchQuery.trim() || searchingByName}>
                {searchingByName ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Remote address search section */}
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              O que está acontecendo longe de você?
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Rua, bairro ou cidade"
                value={addressInput}
                onChange={(e) => onAddressInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearchByAddress(addressInput); }}
                className="flex-1 h-11 rounded-xl bg-card"
              />
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => onSearchByAddress(addressInput)} disabled={!addressInput.trim() || geocodingLoading}>
                {geocodingLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </Button>
            </div>
            {isRemoteSearch && (
              <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-xl px-3 py-2">
                <p className="text-xs text-muted-foreground truncate">
                  Explorando: <span className="font-medium text-foreground">{remoteSearchLabel}</span>
                </p>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg shrink-0" onClick={onUseMyLocation}>
                  <Navigation className="h-3.5 w-3.5 mr-1.5" />
                  Usar minha localização
                </Button>
              </div>
            )}
            {addressCandidates.length > 0 && (
              <div className="space-y-1.5">
                {addressCandidates.map((candidate, index) => (
                  <button key={`${candidate.lat}-${candidate.lon}-${index}`} type="button" onClick={() => onSelectCandidate(candidate)} className="w-full flex items-center gap-2 text-left bg-muted/50 hover:bg-muted rounded-xl px-3 py-2.5 transition-colors">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{candidate.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create temporary place section */}
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              Crie seu próprio local
            </p>
            <Button className="w-full h-11 rounded-xl bg-katu-green text-white hover:bg-katu-green/90 font-semibold" onClick={onCreateTemporary}>
              <Plus className="h-4 w-4 mr-2" />
              Criar local temporário
            </Button>
          </div>
        </div>}
    </div>;
}