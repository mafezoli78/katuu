import { useState, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { isProfileComplete as checkProfileComplete } from '@/utils/profileCompletion';

export interface PendingAction {
  type: 'selectPlace' | 'createTemp';
  placeId?: string;
}

export function useProfileGate() {
  const { profile, interests, loading } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | undefined>();

  const isProfileComplete = !loading && checkProfileComplete(profile, interests);

  const requireProfile = useCallback((action?: PendingAction): boolean => {
    if (isProfileComplete) return true;
    setPendingAction(action);
    setIsOpen(true);
    return false;
  }, [isProfileComplete]);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setPendingAction(undefined);
  }, []);

  return {
    isProfileComplete,
    requireProfile,
    isOpen,
    pendingAction,
    openModal,
    closeModal,
    loading,
  };
}
