import { createContext, useContext, useCallback, useState, useMemo, ReactNode } from 'react';
import { logger } from '@/lib/logger';

/**
 * Fonte ÚNICA da posição GPS do aparelho.
 *
 * Por que existe: antes, o GPS era lido em quatro lugares (entrada do
 * Location, volta de background do Location, watcher de confirmação do
 * usePresenceGPS e validação de entrada do useValidatePlaceDistance), cada um
 * com sua própria lógica e suas próprias opções. Isso gerou o falso
 * diagnóstico de "leituras divergentes". Aqui a leitura mora num lugar só;
 * todos consultam.
 *
 * REGRA SAGRADA (agora estrutural): este provider guarda APENAS coordenada de
 * GPS. Coordenada de geocoding / busca remota NUNCA entra aqui — quem usa
 * busca remota (Location.tsx) mantém essa coordenada no estado local da tela.
 * Como nada além do navigator.geolocation alimenta o `coords`, é impossível
 * contaminar os fluxos que dependem de presença física (ativar presença,
 * criar local temporário, validar distância de entrada).
 */

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface LocationContextValue {
  /** Última leitura de GPS conhecida (só-GPS). null antes da primeira leitura. */
  coords: GpsFix | null;
  /**
   * Leitura pontual (one-shot). Atualiza o `coords` e resolve com o fix.
   * Rejeita com o GeolocationPositionError (ou Error) em falha.
   * Cada chamador passa suas próprias opções — em especial `maximumAge`
   * (0 = obriga fix fresco; >0 = aceita fix recente do cache do navegador).
   */
  requestPosition: (opts?: PositionOptions) => Promise<GpsFix>;
  /**
   * Monitoramento contínuo. Chama `onFix` a cada leitura e atualiza o `coords`.
   * Retorna uma função para encerrar o watch.
   */
  watchPosition: (onFix: (fix: GpsFix) => void, opts?: PositionOptions) => () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

function toFix(position: GeolocationPosition): GpsFix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<GpsFix | null>(null);

  const requestPosition = useCallback((opts?: PositionOptions): Promise<GpsFix> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GEOLOCATION_UNSUPPORTED'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix = toFix(position);
          setCoords(fix);
          resolve(fix);
        },
        (error) => {
          reject(error);
        },
        { ...DEFAULT_OPTIONS, ...opts }
      );
    });
  }, []);

  const watchPosition = useCallback(
    (onFix: (fix: GpsFix) => void, opts?: PositionOptions): (() => void) => {
      if (!navigator.geolocation) return () => {};

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const fix = toFix(position);
          setCoords(fix);
          onFix(fix);
        },
        (error) => {
          logger.warn('[Location] watchPosition error:', error.message);
        },
        { enableHighAccuracy: true, ...opts }
      );

      return () => navigator.geolocation.clearWatch(id);
    },
    []
  );

  const value = useMemo(
    () => ({ coords, requestPosition, watchPosition }),
    [coords, requestPosition, watchPosition]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/**
 * Acesso à posição GPS do aparelho. Nome "device" para não confundir com o
 * useLocation do react-router (que é a rota atual, não a posição física).
 */
export function useDeviceLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useDeviceLocation precisa estar dentro de <LocationProvider>');
  }
  return ctx;
}
