import { useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import { Locate } from 'lucide-react';
import { Place } from '@/services/placesService';
import { NearbyTemporaryPlace } from '@/hooks/usePresence';

interface PlaceMapProps {
  places: Place[];
  temporaryPlaces: NearbyTemporaryPlace[];
  temporaryPlacesCoords: { id: string; latitude: number; longitude: number }[];
  userCoords: { lat: number; lng: number };
  /** Centro/foco do mapa: segue a busca ativa (GPS no fluxo normal, coord
   *  geocodificada na busca remota). Separado de userCoords de propósito —
   *  userCoords só move o pontinho "você"; center move a vista do mapa. */
  center: { lat: number; lng: number } | null;
  /** Em busca remota o usuário não está fisicamente no lugar — esconde "Entrar". */
  isRemoteSearch: boolean;
  onSelectPlace: (placeId: string) => void;
  /** Abre o modo explorador do lugar. */
  onExplore: (placeId: string) => void;
}

function createPlaceIcon(activeUsers: number, isTemporary: boolean): L.DivIcon {
  let bgClass = 'pin-empty';
  if (isTemporary) bgClass = 'pin-temporary';
  else if (activeUsers > 0) bgClass = 'pin-active';

  return L.divIcon({
    className: 'leaflet-place-pin',
    html: `<div class="place-pin ${bgClass}"><span>${activeUsers}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

const userIcon = L.divIcon({
  className: 'leaflet-user-location',
  html: '<div class="user-dot"><div class="user-dot-pulse"></div></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Popup do pin: espelha o card da lista — Explorar + Entrar, sem contagem
// (a bolinha do pin já mostra o número de presentes). canExplore=false em
// local temporário; canEnter=false em busca remota.
function buildPopupHtml(
  name: string,
  placeId: string,
  opts: { canExplore: boolean; canEnter: boolean },
): string {
  const explorar = opts.canExplore
    ? `<button data-explore-id="${placeId}" style="flex:1;background:transparent;color:hsl(var(--foreground));border:1px solid hsl(var(--border));border-radius:8px;padding:0 12px;font-weight:600;font-size:13px;cursor:pointer;height:34px;">Explorar</button>`
    : '';
  const entrar = opts.canEnter
    ? `<button data-place-id="${placeId}" style="flex:1;background:hsl(var(--accent));color:hsl(var(--accent-foreground));border:none;border-radius:8px;padding:0 12px;font-weight:600;font-size:13px;cursor:pointer;height:34px;">Entrar</button>`
    : '';

  return `
    <div style="padding:8px;min-width:180px;">
      <p style="font-weight:600;font-size:14px;margin:0 0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</p>
      <div style="display:flex;align-items:center;gap:8px;">
        ${explorar}
        ${entrar}
      </div>
    </div>
  `;
}

export default function PlaceMap({
  places,
  temporaryPlaces,
  temporaryPlacesCoords,
  userCoords,
  center,
  isRemoteSearch,
  onSelectPlace,
  onExplore,
}: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const placeMarkersRef = useRef<L.LayerGroup>(L.layerGroup());
  const tempMarkersRef = useRef<L.LayerGroup>(L.layerGroup());
  // Store callbacks in refs so the popup click handler always has the latest.
  const onSelectPlaceRef = useRef(onSelectPlace);
  onSelectPlaceRef.current = onSelectPlace;
  const onExploreRef = useRef(onExplore);
  onExploreRef.current = onExplore;

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Foco inicial: a busca ativa (center) se já existir, senão o GPS.
    const focus = center ?? userCoords;

    const map = L.map(containerRef.current, {
      center: [focus.lat, focus.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    const stadiaKey = import.meta.env.VITE_STADIA_API_KEY;
    L.tileLayer(`https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${stadiaKey}`, {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      detectRetina: true,
      maxZoom: 20,
    }).addTo(map);

    userMarkerRef.current = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon, interactive: false }).addTo(map);
    placeMarkersRef.current.addTo(map);
    tempMarkersRef.current.addTo(map);

    // Click delegado: distingue "Entrar" (data-place-id) de "Explorar" (data-explore-id).
    containerRef.current.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const enterBtn = target.closest<HTMLElement>('[data-place-id]');
      if (enterBtn) {
        e.stopPropagation();
        onSelectPlaceRef.current(enterBtn.dataset.placeId!);
        return;
      }
      const exploreBtn = target.closest<HTMLElement>('[data-explore-id]');
      if (exploreBtn) {
        e.stopPropagation();
        onExploreRef.current(exploreBtn.dataset.exploreId!);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update user position (pontinho "você" — sempre o GPS real)
  useEffect(() => {
    if (!userMarkerRef.current) return;
    userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
  }, [userCoords]);

  // Re-centraliza a vista quando o foco da busca muda (busca remota ou
  // "usar minha localização"). Propositalmente NÃO depende de userCoords:
  // assim a variação contínua do GPS não arrasta o mapa enquanto o usuário
  // navega — só uma ação de busca move a vista.
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.flyTo([center.lat, center.lng], 16, { duration: 0.5 });
  }, [center]);

  // Update place markers
  useEffect(() => {
    const group = placeMarkersRef.current;
    group.clearLayers();
    places.forEach((place) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: createPlaceIcon(place.active_users ?? 0, false),
      });
      marker.bindPopup(buildPopupHtml(place.nome, place.id, { canExplore: true, canEnter: !isRemoteSearch }), {
        className: 'leaflet-popup-katuu',
        closeButton: false,
      });
      group.addLayer(marker);
    });
  }, [places, isRemoteSearch]);

  // Update temporary place markers
  useEffect(() => {
    const group = tempMarkersRef.current;
    group.clearLayers();
    const coordsMap = new Map(temporaryPlacesCoords.map((c) => [c.id, c]));
    temporaryPlaces.forEach((tp) => {
      const coords = coordsMap.get(tp.id);
      if (!coords) return;
      const marker = L.marker([coords.latitude, coords.longitude], {
        icon: createPlaceIcon(tp.active_users, true),
      });
      marker.bindPopup(buildPopupHtml(tp.nome, tp.id, { canExplore: false, canEnter: !isRemoteSearch }), {
        className: 'leaflet-popup-katuu',
        closeButton: false,
      });
      group.addLayer(marker);
    });
  }, [temporaryPlaces, temporaryPlacesCoords, isRemoteSearch]);

  const handleRecenter = useCallback(() => {
    mapRef.current?.flyTo([userCoords.lat, userCoords.lng], 16, { duration: 0.5 });
  }, [userCoords]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border h-full bg-muted" style={{ zIndex: 0 }}>
      <div ref={containerRef} className="h-full w-full" />
      <button
        onClick={handleRecenter}
        style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 1000,
          backgroundColor: 'white', padding: 8, borderRadius: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
        }}
        aria-label="Centralizar em mim"
      >
        <Locate className="h-5 w-5" />
      </button>
    </div>
  );
}
