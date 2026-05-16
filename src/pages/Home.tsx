import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function Home() {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [redirectingToLocation, setRedirectingToLocation] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // A3: Handle presence end - show toast for automatic endings
  useEffect(() => {
    if (lastEndReason) {
      refetchWaves();
      refetchInteractionData();

      const reasonType = lastEndReason.type;
      if (reasonType === 'presence_expired' || reasonType === 'expired') {
        toast({ 
          title: 'Presença expirada', 
          description: 'Seu tempo no local terminou. Redirecionando...' 
        });
      } else if (reasonType === 'gps_exit') {
        toast({ 
          title: 'Você saiu da área', 
          description: 'Presença encerrada automaticamente. Redirecionando...' 
        });
      }

      clearLastEndReason();
      
      // Redireciona com delay para o usuário ver o toast
      setRedirectingToLocation(true);
      redirectTimerRef.current = setTimeout(() => {
        navigate('/location', { replace: true });
      }, 1500);
    }
  }, [lastEndReason, clearLastEndReason, refetchWaves, refetchInteractionData, toast, navigate]);

  // Redireciona apenas se presença realmente terminou (não durante carregamento)
  useEffect(() => {
    // Não faz nada enquanto está carregando
    if (presenceLoading) return;

    // Se está entrando em um local, aguarda
    if (presenceState.isEnteringPlace) {
      logger.debug('[Home] 🚧 Entering place - aguardando confirmação');
      return;
    }

    // Se está revalidando, aguarda
    if (presenceState.isRevalidating) {
      logger.debug('[Home] ⏳ Revalidating - aguardando');
      return;
    }

    // Só redireciona se a presença explicitamente terminou
    if (presenceState.logicalState === 'ended') {
      logger.debug('[Home] 🚪 Presença terminou - redirecionando para location');
      setRedirectingToLocation(true);
      redirectTimerRef.current = setTimeout(() => {
        navigate('/location', { replace: true });
      }, 800);
      return;
    }

    // Se não tem presença E não está em estado suspenso/carregando,
    // pode ser que o usuário acessou /home diretamente sem presença
    if (!currentPresence && !currentPlace && presenceState.logicalState !== 'suspended') {
      logger.debug('[Home] ℹ️ Sem presença ativa - redirecionando para location');
      setRedirectingToLocation(true);
      redirectTimerRef.current = setTimeout(() => {
        navigate('/location', { replace: true });
      }, 800);
    }
  }, [presenceLoading, presenceState, currentPresence, currentPlace, navigate]);

  // Tela de redirecionamento (mais amigável que tela branca)
  if (redirectingToLocation) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground text-center text-sm">
            Redirecionando para seleção de local...
          </p>
        </div>
      </MobileLayout>
    );
  }

  // Tela de carregamento inicial (presença ainda sendo verificada)
  if (presenceLoading) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando sua presença...</p>
        </div>
      </MobileLayout>
    );
  }

  // Estado intermediário: presença carregou mas ainda não tem dados (pode estar sincronizando)
  if (!currentPresence || !currentPlace) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <AlertCircle className="h-12 w-12 text-amber-500" />
          <p className="text-foreground font-medium text-center">
            Você não está em nenhum local agora
          </p>
          <p className="text-muted-foreground text-sm text-center">
            Escolha um local para começar a interagir com pessoas próximas
          </p>
          <Button
            onClick={() => navigate('/location', { replace: true })}
            className="mt-2 rounded-xl gap-2"
          >
            <MapPin className="h-4 w-4" />
            Escolher local
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // Tela principal com presença ativa
  return (
    <MobileLayout>
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
    </MobileLayout>
  );
}