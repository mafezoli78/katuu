import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { InteractionState } from '@/lib/interactionRules';
import { PersonNearby } from '@/hooks/usePeopleNearby';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { SwipeActions } from '@/components/home/SwipeActions';
import { calculateAge } from '@/utils/date';
import { Flag, Hand, Briefcase, Users, Flame } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { WaveIntention, INTENTION_CONFIG } from '@/hooks/useWaves';
import { ReportModal } from '@/components/shared/ReportModal';

const BUTTON_WIDTH = 140;
const DIRECTION_THRESHOLD = 15;
const SNAP_THRESHOLD = 0.4;

interface PersonCardProps {
  person: PersonNearby;
  state: InteractionState;
  button: { label: string; disabled: boolean; action: string; conversationId?: string };
  isVisible: boolean;
  isMutedByMe: boolean;
  isBlockedByMe: boolean;
  activeIntention: WaveIntention | null;
  onWave: (toUserId: string, intention: WaveIntention, message?: string) => void;
  onMute: (userId: string) => Promise<void>;
  onBlock: (userId: string) => Promise<void>;
  openCardId: string | null;
  onSwipeOpen: (id: string | null) => void;
}

export function PersonCard({
  person,
  state,
  button,
  isVisible,
  isMutedByMe,
  isBlockedByMe,
  activeIntention,
  onWave,
  onMute,
  onBlock,
  openCardId,
  onSwipeOpen,
}: PersonCardProps) {
  const navigate = useNavigate();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showIntentionDialog, setShowIntentionDialog] = useState(false);
  const [selectedIntention, setSelectedIntention] = useState<WaveIntention | null>(null);
  const [intentionMessage, setIntentionMessage] = useState('');



  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    directionLocked: 'horizontal' | 'vertical' | null;
    startTranslateX: number;
  } | null>(null);

  useEffect(() => {
    if (openCardId !== person.id && translateX !== 0) {
      setIsAnimating(true);
      setTranslateX(0);
    }
  }, [openCardId, person.id, translateX]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsAnimating(false);
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      directionLocked: null,
      startTranslateX: translateX,
    };
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = touchRef.current;
    if (!touch) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touch.startX;
    const deltaY = currentY - touch.startY;

    if (!touch.directionLocked) {
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) return;
      touch.directionLocked = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical' : 'horizontal';
    }

    if (touch.directionLocked === 'vertical') return;

    e.preventDefault();

    if (openCardId !== person.id) onSwipeOpen(person.id);

    const newTranslateX = Math.max(-BUTTON_WIDTH, Math.min(0, touch.startTranslateX + deltaX));
    setTranslateX(newTranslateX);
  }, [openCardId, person.id, onSwipeOpen]);

  const handleTouchEnd = useCallback(() => {
    const touch = touchRef.current;
    if (!touch || touch.directionLocked !== 'horizontal') {
      touchRef.current = null;
      return;
    }

    setIsAnimating(true);

    if (Math.abs(translateX) > BUTTON_WIDTH * SNAP_THRESHOLD) {
      setTranslateX(-BUTTON_WIDTH);
      onSwipeOpen(person.id);
    } else {
      setTranslateX(0);
      onSwipeOpen(null);
    }

    touchRef.current = null;
  }, [translateX, person.id, onSwipeOpen]);

  if (!isVisible) return null;

  const age = person.profile.data_nascimento
    ? calculateAge(person.profile.data_nascimento)
    : null;

  const initials = person.profile.nome?.[0]?.toUpperCase() || '?';

  const handleConfirmWave = async () => {
    if (!selectedIntention) return;
    setShowIntentionDialog(false);
    setIsSending(true);
    await onWave(person.id, selectedIntention, intentionMessage || undefined);
    setIsSending(false);
    setSelectedIntention(null);
    setIntentionMessage('');
  };

  const handleButtonClick = async () => {
    switch (button.action) {
      case 'wave':
        setShowIntentionDialog(true);
        break;
      case 'open_waves':
        navigate('/waves');
        break;
      case 'open_chat':
        if (button.conversationId) {
          navigate(`/chat?conversationId=${button.conversationId}`);
        }
        break;
      default:
        break;
    }
  };

  const getButtonStyles = () => {
    switch (state) {
      case InteractionState.NONE:
        return 'bg-accent text-accent-foreground hover:bg-accent/90';
      case InteractionState.WAVE_RECEIVED:
        return 'bg-katu-green text-white hover:bg-katu-green/90';
      case InteractionState.CHAT_ACTIVE:
        return 'bg-primary text-primary-foreground hover:bg-primary/90';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const shouldAnimateIcon = state === InteractionState.NONE || state === InteractionState.WAVE_RECEIVED;

  const IntentionIcon = activeIntention === 'open' ? Hand
    : activeIntention === 'professional' ? Briefcase
    : activeIntention === 'social' ? Users
    : activeIntention === 'connection' ? Flame
    : null;

  const ctaButton = (
    <Button
      className={`w-full h-11 rounded-xl font-semibold ${getButtonStyles()}`}
      disabled={button.disabled || isSending}
      onClick={handleButtonClick}
    >
      <HandshakeIcon className={`h-5 w-5 mr-2 ${shouldAnimateIcon ? 'animate-wave' : ''}`} />
      {button.label}
    </Button>
  );

  return (
    <>
      <div className="relative overflow-hidden rounded-lg">
        <SwipeActions
          personId={person.id}
          isMuted={isMutedByMe}
          isBlocked={isBlockedByMe}
          onMute={async () => {
            await onMute(person.id);
            setIsAnimating(true);
            setTranslateX(0);
            onSwipeOpen(null);
          }}
          onBlock={async () => {
            await onBlock(person.id);
            setIsAnimating(true);
            setTranslateX(0);
            onSwipeOpen(null);
          }}
        />

        <div
          style={{
            transform: `translateX(${translateX}px)`,
            transition: isAnimating ? 'transform 200ms ease-out' : 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex h-full">
                {/* FOTO DO MOMENTO */}
                <div
                  className="w-[36%] flex items-center p-2.5 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (person.checkinSelfieUrl) setPhotoOpen(true);
                  }}
                >
                  {person.checkinSelfieUrl ? (
                    <img
                      src={person.checkinSelfieUrl}
                      alt={person.profile.nome || ''}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center font-bold text-xl bg-muted text-muted-foreground rounded-lg">
                      {initials}
                    </div>
                  )}
                </div>

                {/* CONTEÚDO */}
                <div className="flex-1 flex flex-col justify-between p-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="font-semibold text-base">
                        {person.profile.nome?.split(' ')[0] || person.profile.nome}
                        {age !== null && (
                          <span className="text-muted-foreground font-normal">, {age}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 -mt-1 -mr-1">
                        {activeIntention && IntentionIcon && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IntentionIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 text-sm" side="left">
                              <p className="font-semibold">{INTENTION_CONFIG[activeIntention].label}</p>
                              <p className="text-muted-foreground text-xs mt-0.5">{INTENTION_CONFIG[activeIntention].description}</p>
                            </PopoverContent>
                          </Popover>
                        )}
                        <button
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                          aria-label="Denunciar"
                        >
                          <Flag className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {person.assuntoAtual ? (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{person.assuntoAtual}</p>
                    ) : person.profile.bio ? (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{person.profile.bio}</p>
                    ) : null}
                  </div>

                  <div className="mt-3">{ctaButton}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de ampliação da foto */}
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
            {person.checkinSelfieUrl && (
              <img
                src={person.checkinSelfieUrl}
                alt={person.profile.nome || ''}
                className="w-full max-w-md mx-auto aspect-square object-cover rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de intenção — centralizado */}
      <Dialog open={showIntentionDialog} onOpenChange={setShowIntentionDialog}>
        <DialogContent className="max-w-sm rounded-2xl px-6 py-6">
          <DialogTitle className="text-center text-base font-bold mb-4">Como você quer se conectar?</DialogTitle>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['open', 'professional', 'social', 'connection'] as WaveIntention[]).map((key) => {
              const Icon = key === 'open' ? Hand : key === 'professional' ? Briefcase : key === 'social' ? Users : Flame;
              const cfg = INTENTION_CONFIG[key];
              return (
                <button
                  key={key}
                  onClick={() => setSelectedIntention(key)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                    selectedIntention === key ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{cfg.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedIntention && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-1.5">Mensagem opcional</p>
              <Textarea
                value={intentionMessage}
                onChange={(e) => setIntentionMessage(e.target.value.slice(0, 80))}
                placeholder="Ex: Vi que você também é de TI..."
                className="resize-none h-16 text-sm"
                maxLength={80}
              />
              <p className="text-right text-xs text-muted-foreground mt-1">{intentionMessage.length}/80</p>
            </div>
          )}
          <Button
            onClick={handleConfirmWave}
            disabled={!selectedIntention}
            className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            Acenar
          </Button>
        </DialogContent>
      </Dialog>

      {/* ReportModal fora do overflow-hidden */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={person.id}
        reportedUserName={person.profile.nome?.split(' ')[0] || 'Usuário'}
        contexto="home"
      />
    </>
  );
}
