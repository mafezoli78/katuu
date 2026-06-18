import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { calculateDistanceMeters } from '@/config/presence';
import { getCategoryRadius } from '@/config/placeCategories';
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
  const [validating, setValidating] = useState(false);

  const validateAndProceed = (placeCoords: PlaceCoords | null, placeInfo: PlaceCategoryInfo | null, onValid: () => void) => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Geolocalização não suportada' });
      return;
    }

    setValidating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValidating(false);

        if (!placeCoords) {
          toast({ variant: 'destructive', title: 'Não foi possível validar o local', description: 'Tente novamente em alguns segundos.' });
          return;
        }

        const distance = calculateDistanceMeters(
          position.coords.latitude,
          position.coords.longitude,
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
      },
      () => {
        setValidating(false);
        toast({ variant: 'destructive', title: 'Não foi possível obter sua localização' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return { validating, validateAndProceed };
}
