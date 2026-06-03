import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PersonCard } from '@/components/home/PersonCard';
import { RefreshCw, Users } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import type { PersonNearby } from '@/hooks/usePeopleNearby';
import type { NormalizedWave, NormalizedConversation, NormalizedMute, NormalizedBlock } from '@/hooks/useInteractionData';
import type { WaveIntention } from '@/hooks/useWaves';
import { InteractionState, deriveFacts, getInteractionState } from '@/lib/interactionRules';
import { useAuth } from '@/contexts/AuthContext';

interface PeopleListProps {
  people: PersonNearby[];
  placeId: string;
  sentWaves: NormalizedWave[];
  receivedWaves: NormalizedWave[];
  conversations: NormalizedConversation[];
  activeMutes: NormalizedMute[];
  blocks: NormalizedBlock[];
  loading: boolean;
  openCardId: string | null;
  onSwipeOpen: (id: string | null) => void;
  onWave: (toUserId: string, intention: WaveIntention, message?: string) => void;
  onMute: (userId: string) => Promise<void>;
  onBlock: (userId: string) => Promise<void>;
  onRefresh: () => void;
}

export function PeopleList({
  people,
  placeId,
  sentWaves,
  receivedWaves,
  conversations,
  activeMutes,
  blocks,
  loading,
  openCardId,
  onSwipeOpen,
  onWave,
  onMute,
  onBlock,
  onRefresh,
}: PeopleListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  // Pré-calcula o estado de interação para cada pessoa fora do PersonCard
  const interactionStates = useMemo(() => {
    if (!user?.id) return new Map();
    const now = new Date();
    const data = {
      blocks: blocks.map(b => ({ user_id: b.user_id, blocked_user_id: b.blocked_user_id })),
      mutes: activeMutes.map(m => ({ user_id: m.user_id, muted_user_id: m.muted_user_id, expira_em: m.expira_em })),
      conversations: conversations.map(c => ({
        id: c.id, user1_id: c.user1_id, user2_id: c.user2_id,
        place_id: c.place_id, ativo: c.ativo,
        encerrado_por: c.encerrado_por, reinteracao_permitida_em: c.reinteracao_permitida_em,
      })),
      waves: [...sentWaves, ...receivedWaves].map(w => ({
        id: w.id, de_user_id: w.de_user_id, para_user_id: w.para_user_id,
        place_id: w.place_id, status: w.status, expires_at: w.expires_at,
        ignore_cooldown_until: (w as any).ignore_cooldown_until ?? null,
      })),
    };

    const map = new Map<string, {
      state: InteractionState;
      button: { label: string; disabled: boolean; action: string; conversationId?: string };
      isVisible: boolean;
      isMutedByMe: boolean;
      isBlockedByMe: boolean;
      activeIntention: WaveIntention | null;
    }>();

    people.forEach(person => {
      const facts = deriveFacts(user.id, person.id, placeId, now, data);
      const interactionResult = getInteractionState(facts);

      const isMutedByMe = activeMutes.some(m => m.user_id === user.id && m.muted_user_id === person.id);
      const isBlockedByMe = blocks.some(b => b.user_id === user.id && b.blocked_user_id === person.id);

      const wave = [...sentWaves, ...receivedWaves].find(w =>
        (w.de_user_id === user.id && w.para_user_id === person.id) ||
        (w.para_user_id === user.id && w.de_user_id === person.id)
      );
      const activeWaveIntention = wave && (wave as any).intention ? (wave as any).intention as WaveIntention : null;
      const conv = conversations.find(c =>
        (c.user1_id === user.id && c.user2_id === person.id) ||
        (c.user2_id === user.id && c.user1_id === person.id)
      );
      const activeConvIntention = conv && (conv as any).intention ? (conv as any).intention as WaveIntention : null;

      map.set(person.id, {
        ...interactionResult,
        isMutedByMe,
        isBlockedByMe,
        activeIntention: activeWaveIntention || activeConvIntention,
      });
    });

    return map;
  }, [user?.id, people, placeId, sentWaves, receivedWaves, conversations, activeMutes, blocks]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [isRefreshing, onRefresh]);
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-katu-blue" />
          <h2 className="text-lg font-semibold">
            Pessoas aqui ({people.length})
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-9 w-9 p-0 rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : people.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Ninguém por aqui ainda...</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde novas pessoas chegarem!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              state={interactionStates.get(person.id)?.state ?? InteractionState.NONE}
              button={interactionStates.get(person.id)?.button ?? { label: 'Acenar', disabled: true, action: 'none' }}
              isVisible={interactionStates.get(person.id)?.isVisible ?? true}
              isMutedByMe={interactionStates.get(person.id)?.isMutedByMe ?? false}
              isBlockedByMe={interactionStates.get(person.id)?.isBlockedByMe ?? false}
              activeIntention={interactionStates.get(person.id)?.activeIntention ?? null}
              onWave={onWave}
              onMute={onMute}
              onBlock={onBlock}
              openCardId={openCardId}
              onSwipeOpen={onSwipeOpen}
            />
          ))}
        </div>
      )}
    </>
  );
}
