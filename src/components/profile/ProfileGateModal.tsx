import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';
import type { PendingAction } from '@/hooks/useProfileGate';

interface ProfileGateModalProps {
  open: boolean;
  onClose: () => void;
  pendingAction?: PendingAction;
}

export function ProfileGateModal({ open, onClose, pendingAction }: ProfileGateModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mb-2">
            <UserCircle className="h-7 w-7 text-accent" />
          </div>
          <DialogTitle className="text-lg">Complete seu perfil</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Para interagir com outras pessoas e se tornar visível nos locais, você precisa preencher seu nome, data de nascimento e interesses.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => {
              onClose();
              navigate('/onboarding', { state: pendingAction ? { pendingAction } : undefined });
            }}
            className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            Completar perfil
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full h-11 rounded-xl"
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
