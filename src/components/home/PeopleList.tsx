import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PersonCard } from '@/components/home/PersonCard';
import { RefreshCw, Users } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { PersonNearby } from '@/hooks/usePeopleNearby';
import type { NormalizedWave, NormalizedConversation, NormalizedMute, NormalizedBlock } from '@/hooks/useInteractionData';

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
  onWave: (toUserId: string) => void;
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
              placeId={placeId}
              sentWaves={sentWaves}
              receivedWaves={receivedWaves}
              conversations={conversations}
              activeMutes={activeMutes}
              blocks={blocks}
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
