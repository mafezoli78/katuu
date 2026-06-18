/**
 * Shared types for presence sub-hooks.
 */

export interface Intention {
  id: string;
  nome: string;
  descricao: string | null;
}

export interface Presence {
  id: string;
  user_id: string;
  location_id: string; // Legacy - manter para compatibilidade
  place_id: string;    // Fonte única de verdade
  intention_id: string;
  inicio: string;
  ultima_atividade: string;
  expires_at: string;
  ativo: boolean;
}

export interface NearbyTemporaryPlace {
  id: string;
  nome: string;
  distance_meters: number;
  active_users: number;
}
