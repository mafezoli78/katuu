import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { calculateDistanceMeters } from '@/config/presence';
import { getCategoryRadius } from '@/config/placeCategories';
import { useDeviceLocation } from '@/contexts/LocationContext';
import { logger } from '@/lib/logger';

interface PlaceCoords {
  latitude: number;
  longitude: number;
}

interface PlaceCategoryInfo {
  categoria: string | null;
  isTemporary?: boolean;
}

export function useValidatePlaceDistance() {
  const { toast } = useToast();
  const { requestPosition } = useDeviceLocation();
  const [validating, setValidating] = useState(false);

  const validateAndProceed = async (
    placeCoords: PlaceCoords | null,
    placeInfo: PlaceCategoryInfo | null,
    onValid: () => void
  ) => {
    setValidating(true);
    try {
      // maximumAge: 0 — validar "está aqui agora" exige fix fresco, nunca cache.
      const fix = await requestPosition({ maximumAge: 0 });

      if (!placeCoords) {
        toast({ variant: 'destructive', title: 'Não foi possível validar o local', description: 'Tente novamente em alguns segundos.' });
        return;
      }

      const distance = calculateDistanceMeters(
        fix.lat,
        fix.lng,
        placeCoords.latitude,
        placeCoords.longitude
      );

      const radius = getCategoryRadius(placeInfo?.categoria ?? null, placeInfo?.isTemporary);

      logger.debug(`[useValidatePlaceDistance] Distance to place: ${Math.round(distance)}m (radius: ${radius}m, categoria: ${placeInfo?.categoria ?? 'null'})`);

      if (distance <= radius) {
        onValid();
      } else {
        toast({ variant: 'destructive', title: 'Você precisa estar no local para entrar' });
      }
    } catch (err) {
      const unsupported = err instanceof Error && err.message === 'GEOLOCATION_UNSUPPORTED';
      toast({
        variant: 'destructive',
        title: unsupported ? 'Geolocalização não suportada' : 'Não foi possível obter sua localização',
      });
    } finally {
      setValidating(false);
    }
  };

  return { validating, validateAndProceed };
}
