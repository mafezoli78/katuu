import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/hooks/useChat';
import { usePresence } from '@/hooks/usePresence';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ConversationsList } from '@/components/chat/ConversationsList';
import { toast } from '@/components/ui/use-toast';
import { MessageCircle, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isKeyboardVisible = useKeyboardVisible();
  const conversationIdParam = searchParams.get('conversationId');

  const { presenceState, currentPresence, currentPlace, loading: presenceLoading } = usePresence();

  const {
    chatState,
    activeConversations,
    openChat,
    closeChat,
    endChat,
    clearEndedReason,
    refetchConversations,
    loading: chatLoading,
  } = useChat({ presenceState, currentPresence });

  const conversationIds = activeConversations.map((c) => c.id);
  const { unreadCounts, markAsRead } = useUnreadMessages(conversationIds);

  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  // Listener para reset ao clicar no ícone Chat do menu estando já em /chat
  useEffect(() => {
    const handleNavReset = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path === '/chat' && chatState.isActive) {
        closeChat();
      }
    };
    window.addEventListener('nav-reset', handleNavReset);
    return () => window.removeEventListener('nav-reset', handleNavReset);
  }, [chatState.isActive, closeChat]);

  useEffect(() => {
    if (!conversationIdParam || chatState.isActive) return;
    const targetConversation = activeConversations.find((c) => c.id === conversationIdParam);
    if (targetConversation) {
      markAsRead(targetConversation.id);
      openChat(targetConversation);
      setSearchParams({}, { replace: true });
    } else if (!chatLoading) {
      // Conversa ainda não carregada — força refetch
      refetchConversations();
    }
  }, [conversationIdParam, activeConversations, chatState.isActive, chatLoading, openChat, setSearchParams, markAsRead, refetchConversations]);

  const previousEndedRef = useRef<string | null>(null);

  useEffect(() => {
    const currentReason = chatState.endedReason;
    if (
      previousEndedRef.current === null &&
      currentReason &&
      currentReason !== 'system_suspended' &&
      chatState.wasEndedByMe
    ) {
      toast({
        title: 'Conversa encerrada por você',
        description: 'As mensagens foram apagadas',
      });
    }
    previousEndedRef.current = currentReason;
    if (currentReason === null) previousEndedRef.current = null;
  }, [chatState.endedReason, chatState.wasEndedByMe]);

  const handleEndChat = async () => {
    const { error } = await endChat('manual');
    if (error) {
      toast({
        title: 'Erro ao encerrar conversa',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleOpenChat = (conversation: typeof activeConversations[0]) => {
    markAsRead(conversation.id);
    openChat(conversation);
  };

  if (chatState.isActive && chatState.conversation) {
    return (
      <MobileLayout showHeader={false} showNav={!isKeyboardVisible}>
        <ChatWindow
          conversation={chatState.conversation}
          onClose={closeChat}
          onEndChat={handleEndChat}
        />
      </MobileLayout>
    );
  }

  // Mesma regra dos acenos: conversas só existem dentro de uma sessão.
  // Sem presença ativa, replica o estado vazio da página de Acenos.
  if (!presenceLoading && !currentPlace?.id) {
    return (
      <MobileLayout>
        <div className="p-4 page-fade">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5 text-katu-blue" />
            <h1 className="text-xl font-bold">Conversas</h1>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Você não está em nenhum local</p>
              <p className="text-sm text-muted-foreground mt-1">
                As conversas acontecem dentro de uma sessão. Entre em um local para conversar com pessoas próximas.
              </p>
              <Button onClick={() => navigate('/location')} className="mt-4 rounded-xl gap-2">
                <MapPin className="h-4 w-4" />
                Escolher local
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 page-fade">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-katu-blue" />
          <h1 className="text-xl font-bold">Conversas</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Conversas ativas com pessoas no mesmo local
        </p>

        {chatLoading || presenceLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-katu-blue" />
          </div>
        ) : activeConversations.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Nenhuma conversa ativa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando alguém aceitar seu aceno, a conversa aparecerá aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <ConversationsList
            conversations={activeConversations}
            onSelectConversation={handleOpenChat}
            unreadCounts={unreadCounts}
          />
        )}
      </div>
    </MobileLayout>
  );
}
