import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, Message, MESSAGE_EDIT_WINDOW_MS } from '@/hooks/useMessages';
import { ConversationWithDetails } from '@/hooks/useConversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Send, Loader2, AlertCircle, MoreVertical, Flag, Pencil, Trash2, X, Ban,
  ThumbsUp, Heart, Laugh, Frown, PartyPopper, HeartHandshake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Reações: o banco guarda o emoji (valor canônico); a UI renderiza ícones
 * Lucide outline (strokeWidth 1.5), na linguagem visual do app.
 */
const REACTIONS: { emoji: string; Icon: LucideIcon; label: string }[] = [
  { emoji: '👍', Icon: ThumbsUp,       label: 'Curtir' },
  { emoji: '❤️', Icon: Heart,          label: 'Amei' },
  { emoji: '😂', Icon: Laugh,          label: 'Haha' },
  { emoji: '😢', Icon: Frown,          label: 'Triste' },
  { emoji: '🎉', Icon: PartyPopper,    label: 'Festejar' },
  { emoji: '🙏', Icon: HeartHandshake, label: 'Agradecer' },
];

const reactionIconFor = (emoji: string): LucideIcon | null =>
  REACTIONS.find(r => r.emoji === emoji)?.Icon ?? null;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ReportModal } from '@/components/shared/ReportModal';
import { setActiveChatId } from '@/lib/activeChat';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatWindowProps {
  conversation: ConversationWithDetails;
  onClose: () => void;
  onEndChat: () => void;
}

export function ChatWindow({ conversation, onClose, onEndChat }: ChatWindowProps) {
  const { user } = useAuth();
  const {
    messages,
    reactions,
    loading,
    sending,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  } = useMessages(conversation.id);
  const [inputValue, setInputValue] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Registra a conversa aberta: o GlobalNotifications não notifica
  // mensagens da conversa que o usuário já está vendo
  useEffect(() => {
    setActiveChatId(conversation.id);
    return () => setActiveChatId(null);
  }, [conversation.id]);

  const canModify = (message: Message) =>
    message.sender_id === user?.id &&
    !message.deletado_em &&
    Date.now() - new Date(message.criado_em).getTime() < MESSAGE_EDIT_WINDOW_MS;

  // Long-press (450ms) abre o menu de ações da mensagem
  const startPress = (message: Message) => {
    if (message.deletado_em) return;
    pressTimerRef.current = setTimeout(() => setActionMessage(message), 450);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;
    const content = inputValue;
    setInputValue('');

    if (editingMessage) {
      const target = editingMessage;
      setEditingMessage(null);
      const { error } = await editMessage(target.id, content);
      if (error) {
        toast({ title: error.message, variant: 'destructive' });
        setEditingMessage(target);
        setInputValue(content);
      }
      return;
    }

    const { error } = await sendMessage(content);
    if (error) setInputValue(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartEdit = (message: Message) => {
    setActionMessage(null);
    setEditingMessage(message);
    setInputValue(message.conteudo);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputValue('');
  };

  const handleDelete = async (message: Message) => {
    setActionMessage(null);
    const { error } = await deleteMessage(message.id);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    }
  };

  const handleReact = (message: Message, emoji: string) => {
    setActionMessage(null);
    toggleReaction(message.id, emoji);
  };

  const handleEndChat = () => {
    if (showEndConfirm) {
      onEndChat();
    } else {
      setShowEndConfirm(true);
      setTimeout(() => setShowEndConfirm(false), 3000);
    }
  };

  const myReactionFor = (messageId: string) =>
    reactions.find(r => r.message_id === messageId && r.user_id === user?.id);

  const reactionChipsFor = (messageId: string) => {
    const msgReactions = reactions.filter(r => r.message_id === messageId);
    const grouped = new Map<string, { count: number; mine: boolean }>();
    for (const r of msgReactions) {
      const entry = grouped.get(r.emoji) || { count: 0, mine: false };
      entry.count += 1;
      if (r.user_id === user?.id) entry.mine = true;
      grouped.set(r.emoji, entry);
    }
    return Array.from(grouped.entries());
  };

  const momentPhoto = conversation.otherUser.checkin_selfie_url;

  return (
    <>
      {/* Header fixo no topo — respeita safe-area-inset-top */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-end justify-between px-4 pb-3 border-b bg-card pt-safe"
        style={{ minHeight: 'calc(64px + var(--safe-area-inset-top))' }}
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
                onClick={() => setShowReportModal(true)}
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
          top: 'calc(64px + var(--safe-area-inset-top))',
          bottom: 'calc(136px + var(--safe-area-inset-bottom))',
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
              const isDeleted = !!message.deletado_em;
              const chips = reactionChipsFor(message.id);

              return (
                <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 select-none ${
                      isOwn
                        ? 'bg-primary/80 text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    } ${isDeleted ? 'opacity-70' : ''}`}
                    onTouchStart={() => startPress(message)}
                    onTouchEnd={cancelPress}
                    onTouchMove={cancelPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!isDeleted) setActionMessage(message);
                    }}
                  >
                    {isDeleted ? (
                      <p className={`text-sm italic flex items-center gap-1.5 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        <Ban className="h-3.5 w-3.5" />
                        Mensagem apagada
                      </p>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.conteudo}</p>
                    )}
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(message.criado_em), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                      {message.editado_em && !isDeleted && ' · editado'}
                    </p>
                  </div>

                  {/* Reações da mensagem */}
                  {chips.length > 0 && (
                    <div className={`flex gap-1 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                      {chips.map(([emoji, info]) => {
                        const ChipIcon = reactionIconFor(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(message.id, emoji)}
                            className={`text-xs rounded-full px-2 py-1 border bg-card shadow-sm flex items-center gap-1 ${
                              info.mine ? 'border-accent text-accent' : 'border-border text-muted-foreground'
                            }`}
                          >
                            {ChipIcon
                              ? <ChipIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                              : <span>{emoji}</span>}
                            {info.count > 1 && <span>{info.count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Banner de edição — acima do input */}
      {editingMessage && (
        <div
          className="fixed left-0 right-0 px-4 py-2 bg-muted border-t flex items-center justify-between z-10"
          style={{ bottom: 'calc(136px + var(--safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Editando: {editingMessage.conteudo}</span>
          </div>
          <button onClick={handleCancelEdit} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input fixo acima do nav — respeita safe-area-inset-bottom */}
      <div
        className="fixed left-0 right-0 px-4 border-t bg-card flex items-center"
        style={{
          bottom: 'calc(64px + var(--safe-area-inset-bottom))',
          height: 72,
        }}
      >
        <div className="flex items-center gap-2 w-full">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={editingMessage ? 'Edite sua mensagem...' : 'Digite sua mensagem...'}
            disabled={sending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Menu de ações da mensagem (long-press) */}
      <Dialog open={!!actionMessage} onOpenChange={(v) => !v && setActionMessage(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogTitle className="sr-only">Ações da mensagem</DialogTitle>

          {actionMessage && (
            <>
              {/* Reações — ícones outline na linguagem do app */}
              <div className="flex justify-between px-1">
                {REACTIONS.map(({ emoji, Icon, label }) => {
                  const isMine = myReactionFor(actionMessage.id)?.emoji === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReact(actionMessage, emoji)}
                      aria-label={label}
                      className={`p-2.5 rounded-xl transition-all hover:bg-muted ${
                        isMine ? 'bg-accent/15 ring-1 ring-accent text-accent' : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>

              {/* Editar/Apagar — só mensagens próprias dentro da janela de 15 min */}
              {canModify(actionMessage) && (
                <div className="flex flex-col gap-1 border-t pt-3 mt-1">
                  <button
                    onClick={() => handleStartEdit(actionMessage)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-medium text-left"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    Editar mensagem
                  </button>
                  <button
                    onClick={() => handleDelete(actionMessage)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-medium text-destructive text-left"
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar mensagem
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={conversation.otherUser.id}
        reportedUserName={conversation.otherUser.nome || 'Usuário'}
        contexto="chat"
        conversationId={conversation.id}
        placeId={conversation.place_id}
        onChatEnd={onEndChat}
      />
    </>
  );
}
