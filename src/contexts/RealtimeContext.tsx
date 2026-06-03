import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type RealtimeListener = (table: string, payload: any) => void;

interface RealtimeContextType {
  addListener: (listener: RealtimeListener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

/**
 * Provider centralizado para eventos Realtime globais.
 * Gerencia um único canal para user_blocks e user_mutes,
 * eliminando canais duplicados entre useInteractionData e usePeopleNearby.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const listeners = useRef<Set<RealtimeListener>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const addListener = useCallback((listener: RealtimeListener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const dispatch = useCallback((table: string, payload: any) => {
    listeners.current.forEach(l => l(table, payload));
  }, []);

  useEffect(() => {
    if (!user) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`global-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' },
        (payload) => dispatch('user_blocks', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_mutes' },
        (payload) => dispatch('user_mutes', payload))
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, dispatch]);

  return (
    <RealtimeContext.Provider value={{ addListener }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtimeContext must be used within a RealtimeProvider');
  return context;
}
