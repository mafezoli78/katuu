import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWaves } from '@/hooks/useWaves';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Check, X, Loader2, Inbox, Send, Hand, Briefcase, Users, Flame } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getSignedSelfieUrls } from '@/lib/storage';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { INTENTION_CONFIG, WaveIntention } from '@/hooks/useWaves';

interface WaveWithProfile {
  id: string;
  criado_em: string;
  visualizado: boolean;
  expires_at: string | null;
  status: 'pending' | 'accepted' | 'expired';
  de_user_id: string;
  intention?: WaveIntention;
  intention_message?: string | null;
  checkin_selfie_url?: string | null;
  profile: {
    nome: string | null;
    foto_url: string | null;
  };
  location: {
    nome: string;
  };
}

export default function Waves() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    receivedWaves,
    sentWaves,
    markAsRead,
    markAllAsRead,
    unreadCount,
    acceptWave,
    ignoreWave
  } = useWaves();
  const [receivedWithProfiles, setReceivedWithProfiles] = useState<WaveWithProfile[]>([]);
  const [sentWithProfiles, setSentWithProfiles] = useState<WaveWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingWaveId, setProcessingWaveId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!receivedWaves.length && !sentWaves.length) {
        setReceivedWithProfiles([]);
        setSentWithProfiles([]);
        setLoading(false);
        return;
      }

      const receivedData: WaveWithProfile[] = [];
      for (const wave of receivedWaves) {
        const [profileRes, locationRes, presenceRes] = await Promise.all([
          supabase.from('profiles').select('nome, foto_url').eq('id', wave.de_user_id).single(),
          supabase.from('locations').select('nome').eq('id', wave.location_id).maybeSingle(),
          supabase.from('presence').select('checkin_selfie_url').eq('user_id', wave.de_user_id).eq('ativo', true).maybeSingle()
        ]);

        let locationName = locationRes.data?.nome;
        if (!locationName) {
          const placeRes = await supabase.from('places').select('nome').eq('id', wave.location_id).maybeSingle();
          locationName = placeRes.data?.nome || 'Local desconhecido';
        }

        // Resolve signed URL da selfie
        let selfieUrl: string | null = presenceRes.data?.checkin_selfie_url || null;
        if (selfieUrl && !selfieUrl.startsWith('http')) {
          const signed = await getSignedSelfieUrls([selfieUrl]);
          selfieUrl = signed.get(selfieUrl) || null;
        }

        if (profileRes.data) {
          receivedData.push({
            id: wave.id,
            criado_em: wave.criado_em,
            visualizado: wave.visualizado,
            expires_at: wave.expires_at,
            status: wave.status,
            de_user_id: wave.de_user_id,
            intention: (wave as any).intention || 'open',
            intention_message: (wave as any).intention_message || null,
            checkin_selfie_url: selfieUrl,
            profile: profileRes.data,
            location: { nome: locationName }
          });
        }
      }
      setReceivedWithProfiles(receivedData);

      const sentData: WaveWithProfile[] = [];
      for (const wave of sentWaves) {
        const [profileRes, locationRes] = await Promise.all([
          supabase.from('profiles').select('nome, foto_url').eq('id', wave.para_user_id).single(),
          supabase.from('locations').select('nome').eq('id', wave.location_id).maybeSingle()
        ]);

        let locationName = locationRes.data?.nome;
        if (!locationName) {
          const placeRes = await supabase.from('places').select('nome').eq('id', wave.location_id).maybeSingle();
          locationName = placeRes.data?.nome || 'Local desconhecido';
        }

        if (profileRes.data) {
          sentData.push({
            id: wave.id,
            criado_em: wave.criado_em,
            visualizado: wave.visualizado,
            expires_at: wave.expires_at,
            status: wave.status,
            de_user_id: wave.de_user_id,
            profile: profileRes.data,
            location: { nome: locationName }
          });
        }
      }
      setSentWithProfiles(sentData);
      setLoading(false);
    };

    fetchProfiles();
  }, [receivedWaves, sentWaves]);

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    if (expires <= now) return 'Expirado';
    return `Expira ${formatDistanceToNow(expires, { addSuffix: true, locale: ptBR })}`;
  };

  const handleAcceptWave = async (wave: WaveWithProfile) => {
    setProcessingWaveId(wave.id);

    const { error, conversation } = await acceptWave(wave.id);

    if (error) {
      toast({
        title: 'Erro ao aceitar aceno',
        description: error.message,
        variant: 'destructive'
      });
      setProcessingWaveId(null);
    } else if (conversation) {
      // Navega diretamente ao chat sem toast
      navigate(`/chat?conversationId=${conversation.id}`);
    }
  };

  const handleIgnoreWave = async (waveId: string) => {
    await ignoreWave(waveId);
    setReceivedWithProfiles(prev => prev.filter(w => w.id !== waveId));
    toast({ title: 'Aceno ignorado' });
  };

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

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="w-full h-11 rounded-xl bg-muted/50 p-1">
            <TabsTrigger
              value="received"
              className="flex-1 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Inbox className="h-4 w-4 mr-1.5" />
              Recebidos {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 bg-accent text-accent-foreground h-5 min-w-5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="sent"
              className="flex-1 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Enviados
              {sentWaves.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 bg-muted text-muted-foreground h-5 min-w-5 text-xs">
                  {sentWaves.length}
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
            ) : receivedWithProfiles.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <HandshakeIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Nenhum aceno recebido ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quando alguém acenar para você, aparecerá aqui
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {receivedWithProfiles.map((wave) => {
                  const expiration = formatExpiration(wave.expires_at);
                  const isProcessing = processingWaveId === wave.id;

                  const IntentionIcon = wave.intention === 'open' ? Hand
                    : wave.intention === 'professional' ? Briefcase
                    : wave.intention === 'social' ? Users
                    : Flame;

                  return (
                    <Card
                      key={wave.id}
                      className={`border-0 shadow-sm overflow-hidden ${!wave.visualizado ? 'ring-2 ring-accent/50' : ''}`}
                      onClick={() => !wave.visualizado && markAsRead(wave.id)}
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
                              <div className="flex items-start justify-between">
                                <div className="font-semibold text-base">{wave.profile.nome}</div>
                                {!wave.visualizado && (
                                  <span className="h-3 w-3 rounded-full bg-accent animate-pulse mt-1" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <IntentionIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-foreground">{INTENTION_CONFIG[wave.intention || 'open']?.label}</span>
                              </div>
                              {wave.intention_message && (
                                <p className="text-sm text-muted-foreground italic mt-1">"{wave.intention_message}"</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {wave.location.nome} • {formatTime(wave.criado_em)}
                              </p>
                              {expiration && (
                                <p className="text-xs text-muted-foreground">{expiration}</p>
                              )}
                            </div>
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
            ) : sentWithProfiles.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Você ainda não acenou para ninguém</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Acene para pessoas próximas para iniciar uma conexão
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sentWithProfiles.map((wave) => {
                  const expiration = formatExpiration(wave.expires_at);

                  return (
                    <Card key={wave.id} className="border-0 shadow-sm">
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
                          <p className="text-sm text-muted-foreground">
                            em {wave.location.nome} • {formatTime(wave.criado_em)}
                          </p>
                          {expiration && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {expiration}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground rounded-lg">
                          Aguardando
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
