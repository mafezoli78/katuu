import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWaves } from '@/hooks/useWaves';
import { usePresence } from '@/hooks/usePresence';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Check, X, Loader2, Inbox, Send, Hand, Briefcase, Users, Flame, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getSignedSelfieUrls } from '@/lib/storage';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { INTENTION_CONFIG, WaveIntention } from '@/hooks/useWaves';

type WaveDisplayStatus = 'pendente' | 'aceito' | 'recusado' | 'expirado';

interface SessionWave {
  id: string;
  criado_em: string;
  visualizado: boolean;
  expires_at: string | null;
  status: 'pending' | 'accepted' | 'expired';
  de_user_id: string;
  para_user_id: string;
  ignored_at?: string | null;
  intention?: WaveIntention;
  intention_message?: string | null;
  checkin_selfie_url?: string | null;
  profile: {
    nome: string | null;
    foto_url: string | null;
  };
}

const STATUS_BADGE: Record<WaveDisplayStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  aceito:   { label: 'Aceito',   className: 'bg-katu-green/15 text-katu-green' },
  recusado: { label: 'Recusado', className: 'bg-destructive/10 text-destructive' },
  expirado: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

export default function Waves() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentPlace, currentPresence } = usePresence();
  const {
    markAsRead,
    markAllAsRead,
    unreadCount,
    acceptWave,
    ignoreWave,
  } = useWaves();

  const [receivedSession, setReceivedSession] = useState<SessionWave[]>([]);
  const [sentSession, setSentSession] = useState<SessionWave[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingWaveId, setProcessingWaveId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  /**
   * Status de exibição por item.
   * Visão do DESTINATÁRIO: expired + ignored_at = "Recusado" (ação dele).
   * Visão do REMETENTE: recusa aparece como "Expirado" — mantém a suavização
   * existente (a pessoa fica "indisponível", nunca "te recusou").
   */
  const getDisplayStatus = useCallback((wave: SessionWave, perspective: 'received' | 'sent'): WaveDisplayStatus => {
    const now = new Date();
    if (wave.status === 'accepted') return 'aceito';
    if (wave.status === 'expired') {
      return perspective === 'received' && wave.ignored_at ? 'recusado' : 'expirado';
    }
    if (wave.expires_at && new Date(wave.expires_at) <= now) return 'expirado';
    return 'pendente';
  }, []);

  const fetchSessionWaves = useCallback(async () => {
    if (!user || !currentPlace?.id) {
      setReceivedSession([]);
      setSentSession([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Sessão = desde o início da presença atual (fallback: teto de 2h)
      const sessionStart =
        (currentPresence as any)?.inicio ||
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('waves')
        .select('*')
        .or(`de_user_id.eq.${user.id},para_user_id.eq.${user.id}`)
        .eq('place_id', currentPlace.id)
        .gte('criado_em', sessionStart)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      const rows = (data as any[]) || [];
      const received = rows.filter(w => w.para_user_id === user.id);
      const sent = rows.filter(w => w.de_user_id === user.id);

      // Enriquecimento: perfil do outro usuário (+ selfie do remetente nos recebidos)
      const enrich = async (waves: any[], otherIdKey: 'de_user_id' | 'para_user_id', withSelfie: boolean): Promise<SessionWave[]> => {
        const result: SessionWave[] = [];
        for (const wave of waves) {
          const otherId = wave[otherIdKey];
          const [profileRes, presenceRes] = await Promise.all([
            supabase.from('profiles').select('nome, foto_url').eq('id', otherId).single(),
            withSelfie
              ? supabase.from('presence').select('checkin_selfie_url').eq('user_id', otherId).eq('ativo', true).maybeSingle()
              : Promise.resolve({ data: null } as any),
          ]);

          let selfieUrl: string | null = presenceRes.data?.checkin_selfie_url || null;
          if (selfieUrl && !selfieUrl.startsWith('http')) {
            const signed = await getSignedSelfieUrls([selfieUrl]);
            selfieUrl = signed.get(selfieUrl) || null;
          }

          if (profileRes.data) {
            result.push({
              id: wave.id,
              criado_em: wave.criado_em,
              visualizado: wave.visualizado,
              expires_at: wave.expires_at,
              status: wave.status,
              de_user_id: wave.de_user_id,
              para_user_id: wave.para_user_id,
              ignored_at: wave.ignored_at ?? null,
              intention: wave.intention || 'open',
              intention_message: wave.intention_message || null,
              checkin_selfie_url: selfieUrl,
              profile: profileRes.data,
            });
          }
        }
        return result;
      };

      const [receivedEnriched, sentEnriched] = await Promise.all([
        enrich(received, 'de_user_id', true),
        enrich(sent, 'para_user_id', false),
      ]);

      setReceivedSession(receivedEnriched);
      setSentSession(sentEnriched);
    } catch (error) {
      console.error('[Waves] Erro ao buscar acenos da sessão:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentPlace?.id, currentPresence]);

  useEffect(() => {
    fetchSessionWaves();
  }, [fetchSessionWaves]);

  // Realtime: status dos acenos muda ao vivo (ex: "Aguardando" → "Aceito"
  // enquanto a página está aberta). DELETEs chegam só com PK (RLS) e são
  // raros em waves — o refetch no retorno à página cobre esse caso.
  useEffect(() => {
    if (!user?.id || !currentPlace?.id) return;
    const channel = supabase
      .channel(`waves-session-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waves' }, (payload) => {
        // DELETE chega só com a PK (RLS) — refetch incondicional; a query
        // é escopada à sessão, então o custo é mínimo
        if (payload.eventType === 'DELETE') {
          fetchSessionWaves();
          return;
        }
        const r = payload.new as any;
        if (r?.de_user_id === user.id || r?.para_user_id === user.id) {
          fetchSessionWaves();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, currentPlace?.id, fetchSessionWaves]);

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const formatExpiration = (wave: SessionWave) => {
    if (wave.status !== 'pending' || !wave.expires_at) return null;
    const expires = new Date(wave.expires_at);
    if (expires <= new Date()) return null;
    return `Expira ${formatDistanceToNow(expires, { addSuffix: true, locale: ptBR })}`;
  };

  const handleAcceptWave = async (wave: SessionWave) => {
    setProcessingWaveId(wave.id);

    const { error, conversation } = await acceptWave(wave.id);

    if (error) {
      toast({
        title: 'Erro ao aceitar aceno',
        description: error.message,
        variant: 'destructive'
      });
      // Estado pode ter mudado no banco (expirou, remetente saiu) — ressincroniza
      fetchSessionWaves();
      setProcessingWaveId(null);
    } else if (conversation) {
      // Navega diretamente ao chat sem toast
      navigate(`/chat?conversationId=${conversation.id}`);
    }
  };

  const handleIgnoreWave = async (waveId: string) => {
    await ignoreWave(waveId);
    // Item não some: vira "Recusado" na lista da sessão
    setReceivedSession(prev => prev.map(w =>
      w.id === waveId
        ? { ...w, status: 'expired' as const, ignored_at: new Date().toISOString(), visualizado: true }
        : w
    ));
    toast({ title: 'Aceno ignorado' });
  };

  const pendingReceived = receivedSession.filter(w => getDisplayStatus(w, 'received') === 'pendente');
  const pendingSent = sentSession.filter(w => getDisplayStatus(w, 'sent') === 'pendente');

  const intentionIconFor = (intention?: WaveIntention) =>
    intention === 'professional' ? Briefcase
    : intention === 'social' ? Users
    : intention === 'connection' ? Flame
    : Hand;

  // Sem presença ativa: acenos são da sessão, então orienta a entrar num local
  if (!currentPlace?.id) {
    return (
      <MobileLayout>
        <div className="p-4 page-fade">
          <div className="flex items-center gap-2 mb-4">
            <HandshakeIcon className="h-6 w-6 text-katu-blue" />
            <h1 className="text-xl font-bold">Acenos</h1>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Você não está em nenhum local</p>
              <p className="text-sm text-muted-foreground mt-1">
                Os acenos acontecem dentro de uma sessão. Entre em um local para acenar e receber acenos.
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HandshakeIcon className="h-6 w-6 text-katu-blue" />
            <h1 className="text-xl font-bold">Acenos</h1>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-9 rounded-lg text-sm">
              <Eye className="h-4 w-4 mr-1.5" />
              Marcar como lidos
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Acenos da sua sessão em {currentPlace.nome}
        </p>

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="w-full h-11 rounded-xl bg-muted/50 p-1">
            <TabsTrigger
              value="received"
              className="flex-1 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Inbox className="h-4 w-4 mr-1.5" />
              Recebidos {pendingReceived.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 bg-accent text-accent-foreground h-5 min-w-5 text-xs">
                  {pendingReceived.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="sent"
              className="flex-1 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Enviados
              {pendingSent.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 bg-muted text-muted-foreground h-5 min-w-5 text-xs">
                  {pendingSent.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-katu-blue" />
                <p className="text-muted-foreground text-sm mt-3">Carregando...</p>
              </div>
            ) : receivedSession.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <HandshakeIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Nenhum aceno recebido nesta sessão</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quando alguém acenar para você, aparecerá aqui
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {receivedSession.map((wave) => {
                  const displayStatus = getDisplayStatus(wave, 'received');
                  const badge = STATUS_BADGE[displayStatus];
                  const isPending = displayStatus === 'pendente';
                  const expiration = formatExpiration(wave);
                  const isProcessing = processingWaveId === wave.id;
                  const IntentionIcon = intentionIconFor(wave.intention);

                  return (
                    <Card
                      key={wave.id}
                      className={`border-0 shadow-sm overflow-hidden ${isPending && !wave.visualizado ? 'ring-2 ring-accent/50' : ''} ${!isPending ? 'opacity-80' : ''}`}
                      onClick={() => isPending && !wave.visualizado && markAsRead(wave.id)}
                    >
                      <CardContent className="p-0">
                        <div className="flex">
                          {/* FOTO — clicável para ampliar */}
                          <div
                            className="w-[36%] flex items-center p-2.5 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); if (wave.checkin_selfie_url) setPhotoModal(wave.checkin_selfie_url); }}
                          >
                            {wave.checkin_selfie_url ? (
                              <img src={wave.checkin_selfie_url} alt={wave.profile.nome || ''} className="w-full aspect-square object-cover rounded-lg" />
                            ) : (
                              <div className="w-full aspect-square flex items-center justify-center font-bold text-xl bg-muted text-muted-foreground rounded-lg">
                                {wave.profile.nome?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>

                          {/* CONTEÚDO */}
                          <div className="flex-1 flex flex-col justify-between p-4">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-base">{wave.profile.nome}</div>
                                <Badge variant="secondary" className={`rounded-lg text-xs shrink-0 ${badge.className}`}>
                                  {badge.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <IntentionIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-foreground">{INTENTION_CONFIG[wave.intention || 'open']?.label}</span>
                              </div>
                              {wave.intention_message && (
                                <p className="text-sm text-muted-foreground italic mt-1">"{wave.intention_message}"</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTime(wave.criado_em)}
                              </p>
                              {expiration && (
                                <p className="text-xs text-muted-foreground">{expiration}</p>
                              )}
                            </div>
                            {isPending && (
                              <div className="flex gap-2 mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-9 rounded-xl"
                                  onClick={(e) => { e.stopPropagation(); handleIgnoreWave(wave.id); }}
                                  disabled={isProcessing}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Ignorar
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 h-9 rounded-xl bg-katu-green hover:bg-katu-green/90 text-white"
                                  onClick={(e) => { e.stopPropagation(); handleAcceptWave(wave); }}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                  Aceitar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-katu-blue" />
                <p className="text-muted-foreground text-sm mt-3">Carregando...</p>
              </div>
            ) : sentSession.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Você ainda não acenou nesta sessão</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Acene para pessoas próximas para iniciar uma conexão
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sentSession.map((wave) => {
                  const displayStatus = getDisplayStatus(wave, 'sent');
                  const badge = STATUS_BADGE[displayStatus];
                  const expiration = formatExpiration(wave);
                  const IntentionIcon = intentionIconFor(wave.intention);

                  return (
                    <Card key={wave.id} className={`border-0 shadow-sm ${displayStatus !== 'pendente' && displayStatus !== 'aceito' ? 'opacity-80' : ''}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg overflow-hidden ring-2 ring-background shadow bg-katu-blue flex items-center justify-center shrink-0">
                          {wave.profile.foto_url ? (
                            <img src={wave.profile.foto_url} alt={wave.profile.nome || ''} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-white font-semibold">
                              {wave.profile.nome?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">Você acenou para {wave.profile.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <IntentionIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-xs text-muted-foreground">{INTENTION_CONFIG[wave.intention || 'open']?.label}</span>
                            <span className="text-xs text-muted-foreground">• {formatTime(wave.criado_em)}</span>
                          </div>
                          {expiration && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {expiration}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className={`rounded-lg shrink-0 ${badge.className}`}>
                          {displayStatus === 'pendente' ? 'Aguardando' : badge.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {/* Dialog ampliação de selfie */}
      <Dialog open={!!photoModal} onOpenChange={(v) => !v && setPhotoModal(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
          {photoModal && (
            <img src={photoModal} alt="Selfie" className="w-full object-cover" />
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
