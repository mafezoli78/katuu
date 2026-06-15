import { useState, useEffect, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, Clock, Users,
  VolumeX, Ban, ChevronLeft, Map, List,
  Store, RefreshCw, LogOut, AlertCircle, MessageCircle, X,
  Sparkles, Briefcase, Coffee, Heart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { INTENTION_CONFIG, WaveIntention } from '@/hooks/useWaves';
import katuuLogo from '@/assets/logo-katuu-oficial.png';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TUTORIAL_CHARACTERS } from './tutorialCharacters';

interface TutorialFlowProps {
  onComplete: () => void;
}

interface Character {
  name: string;
  age: number;
  photo: string;
  intention: string;
}

const CHARACTERS: Character[] = TUTORIAL_CHARACTERS;

// Ícones das quatro intenções do aceno (mesma linguagem outline do app)
const INTENTION_ICONS: Record<WaveIntention, LucideIcon> = {
  open: Sparkles,
  professional: Briefcase,
  social: Coffee,
  connection: Heart,
};

const FICTIONAL_PLACES = [
  { name: 'Café do Ponto', count: 3 },
  { name: 'Parque da Juventude', count: 1 },
  { name: 'Biblioteca Central', count: 0 },
];

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

function CharAvatar({ char, size = 'md', showBadge = false }: { char: Character; size?: 'sm' | 'md' | 'lg'; showBadge?: boolean }) {
  const sizes = { sm: 'w-10 h-10', md: 'w-20 h-20', lg: 'w-28 h-28' };
  return (
    <div className={`relative ${sizes[size]} rounded-xl overflow-hidden border-2 border-white shadow`}>
      <img src={char.photo} alt={char.name} className="w-full h-full object-cover" />
      {showBadge && (
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-katu-green rounded-full border-2 border-white" />
      )}
    </div>
  );
}

// Tooltip com seta configurável (top ou bottom)
function TooltipCallout({ text, onAction, arrowPosition = 'top' }: { text: string; onAction: () => void; arrowPosition?: 'top' | 'bottom' }) {
  return (
    <div className="bg-primary text-primary-foreground rounded-xl p-3 shadow-lg relative">
      {arrowPosition === 'top' && (
        <div className="absolute -top-2 right-6 w-4 h-4 bg-primary rotate-45" />
      )}
      <p className="text-sm leading-relaxed mb-2">{text}</p>
      <Button size="sm" style={{ backgroundColor: '#CBD5DA', color: '#1F3A5F' }} className="rounded-lg text-sm font-semibold w-full hover:opacity-90" onClick={onAction}>
        Ok, entendi
      </Button>
      {arrowPosition === 'bottom' && (
        <div className="absolute -bottom-2 right-6 w-4 h-4 bg-primary rotate-45" />
      )}
    </div>
  );
}

function StepFooter({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="sticky bottom-0 bg-background border-t border-border px-6 pt-4 pb-8 flex gap-3 safe-area-inset-bottom z-10">
      <Button variant="outline" onClick={onBack} className="flex-1 h-11 rounded-xl">
        Voltar
      </Button>
      <Button onClick={onNext} className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold">
        Continuar
      </Button>
    </div>
  );
}

// Step 0 — Tela inicial estilo login
function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#124854] to-[#1F3A5F]">
      
      {/* Container centralizado */}
      <div className="flex-1 flex items-center justify-center px-8">
        
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-5">
          <img src={katuuLogo} alt="Katuu" className="h-16 object-contain" />

          <h1 className="text-2xl font-bold text-white leading-tight">
            Seja bem-vindo
          </h1>

          <p className="text-white/70 text-base leading-relaxed">
            O Katuu mostra pessoas que estão no mesmo lugar que você, dispostas a conversar. Agora!
          </p>

          {/* Avatares */}
          <div className="flex justify-center gap-6">
            {CHARACTERS.map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-2">
                <CharAvatar char={c} size="lg" showBadge />
                <span className="text-sm text-white/70 font-medium">{c.name}</span>
              </div>
            ))}
          </div>

          {/* Botão */}
          <div className="w-full pt-4">
            <Button
              onClick={onNext}
              className="w-full py-3.5 rounded-2xl bg-accent text-accent-foreground font-semibold text-base shadow hover:bg-accent/90"
            >
              Iniciar
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Step 1 — Locais
function StepLocais({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [tooltipStep, setTooltipStep] = useState(0);
  const showOverlay = tooltipStep < 4;

  return (
    <div className="flex flex-col h-full relative">
      <div
        className="fixed inset-0 bg-black/50 z-[9] pointer-events-none transition-opacity duration-300"
        style={{ opacity: showOverlay ? 1 : 0 }}
      />

      <div className="px-6 pt-4 pb-3 relative flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Onde você está agora?</h2>
          <p className="text-muted-foreground text-sm mt-1">
            O Katuu detecta sua localização e mostra os estabelecimentos próximos.
          </p>
        </div>
        <div className={`flex items-center gap-0.5 bg-muted rounded-lg p-0.5 ml-3 flex-shrink-0 ${tooltipStep === 3 ? 'relative z-[10]' : ''}`}>
          <div className="rounded-md p-2 bg-card shadow-sm">
            <List className="h-4 w-4 text-foreground" />
          </div>
          <div className="rounded-md p-2">
            <Map className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 overflow-y-auto pb-4">
        <div className="space-y-2">
          {FICTIONAL_PLACES.map((p, i) => (
            <Card key={p.name} className={`border shadow-sm ${tooltipStep === 0 && i === 2 ? 'relative z-[10]' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.count > 0 ? (
                        <Badge variant="secondary" className="text-sm bg-katu-green/10 text-katu-green border-0">
                          <Users className="h-3 w-3 mr-1" />
                          {p.count} {p.count === 1 ? 'pessoa' : 'pessoas'}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Ninguém por aqui ainda</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg font-semibold px-4">
                    Aqui
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {tooltipStep === 0 && (
            <div className="relative z-[11] mt-2">
              <TooltipCallout
                text="Ao tocar em Aqui você registrará sua presença neste local e ficará visível para quem também estiver lá."
                onAction={() => setTooltipStep(1)}
              />
            </div>
          )}

          <div className={`pt-4 border-t border-border space-y-3 ${tooltipStep === 1 ? 'relative z-[10]' : ''}`}>
            <p className="text-sm text-muted-foreground">Não encontrou? Busque por nome:</p>
            <div className="flex gap-2">
              <Input placeholder="Nome do local..." className="flex-1 h-11 rounded-xl bg-card" readOnly />
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl">
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {tooltipStep === 1 && (
            <div className="relative z-[11] mt-2">
              <TooltipCallout
                text="Se seu local não aparecer na lista, você poderá buscá-lo pelo nome aqui."
                onAction={() => setTooltipStep(2)}
              />
            </div>
          )}

          {/* Tooltip local temporário — aparece ACIMA do botão */}
          {tooltipStep === 2 && (
            <div className="relative z-[11]">
              <TooltipCallout
                text="Para locais não cadastrados como eventos corporativos ou festas privadas, você poderá criar um local temporário."
                onAction={() => setTooltipStep(3)}
                arrowPosition="bottom"
              />
            </div>
          )}

          <Button
            variant="outline"
            className={`w-full h-11 rounded-xl border-dashed border-2 ${tooltipStep === 2 ? 'relative z-[10]' : ''}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar local temporário
          </Button>
        </div>
      </div>

      {/* Tooltip mapa — posicionado abaixo do header */}
      {tooltipStep === 3 && (
        <div className="absolute top-24 right-6 z-[11] w-64">
          <TooltipCallout
            text="Neste menu você poderá alternar entre a visualização em lista e em mapa para se localizar melhor."
            onAction={() => setTooltipStep(4)}
          />
        </div>
      )}

      {tooltipStep >= 4 && <StepFooter onBack={onBack} onNext={onNext} />}
    </div>
  );
}

// Step 2 — Seu momento aqui
function StepMomento({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [intention, setIntention] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Seu momento aqui</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Ao clicar em <strong>"Aqui"</strong>, você declarará sua presença naquele local por até <strong>2 horas</strong>. Você poderá renovar ou sair quando quiser.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-3 mt-2">
          <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 shadow-lg overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">Café do Ponto</h3>
                    <span className="text-sm text-white/70 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 120:00
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1 h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white border-0">
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Renovar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-9 rounded-lg bg-transparent border-white/30 text-white hover:bg-white/10">
                  <LogOut className="h-4 w-4 mr-1.5" /> Sair
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">Seu momento aqui</p>
              <p className="text-base text-muted-foreground mb-3">
                Essa mensagem aparecerá no seu card para quem estiver no mesmo local e é opcional.
              </p>
              <Textarea
                value={intention}
                readOnly
                placeholder="Ex: Aberto a conversar."
                maxLength={80}
                className="resize-none h-16 cursor-default"
              />
              <p className="text-right text-sm text-muted-foreground mt-1">{intention.length}/80</p>
              <p className="text-sm text-muted-foreground mt-2">
                💡 Você poderá editar sua foto e sua mensagem pelo seu card, no Perfil - e quem estiver no local verá a mudança na hora.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 3 — Selfie
function StepSelfie({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Sua selfie</h2>
        <p className="text-muted-foreground text-sm mt-1">
          A selfie é <strong>obrigatória</strong> e será o que aparecerá no seu card para as outras pessoas.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            {[
              { icon: '🔒', title: 'Segurança', desc: 'Confirma que você é uma pessoa real' },
              { icon: '🤝', title: 'Confiança', desc: 'Quem aceitar seu aceno saberá com quem fala' },
              { icon: '👋', title: 'Contexto', desc: 'Mostra como você está agora, neste momento' },
            ].map((item) => (
              <Card key={item.title} className="border shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-primary/5 rounded-2xl p-3">
            <p className="text-sm text-primary leading-relaxed">
              📷 A foto será tirada no momento, não será possível usar fotos da galeria. Isso garante que você estará realmente presente.
            </p>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 4 — Perfil (condicional)
function StepPerfil({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Seu perfil</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Preencha seus dados para aparecer nos locais e interagir com outras pessoas.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-3 mt-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 leading-relaxed">
              Esta tela só aparece se você ainda não completou seu perfil.
            </p>
          </div>

          <Card>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">?</span>
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full w-28 mb-1.5" />
                  <div className="h-2.5 bg-muted rounded-full w-20" />
                </div>
              </div>
              {['Nome', 'Data de nascimento', 'Gênero (opcional)', 'Bio (opcional)'].map((f) => (
                <div key={f} className="border border-border rounded-xl px-3 py-2">
                  <p className="text-sm text-muted-foreground">{f}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">🏷️</span>
                <div>
                  <p className="font-semibold text-sm">Interesses</p>
                  <p className="text-base text-muted-foreground mt-0.5 leading-relaxed">
                    Seus interesses <strong>não aparecerão no seu card</strong>. Eles serão usados apenas para <strong>ordenar quem aparece primeiro</strong> — pessoas com interesses em comum ficam no topo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 rounded-2xl p-3">
            <p className="text-sm text-amber-700 leading-relaxed">
              Sem nome, data de nascimento e interesses, você <strong>não aparecerá</strong> para outras pessoas nos locais.
            </p>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 5 — Pessoas no local + Aceno (com escolha de intenção)
function StepAceno({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [waved, setWaved] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [photoModal, setPhotoModal] = useState<Character | null>(null);
  const [intentionFor, setIntentionFor] = useState<Character | null>(null);
  const [sentIntention, setSentIntention] = useState<WaveIntention | null>(null);

  const chooseIntention = (key: WaveIntention) => {
    if (intentionFor) {
      setWaved(intentionFor.name);
      setSentIntention(key);
      setIntentionFor(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Pessoas no local</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Quer testar como funciona? Então toque em <strong>Acenar</strong> e escolha a <strong>intenção</strong> do seu aceno. Se precisar, toque na foto para ampliá-la.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-3 mt-2">
          <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 shadow-lg overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Store className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Café do Ponto</p>
                    <p className="text-white/60 text-sm flex items-center gap-1"><Clock size={12} /> 1:47:22</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="bg-white/20 text-white text-sm px-2 py-1 rounded-lg flex items-center gap-1">
                    <RefreshCw size={14} /> Renovar
                  </div>
                  <div className="bg-white/10 border border-white/30 text-white text-sm px-2 py-1 rounded-lg flex items-center gap-1">
                    <LogOut size={14} /> Sair
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {CHARACTERS.map((char) => (
              <Card key={char.name} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex h-full">
                    <div
                      className="w-[36%] flex items-center p-2.5 cursor-pointer"
                      onClick={() => setPhotoModal(char)}
                    >
                      <img src={char.photo} alt={char.name} className="w-full aspect-square object-cover rounded-xl" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between p-4">
                      <div>
                        <div className="font-semibold text-base">{char.name}</div>
                        <span className="inline-block w-fit text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1">
                          {char.age}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <span className="font-medium text-foreground">Aqui:</span> {char.intention}
                        </p>
                      </div>
                      <div className="mt-3">
                        {waved === char.name ? (
                          <Button
                            className={`w-full h-11 rounded-xl font-semibold ${
                              accepted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}
                            disabled={!accepted}
                          >
                            {accepted ? (
                              <><MessageCircle className="h-5 w-5 mr-2" /> Chat em andamento</>
                            ) : (
                              <><HandshakeIcon className="h-5 w-5 mr-2" /> Aceno enviado</>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setIntentionFor(char)}
                            className="w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                          >
                            <HandshakeIcon className="h-5 w-5 mr-2" /> Acenar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {waved && !accepted && (
            <div className="bg-accent/10 rounded-2xl p-3 border border-accent/20">
              <p className="text-sm font-semibold mb-1">
                Aceno {sentIntention ? `"${INTENTION_CONFIG[sentIntention].label}"` : ''} enviado para {waved}!
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                {waved} verá a intenção do seu aceno e poderá aceitar ou ignorar. Se aceitar, o chat abrirá automaticamente.
              </p>
              <Button onClick={() => setAccepted(true)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-semibold" size="sm">
                Simular: {waved} aceitou
              </Button>
            </div>
          )}

          {accepted && (
            <div className="bg-katu-green/10 rounded-2xl p-3 border border-katu-green/20">
              <p className="text-sm text-katu-green font-semibold mb-1">Chat aberto com {waved}!</p>
              <p className="text-sm text-muted-foreground">
                A conversa existe apenas enquanto vocês dois estiverem no mesmo local. Ao sair, o chat será encerrado e as mensagens apagadas.
              </p>
              <p className="text-sm text-muted-foreground mt-1.5">
                💬 No chat, segure uma mensagem para <strong>reagir</strong> — e as suas você pode <strong>editar ou apagar</strong> por até 15 minutos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog escolha de intenção — espelha o fluxo real do aceno */}
      <Dialog open={!!intentionFor} onOpenChange={(v) => !v && setIntentionFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogTitle className="text-base font-bold">
            Qual a intenção do seu aceno{intentionFor ? ` para ${intentionFor.name}` : ''}?
          </DialogTitle>
          <p className="text-sm text-muted-foreground -mt-1">
            A pessoa verá sua intenção junto com o aceno — isso evita mal-entendidos.
          </p>
          <div className="flex flex-col gap-2 mt-1">
            {(Object.keys(INTENTION_CONFIG) as WaveIntention[]).map((key) => {
              const Icon = INTENTION_ICONS[key];
              const { label, description } = INTENTION_CONFIG[key];
              return (
                <button
                  key={key}
                  onClick={() => chooseIntention(key)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all text-left"
                >
                  <Icon className="h-5 w-5 text-katu-blue shrink-0" strokeWidth={1.5} />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog ampliação de foto */}
      <Dialog open={!!photoModal} onOpenChange={(v) => !v && setPhotoModal(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
          {photoModal && (
            <>
              <button
                onClick={() => setPhotoModal(null)}
                className="absolute top-3 right-3 z-10 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
              <img src={photoModal.photo} alt={photoModal.name} className="w-full object-cover" />
            </>
          )}
        </DialogContent>
      </Dialog>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 6 — Controles (swipe animation)
function StepControles({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimating(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Você no controle</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Deslizando um card para a esquerda você verá as opções de controle.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-4 mt-2">
          {/* Swipe demo */}
          <div className="relative rounded-xl shadow-sm border border-border overflow-hidden">
            {/* Botões revelados — preenchem toda a altura */}
            <div className="absolute right-0 top-0 bottom-0 flex flex-col" style={{ width: 140 }}>
              <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-muted">
                <VolumeX size={20} className="text-foreground/70" />
                <span className="text-xs text-foreground/70 font-medium">Silenciar</span>
              </button>
              <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-muted/80">
                <Ban size={20} className="text-foreground/70" />
                <span className="text-xs text-foreground/70 font-medium">Bloquear</span>
              </button>
            </div>

            {/* Card animado */}
            <div
              className="bg-card relative z-10"
              style={{
                animation: animating ? 'tutorial-swipe 2s ease-in-out 0s 2 forwards' : 'none',
              }}
            >
              <div className="flex h-full">
                <div className="w-[36%] flex items-center p-2.5">
                  <img
                    src={CHARACTERS[0].photo}
                    alt={CHARACTERS[0].name}
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between p-4">
                  <div>
                    <div className="font-semibold text-base">{CHARACTERS[0].name}</div>
                    <span className="inline-block w-fit text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1">
                      {CHARACTERS[0].age}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      <span className="font-medium text-foreground">Aqui:</span> {CHARACTERS[0].intention}
                    </p>
                  </div>
                  <div className="mt-3">
                    <Button className="w-full h-11 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                      <HandshakeIcon className="h-5 w-5 mr-2" /> Acenar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <VolumeX size={18} className="text-foreground/70" />
                  <p className="font-semibold text-sm">Silenciar</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Válido apenas naquela sessão e naquele local. As duas pessoas continuarão se vendo, mas não conseguirão interagir.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban size={18} className="text-foreground/70" />
                  <p className="font-semibold text-sm">Bloquear</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Permanente até que você desbloqueie, independente do local ou sessão. A pessoa bloqueada deixará de ver quem a bloqueou em qualquer local.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 7 — Final estilo login
function StepFinal({ onComplete, onRestart }: { onComplete: () => void; onRestart: () => void }) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#124854] to-[#1F3A5F]">
      
      {/* Container centralizado */}
      <div className="flex-1 flex items-center justify-center px-8">
        
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-5">
          <img src={katuuLogo} alt="Katuu" className="h-16 object-contain" />

          <h2 className="text-2xl font-bold text-white">Pronto!</h2>

          <p className="text-white/70 text-base leading-relaxed">
            Agora você sabe como o Katuu funciona.
          </p>

          <p className="text-white/50 text-sm">
            Você poderá rever este passo a passo sempre que quiser em Perfil.
          </p>

          {/* Botão */}
          <div className="w-full pt-4">
            <Button
              onClick={onComplete}
              className="w-full py-4 rounded-2xl bg-accent text-accent-foreground font-bold text-base shadow-lg hover:bg-accent/90"
            >
              Concluir
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

// MAIN
export function TutorialFlow({ onComplete }: TutorialFlowProps) {
  const { isProfileComplete } = useProfile();
  const profileComplete = isProfileComplete();

  const steps = useMemo(() => {
    const base = ['welcome', 'locais', 'momento', 'selfie'];
    if (!profileComplete) base.push('perfil');
    base.push('aceno', 'controles', 'final');
    return base;
  }, [profileComplete]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  // Tutorial é sob demanda (rota /tutorial): concluir/pular apenas
  // devolve o controle a quem abriu — sem flags no banco.
  const handleComplete = onComplete;
  const handleSkip = onComplete;

  const next = () => setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStepIndex((s) => Math.max(s - 1, 0));
  const restart = () => setStepIndex(0);

  const isIntermediate = stepIndex > 0 && stepIndex < steps.length - 1;
  const dotSteps = steps.length - 2;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {isIntermediate && (
        <div className="flex items-center justify-between px-6 pt-4 pb-2 safe-area-inset-top">
          <div className="w-16">
            <button onClick={back} className="flex items-center gap-1 text-muted-foreground text-sm">
              <ChevronLeft size={16} /> Voltar
            </button>
          </div>
          <StepDots total={dotSteps} current={stepIndex - 1} />
          <div className="w-16 flex justify-end">
            <button onClick={handleSkip} className="text-muted-foreground text-sm">Pular</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {currentStep === 'welcome' && <StepWelcome onNext={next} onSkip={handleSkip} />}
        {currentStep === 'locais' && <StepLocais onNext={next} onBack={back} />}
        {currentStep === 'momento' && <StepMomento onNext={next} onBack={back} />}
        {currentStep === 'selfie' && <StepSelfie onNext={next} onBack={back} />}
        {currentStep === 'perfil' && <StepPerfil onNext={next} onBack={back} />}
        {currentStep === 'aceno' && <StepAceno onNext={next} onBack={back} />}
        {currentStep === 'controles' && <StepControles onNext={next} onBack={back} />}
        {currentStep === 'final' && <StepFinal onComplete={handleComplete} onRestart={restart} />}
      </div>
    </div>
  );
}

export default TutorialFlow;
