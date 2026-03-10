import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/hooks/usePresence';
import { usePeopleNearby } from '@/hooks/usePeopleNearby';
import { useWaves } from '@/hooks/useWaves';
import { useInteractionData } from '@/hooks/useInteractionData';
import { useHomeActions } from '@/hooks/useHomeActions';
import { useToast } from '@/components/ui/use-toast';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PresenceStatusCard } from '@/components/home/PresenceStatusCard';
import { PeopleList } from '@/components/home/PeopleList';
import { TutorialOverlay } from '@/features/tutorial/TutorialOverlay';
import { logger } from '@/lib/logger';

export default function Home() {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    currentPresence,
    currentPlace,
    formatRemainingTime,
    renewPresence,
    deactivatePresence,
    lastEndReason,
    clearLastEndReason,
    loading: presenceLoading,
    presenceState,
  } = usePresence();
  const { people, loading: peopleLoading, refetch: refetchPeople } = usePeopleNearby(currentPlace?.id || null);
  const { sendWave, refetch: refetchWaves } = useWaves();

  const {
    sentWaves,
    receivedWaves,
    conversations,
    activeMutes,
    blocks,
    refetch: refetchInteractionData,
  } = useInteractionData(currentPlace?.id || null);

  const { handleWave, handleMute, handleBlock } = useHomeActions({
    placeId: currentPlace?.id || null,
    activeMutes,
    blocks,
    sendWave,
    refetchInteractionData,
  });

  const handleRefreshPeople = useCallback(() => {
    refetchPeople();
    refetchInteractionData();
  }, [refetchPeople, refetchInteractionData]);

  // Redirect redundante removido — App.tsx já protege rotas autenticadas

  // A3: Handle presence end - show toast for automatic endings, refetch data
  useEffect(() => {
    if (lastEndReason) {
      refetchWaves();
      refetchInteractionData();

      const reasonType = lastEndReason.type;
      if (reasonType === 'presence_expired' || reasonType === 'expired') {
        toast({ title: 'Presença expirada', description: 'Seu tempo no local terminou' });
      } else if (reasonType === 'gps_exit') {
        toast({ title: 'Você saiu da área', description: 'Presença encerrada automaticamente' });
      }

      clearLastEndReason();
    }
  }, [lastEndReason, clearLastEndReason, refetchWaves, refetchInteractionData, toast]);

  // Auto-redirect to location page if no active presence
  useEffect(() => {
    if (presenceLoading) return;

    if (presenceState.isEnteringPlace) {
      logger.debug('[Home] 🚧 Entering place - blocking redirect');
      return;
    }

    if (presenceState.isRevalidating) {
      logger.debug('[Home] ⏳ Revalidating - blocking redirect');
      return;
    }

    if (presenceState.logicalState === 'ended') {
      logger.debug('[Home] 🚪 Presence ended - redirecting to location');
      navigate('/location', { replace: true });
      return;
    }

    if (!currentPresence && !currentPlace && presenceState.logicalState !== 'suspended') {
      logger.debug('[Home] ℹ️ No presence found - redirecting to location');
      navigate('/location', { replace: true });
    }
  }, [presenceLoading, presenceState, currentPresence, currentPlace, navigate]);

  if (presenceLoading || !currentPresence || !currentPlace) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse-soft text-muted-foreground">Carregando...</div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <TutorialOverlay>
      <div className="p-4 space-y-4 page-fade">
        <PresenceStatusCard
          placeName={currentPlace.nome}
          isTemporary={currentPlace.is_temporary}
          formatRemainingTime={formatRemainingTime}
          renewPresence={renewPresence}
          deactivatePresence={deactivatePresence}
        />

        <PeopleList
          people={people}
          placeId={currentPlace.id}
          sentWaves={sentWaves}
          receivedWaves={receivedWaves}
          conversations={conversations}
          activeMutes={activeMutes}
          blocks={blocks}
          loading={peopleLoading}
          openCardId={openCardId}
          onSwipeOpen={setOpenCardId}
          onWave={handleWave}
          onMute={handleMute}
          onBlock={handleBlock}
          onRefresh={handleRefreshPeople}
        />
      </div>
      </TutorialOverlay>
    </MobileLayout>
  );
}
