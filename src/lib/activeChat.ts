/**
 * Registro global de qual conversa está aberta na tela agora.
 * Usado pelo GlobalNotifications para NÃO notificar mensagens da conversa
 * que o usuário já está vendo. ChatWindow registra ao montar/desmontar.
 */
let activeChatId: string | null = null;

export const setActiveChatId = (id: string | null) => {
  activeChatId = id;
};

export const getActiveChatId = () => activeChatId;
