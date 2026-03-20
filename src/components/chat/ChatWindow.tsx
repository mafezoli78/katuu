import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { ConversationWithDetails } from '@/hooks/useConversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Loader2, AlertCircle, MoreVertical, Flag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportModal } from '@/components/shared/ReportModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Alturas fixas — mesmas usadas pelo BottomNav (h-16 = 64px) e este header (p-4 + avatar = 73px)
const HEADER_HEIGHT = 73;
const NAV_HEIGHT = 64;
const INPUT_HEIGHT = 72;

interface ChatWindowProps {
  conversation: ConversationWithDetails;
  onClose: () => void;
  onEndChat: () => void;
}

export function ChatWindow({ conversation, onClose, onEndChat }: ChatWindowProps) {
  const { user } = useAuth();
  const { messages, loading, sending, sendMessage } = useMessages(conversation.id);
  const [inputValue, setInputValue] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [show, setShow] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    const content = inputValue;
    setInputValue('');
    const { error } = await sendMessage(content);
    if (error) setInputValue(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndChat = () => {
    if (showEndConfirm) {
      onEndChat();
    } else {
      setShowEndConfirm(true);
      setTimeout(() => setShowEndConfirm(false), 3000);
    }
  };

  const momentPhoto = conversation.otherUser.checkin_selfie_url;

  return (
    <>
      {/* Header fixo no topo */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 border-b bg-card"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 -ml-2" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 rounded-lg">
            <AvatarImage src={momentPhoto || undefined} className="rounded-lg" />
            <AvatarFallback className="bg-secondary text-secondary-foreground rounded-lg">
              {conversation.otherUser.nome?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{conversation.otherUser.nome || 'Usuário'}</p>
            <p className="text-xs text-muted-foreground">{conversation.place.nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={showEndConfirm ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleEndChat}
          >
            {showEndConfirm ? (
              <>
                <AlertCircle className="h-4 w-4 mr-1" />
                Confirmar
              </>
            ) : (
              'Encerrar'
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShow(true)}
              >
                <Flag className="h-4 w-4 mr-2" />
                Denunciar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Área de mensagens — entre header e input */}
      <div
        className="fixed left-0 right-0 overflow-y-auto p-4"
        style={{
          top: HEADER_HEIGHT,
          bottom: NAV_HEIGHT + INPUT_HEIGHT,
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Diga olá para iniciar a conversa! 👋</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary/80 text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.conteudo}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(message.criado_em), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input fixo acima do nav */}
      <div
        className="fixed left-0 right-0 px-4 border-t bg-card flex items-center"
        style={{
          bottom: NAV_HEIGHT,
          height: INPUT_HEIGHT,
        }}
      >
        <div className="flex items-center gap-2 w-full">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={sending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <ReportModal
  open={showReportModal}
  onClose={() => setShowReportModal(false)}
  reportedUserId={conversation.otherUser.id}
  reportedUserName={conversation.otherUser.nome || 'Usuário'}
  contexto="chat"
  conversationId={conversation.id}
  onChatEnd={onEndChat}
/>
    </>
  );
}
