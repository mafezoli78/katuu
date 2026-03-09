import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Clock, RefreshCw, LogOut, Store } from 'lucide-react';
import { TemporaryPlaceIcon } from '@/components/icons/TemporaryPlaceIcon';

interface PresenceStatusCardProps {
  placeName: string;
  isTemporary: boolean;
  formatRemainingTime: () => string;
  renewPresence: () => Promise<{ error: any }>;
  deactivatePresence: () => void;
}

export function PresenceStatusCard({
  placeName,
  isTemporary,
  formatRemainingTime,
  renewPresence,
  deactivatePresence,
}: PresenceStatusCardProps) {
  const { toast } = useToast();

  const handleRenew = useCallback(async () => {
    const { error } = await renewPresence();
    if (!error) {
      toast({ title: 'Presença renovada', description: 'Mais 60 minutos neste local' });
    }
  }, [renewPresence, toast]);

  return (
    <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 shadow-lg overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTemporary ? 'bg-katu-green/20' : 'bg-white/20'}`}>
              {isTemporary ? (
                <TemporaryPlaceIcon className="h-5 w-5 text-white" />
              ) : (
                <Store className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">{placeName}</h2>
              <div className="flex items-center gap-2 mt-1">
                {isTemporary && (
                  <Badge variant="secondary" className="bg-katu-green/20 text-white border-0 text-xs">
                    Temporário
                  </Badge>
                )}
                <span className="text-xs text-white/70 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRemainingTime()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRenew}
            className="flex-1 h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white border-0"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Renovar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 rounded-lg bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Sair
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair do local?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao sair, suas conversas e acenos deste local serão apagados permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ficar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deactivatePresence}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sair do local
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
