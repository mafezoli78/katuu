/**
 * `usePresence` agora é apenas um leitor do PresenceContext (singleton).
 * A lógica vive em @/contexts/PresenceContext. Este arquivo permanece como
 * ponto de import estável para os consumidores que já fazem
 * `import { usePresence } from '@/hooks/usePresence'`.
 */
export { usePresence } from '@/contexts/PresenceContext';

// Re-export types for consumers
export type { PresenceLogicalState, PresenceEndReason, PresenceState } from '@/types/presence';
export type { Intention, Presence, NearbyTemporaryPlace } from './presence/types';
