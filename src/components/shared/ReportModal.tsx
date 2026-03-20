import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import { MOTIVOS, useReport } from '@/hooks/useReport';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  contexto: 'chat' | 'home';
  conversationId?: string;
  onChatEnd?: () => void;
}

export function ReportModal({
  open,
  onClose,
  reportedUserId,
  reportedUserName,
  contexto,
  conversationId,
  onChatEnd,
}: ReportModalProps) {
  const [selectedMotivo, setSelectedMotivo] = useState<string | null>(null);
  const { sendReport, loading } = useReport();

  const handleConfirm = async () => {
    if (!selectedMotivo) return;
    await sendReport({
      reportedUserId,
      motivo: selectedMotivo,
      contexto,
      conversationId,
      onChatEnd,
    });
    setSelectedMotivo(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedMotivo(null); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Denunciar {reportedUserName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Selecione o motivo da denúncia:
        </p>

        <div className="flex flex-col gap-2">
          {MOTIVOS.map((motivo) => (
            <button
              key={motivo.value}
              onClick={() => setSelectedMotivo(motivo.value)}
              className={`px-4 py-3 rounded-xl text-sm text-left font-medium transition-all ${
                selectedMotivo === motivo.value
                  ? 'bg-destructive/10 text-destructive border border-destructive/30'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {motivo.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="ghost" onClick={() => { setSelectedMotivo(null); onClose(); }}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!selectedMotivo || loading} onClick={handleConfirm}>
            {loading ? 'Enviando...' : 'Enviar denúncia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
