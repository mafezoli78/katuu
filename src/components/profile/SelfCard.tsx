import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Camera, Pencil, Eye } from 'lucide-react';
import { CheckinSelfie } from '@/components/location/CheckinSelfie';
import { getSignedSelfieUrls } from '@/lib/storage';
import { calculateAge } from '@/utils/date';
import { toast } from '@/components/ui/use-toast';

interface PresenceCardData {
  presence_id: string;
  place_id: string;
  place_nome: string;
  assunto_atual: string | null;
  checkin_selfie_url: string | null;
}

/**
 * Card do próprio usuário no local atual — visual idêntico ao PersonCard
 * que os outros veem, com ações de edição: trocar a selfie do check-in e
 * editar o "Seu momento". Renderiza null sem presença ativa.
 */
export function SelfCard() {
  const { user } = useAuth();
  const { profile } = useProfile();

  const [card, setCard] = useState<PresenceCardData | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [momentoOpen, setMomentoOpen] = useState(false);
  const [momentoText, setMomentoText] = useState('');
  const [savingMomento, setSavingMomento] = useState(false);

  const [selfieOpen, setSelfieOpen] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const fetchCard = useCallback(async () => {
    if (!user) {
      setCard(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('get_my_presence_card');
      if (error || !data) {
        setCard(null);
        return;
      }
      const c = data as PresenceCardData;
      setCard(c);
      setMomentoText(c.assunto_atual || '');

      let url = c.checkin_selfie_url;
      if (url && !url.startsWith('http')) {
        const signed = await getSignedSelfieUrls([url]);
        url = signed.get(url) || null;
      }
      setSelfieUrl(url);
    } catch (error) {
      console.error('[SelfCard] Erro ao buscar card:', error);
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  // Só existe card com presença ativa
  if (loading || !card || !profile) return null;

  const age = profile.data_nascimento ? calculateAge(profile.data_nascimento) : null;
  const firstName = profile.nome?.split(' ')[0] || profile.nome || '';
  const initials = profile.nome?.[0]?.toUpperCase() || '?';

  const genderLabel = profile.gender === 'other' && profile.gender_custom
    ? profile.gender_custom
    : profile.gender
      ? (profile.gender === 'man' ? 'Homem'
        : profile.gender === 'woman' ? 'Mulher'
        : profile.gender === 'non_binary' ? 'Não-binário'
        : 'Outro')
      : null;

  const momentoDisplay = card.assunto_atual || profile.bio || null;

  const handleSaveMomento = async () => {
    setSavingMomento(true);
    try {
      const { error } = await supabase.rpc('update_my_presence_card', {
        p_assunto_atual: momentoText.trim(),
      });
      if (error) throw error;
      setCard(prev => prev ? { ...prev, assunto_atual: momentoText.trim() || null } : prev);
      setMomentoOpen(false);
      toast({ title: 'Momento atualizado!' });
    } catch (error) {
      console.error('[SelfCard] Erro ao salvar momento:', error);
      toast({ title: 'Erro ao atualizar momento', variant: 'destructive' });
    } finally {
      setSavingMomento(false);
    }
  };

  const handleSelfieConfirm = async (blob: Blob, source: 'camera' | 'upload') => {
    if (!user) return;
    setUploadingSelfie(true);
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('checkin-selfies')
        .upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error: rpcError } = await supabase.rpc('update_my_presence_card', {
        p_selfie_url: fileName,
      });
      if (rpcError) throw rpcError;

      const signed = await getSignedSelfieUrls([fileName]);
      setSelfieUrl(signed.get(fileName) || null);
      setCard(prev => prev ? { ...prev, checkin_selfie_url: fileName } : prev);
      setSelfieOpen(false);
      toast({ title: 'Foto atualizada!' });
    } catch (error) {
      console.error('[SelfCard] Erro ao atualizar selfie:', error);
      toast({ title: 'Erro ao atualizar foto', variant: 'destructive' });
    } finally {
      setUploadingSelfie(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Cabeçalho do bloco */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Eye className="h-4 w-4 text-katu-blue" />
            <p className="text-sm font-semibold">Seu card em {card.place_nome}</p>
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            É assim que as pessoas estão te vendo neste local. Toque na foto ou no momento para editar.
          </p>

          {/* Card espelhando o PersonCard */}
          <div className="flex border-t">
            {/* FOTO — toque para trocar */}
            <div
              className="w-[36%] flex items-center p-2.5 cursor-pointer relative"
              onClick={() => setSelfieOpen(true)}
            >
              {selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt={profile.nome || ''}
                  className="w-full aspect-square object-cover rounded-lg"
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center font-bold text-xl bg-muted text-muted-foreground rounded-lg">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-3.5 right-3.5 bg-card rounded-full p-1.5 shadow border">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 flex flex-col p-4">
              <div className="font-semibold text-base">{firstName}</div>

              {(genderLabel || age !== null) && (
                <span className="inline-block w-fit text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1">
                  {genderLabel}
                  {genderLabel && age !== null && ' • '}
                  {age !== null && age}
                </span>
              )}

              {/* Momento — toque para editar */}
              <button
                className="text-left mt-1 group"
                onClick={() => {
                  setMomentoText(card.assunto_atual || '');
                  setMomentoOpen(true);
                }}
              >
                {momentoDisplay ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {momentoDisplay}
                    <Pencil className="inline h-3 w-3 ml-1.5 text-muted-foreground/60" />
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/70 italic flex items-center gap-1.5">
                    <Pencil className="h-3 w-3" />
                    Adicionar seu momento
                  </p>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editar momento */}
      <Dialog open={momentoOpen} onOpenChange={setMomentoOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogTitle className="text-base font-bold">Seu momento aqui</DialogTitle>
          <p className="text-sm text-muted-foreground -mt-1">
            O que as pessoas precisam saber sobre você aqui e agora?
          </p>
          <Textarea
            value={momentoText}
            onChange={(e) => setMomentoText(e.target.value.slice(0, 80))}
            placeholder="Ex: Aberto a conversar."
            className="min-h-[100px] rounded-xl resize-none"
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground text-right -mt-2">{momentoText.length}/80</p>
          <Button
            onClick={handleSaveMomento}
            disabled={savingMomento}
            className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            {savingMomento ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Trocar selfie — reusa o componente do check-in */}
      <Dialog open={selfieOpen} onOpenChange={(v) => !uploadingSelfie && setSelfieOpen(v)}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogTitle className="text-base font-bold">Trocar foto do momento</DialogTitle>
          <CheckinSelfie
            embedded
            onConfirm={handleSelfieConfirm}
            onCancel={() => setSelfieOpen(false)}
            uploading={uploadingSelfie}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
