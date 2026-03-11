import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  MapPin, Search, Plus, Clock, Camera, Users, Hand, MessageCircle,
  VolumeX, Ban, ChevronRight, ChevronLeft, X, Map, List, CheckCircle,
  Store, RefreshCw, LogOut, AlertCircle, Navigation,
} from 'lucide-react';
import { HandshakeIcon } from '@/components/icons/HandshakeIcon';
import { TemporaryPlaceIcon } from '@/components/icons/TemporaryPlaceIcon';
import katuuLogo from '@/assets/logo-katuu-oficial.png';
import { TUTORIAL_CHARACTERS } from './tutorialCharacters';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface TutorialFlowProps {
  onComplete: () => void;
}

interface Character {
  name: string;
  age: number;
  photo: string;
  intention: string;
}

// ---------------------------------------------------------------------------
// FICTIONAL DATA
// ---------------------------------------------------------------------------
const CHARACTERS: Character[] = TUTORIAL_CHARACTERS;

const FICTIONAL_PLACES = [
  { name: 'Café do Ponto', count: 3 },
  { name: 'Parque da Juventude', count: 1 },
  { name: 'Biblioteca Central', count: 0 },
];

// ---------------------------------------------------------------------------
// STEP INDICATOR
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// CHARACTER AVATAR — square with rounded corners
// ---------------------------------------------------------------------------
function CharAvatar({ char, size = 'md', showBadge = false }: { char: Character; size?: 'sm' | 'md' | 'lg'; showBadge?: boolean }) {
  const sizes = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' };
  return (
    <div className={`relative ${sizes[size]} rounded-xl overflow-hidden border-2 border-white shadow`}>
      <img src={char.photo} alt={char.name} className="w-full h-full object-cover" />
      {showBadge && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-katu-green rounded-full border-2 border-white" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TOOLTIP CALLOUT for Step 1 — arrow points up-right
// ---------------------------------------------------------------------------
function TooltipCallout({ text, onAction }: { text: string; onAction: () => void }) {
  return (
    <div className="bg-primary text-primary-foreground rounded-xl p-3 shadow-lg relative">
      <p className="text-sm leading-relaxed mb-2">{text}</p>
      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-xs font-semibold" onClick={onAction}>
        Ok
      </Button>
      <div className="absolute -top-2 right-6 w-4 h-4 bg-primary rotate-45" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// STANDARD FOOTER for intermediate steps
// ---------------------------------------------------------------------------
function StepFooter({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="px-6 py-4 flex gap-3">
      <Button variant="outline" onClick={onBack} className="flex-1 h-11 rounded-xl">
        Voltar
      </Button>
      <Button onClick={onNext} className="flex-1 h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-semibold">
        Continuar
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// INDIVIDUAL STEPS
// ---------------------------------------------------------------------------

// Step 0 — Welcome
function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-8 bg-gradient-to-b from-[#124854] to-[#1F3A5F]">
      <div className="flex flex-col items-center gap-4">
        <img src={katuuLogo} alt="Katuu" className="h-16 object-contain" />
        <h1 className="text-2xl font-bold text-white leading-tight">
          Bem-vindo ao Katuu
        </h1>
        <p className="text-white/70 text-base leading-relaxed max-w-xs">
          O Katuu mostra pessoas que estão no <strong className="text-white">mesmo lugar que você</strong>, abertas para uma conversa agora.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <div className="flex justify-center gap-2">
          {CHARACTERS.map((c) => (
            <div key={c.name} className="flex flex-col items-center gap-1">
              <CharAvatar char={c} size="md" showBadge />
              <span className="text-xs text-white/60">{c.name}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/40">Pessoas reais, presentes agora.</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={onNext} className="w-full py-3.5 rounded-2xl bg-accent text-accent-foreground font-semibold text-base shadow hover:bg-accent/90">
          Ver como funciona
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full py-2 text-white/50 hover:text-white hover:bg-white/10">
          Pular tutorial
        </Button>
      </div>
    </div>
  );
}

// Step 1 — Locais (tooltip/callout sequential flow)
function StepLocais({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [tooltipStep, setTooltipStep] = useState(0);
  const showOverlay = tooltipStep < 4;

  return (
    <div className="flex flex-col h-full relative">
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[9] pointer-events-none transition-opacity duration-300"
        style={{ opacity: showOverlay ? 1 : 0 }}
      />

      {/* Header: title left, List/Map icons right */}
      <div className="px-6 pt-4 pb-3 relative z-[11] flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Onde você está agora?</h2>
          <p className="text-muted-foreground text-sm mt-1">
            O Katuu detecta sua localização e mostra os estabelecimentos próximos.
          </p>
        </div>
        {/* List/Map toggle — icons only, top-right */}
        <div className={`flex items-center gap-0.5 bg-muted rounded-lg p-0.5 ml-3 flex-shrink-0 ${tooltipStep === 3 ? 'relative z-[10]' : ''}`}>
          <div className="rounded-md p-2 bg-card shadow-sm">
            <List className="h-4 w-4 text-foreground" />
          </div>
          <div className="rounded-md p-2">
            <Map className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="space-y-2">
          {/* Places list */}
          {FICTIONAL_PLACES.map((p, i) => (
            <Card key={p.name} className={`border shadow-sm ${tooltipStep === 0 && i === 0 ? 'relative z-[10]' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.count > 0 ? (
                        <Badge variant="secondary" className="text-xs bg-katu-green/10 text-katu-green border-0">
                          <Users className="h-3 w-3 mr-1" />
                          {p.count} {p.count === 1 ? 'pessoa' : 'pessoas'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ninguém por aqui ainda</span>
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

          {/* Tooltip 0 — "Aqui" button */}
          {tooltipStep === 0 && (
            <div className="relative z-[11] mt-2">
              <TooltipCallout
                text="Toque aqui para registrar sua presença neste local."
                onAction={() => setTooltipStep(1)}
              />
            </div>
          )}

          {/* Search field */}
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
                text="Não encontrou seu local? Busque pelo nome."
                onAction={() => setTooltipStep(2)}
              />
            </div>
          )}

          {/* Create temporary */}
          <Button
            variant="outline"
            className={`w-full h-11 rounded-xl border-dashed border-2 ${tooltipStep === 2 ? 'relative z-[10]' : ''}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar local temporário
          </Button>

          {tooltipStep === 2 && (
            <div className="relative z-[11] mt-2">
              <TooltipCallout
                text="Use para locais não cadastrados, eventos corporativos e festas privadas."
                onAction={() => setTooltipStep(3)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tooltip 3 — map toggle (positioned below header) */}
      {tooltipStep === 3 && (
        <div className="absolute top-24 right-6 z-[11] w-64">
          <TooltipCallout
            text="Prefere ver no mapa? Toque aqui para alternar a visualização."
            onAction={() => setTooltipStep(4)}
          />
        </div>
      )}

      {/* Footer — only shown after all tooltips */}
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
          Ao clicar em <strong>"Aqui"</strong>, você declara sua presença naquele local por até <strong>2 horas</strong>.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-3 mt-2">
          {/* Presence card mock — matching PresenceStatusCard */}
          <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 shadow-lg overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">Café do Ponto</h3>
                    <span className="text-xs text-white/70 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 2:00:00
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

          {/* Expression field */}
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">Seu momento aqui</p>
              <p className="text-xs text-muted-foreground mb-3">
                O que as pessoas precisam saber sobre você aqui e agora? Essa mensagem aparece no seu card para quem estiver no mesmo local.
              </p>
              <Textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Ex: Aberto a conversar."
                maxLength={140}
                className="resize-none h-16"
              />
              <p className="text-right text-xs text-muted-foreground mt-1">{intention.length}/140</p>
              <p className="text-xs italic text-muted-foreground mt-2">
                Esta etapa é opcional, mas essencial para boas conexões — diga às pessoas como você está agora.
              </p>
            </CardContent>
          </Card>

          <div className="bg-katu-green/10 rounded-2xl p-3">
            <p className="text-xs text-katu-green leading-relaxed">
              ✅ Sua presença fica ativa por <strong>2 horas</strong>. Você pode renovar ou sair quando quiser.
            </p>
          </div>
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
          A selfie é <strong>obrigatória</strong> e é o que aparece no seu card para as outras pessoas.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '🔒', title: 'Segurança', desc: 'Confirma que você é uma pessoa real' },
              { icon: '🤝', title: 'Confiança', desc: 'Quem vai aceitar seu aceno sabe com quem fala' },
              { icon: '👋', title: 'Contexto', desc: 'Mostra como você está agora, neste momento' },
            ].map((item) => (
              <Card key={item.title} className="border shadow-sm">
                <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mock PersonCard — matching real layout */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Como aparece no seu card:</p>
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex h-full">
                  <div className="w-[36%] flex items-center p-2.5">
                    <img
                      src={CHARACTERS[1].photo}
                      alt={CHARACTERS[1].name}
                      className="w-full aspect-square object-cover rounded-xl"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between p-4">
                    <div>
                      <div className="font-semibold text-base">
                        Carlos<span className="text-muted-foreground font-normal">, 38</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        <span className="font-medium text-foreground">Aqui:</span> Aqui para relaxar
                      </p>
                    </div>
                    <div className="mt-3">
                      <Button className="w-full h-11 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                        <HandshakeIcon className="h-5 w-5 mr-2" /> Acenar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-primary/5 rounded-2xl p-3">
            <p className="text-xs text-primary leading-relaxed">
              📷 A foto é tirada no momento — não é possível usar fotos da galeria. Isso garante que você está realmente presente.
            </p>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 4 — Perfil (conditional — only if profile incomplete)
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
          {/* Amber alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Esta tela só aparece se você ainda não completou seu perfil.
            </p>
          </div>

          {/* Profile fields mock */}
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
                  <p className="text-xs text-muted-foreground">{f}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Interests */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">🏷️</span>
                <div>
                  <p className="font-semibold text-sm">Interesses</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Seus interesses <strong>não aparecem no seu card</strong> para outras pessoas. Eles são usados apenas para <strong>ordenar quem aparece primeiro</strong> — pessoas com interesses em comum ficam no topo da sua lista.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 rounded-2xl p-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              ⚠️ Sem nome, data de nascimento e interesses, você <strong>não aparece</strong> para outras pessoas nos locais.
            </p>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 5 — Pessoas no local + Aceno
function StepAceno({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [waved, setWaved] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">Pessoas no local</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Você vê quem está presente agora. Para iniciar uma conversa, envie um <strong>aceno</strong> 👋
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-3 mt-2">
          {/* Mock PresenceStatusCard */}
          <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 shadow-lg overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Store className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-xs">Café do Ponto</p>
                    <p className="text-white/60 text-xs flex items-center gap-1"><Clock size={10} /> 1:47:22</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    <RefreshCw size={10} /> Renovar
                  </div>
                  <div className="bg-white/10 border border-white/30 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    <LogOut size={10} /> Sair
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* People list — compact row layout */}
          <div className="flex flex-col gap-2">
            {CHARACTERS.map((char) => (
              <Card key={char.name} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={char.photo}
                      alt={char.name}
                      className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {char.name}<span className="text-muted-foreground font-normal">, {char.age}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">Aqui:</span> {char.intention}
                      </p>
                      <div className="mt-2">
                        {waved === char.name ? (
                          <Button
                            className={`w-full h-9 rounded-xl font-semibold text-xs ${
                              accepted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}
                            disabled={!accepted}
                            size="sm"
                          >
                            {accepted ? (
                              <><MessageCircle className="h-4 w-4 mr-1" /> Chat</>
                            ) : (
                              <><HandshakeIcon className="h-4 w-4 mr-1" /> Aceno enviado</>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setWaved(char.name)}
                            className="w-full h-9 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs"
                            size="sm"
                          >
                            <HandshakeIcon className="h-4 w-4 mr-1" /> Acenar
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
              <p className="text-sm font-semibold mb-1">Aceno enviado para {waved}!</p>
              <p className="text-xs text-muted-foreground mb-2">Agora {waved} recebe uma notificação e pode aceitar ou ignorar. Se aceitar, o chat abre automaticamente.</p>
              <Button onClick={() => setAccepted(true)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold" size="sm">
                Simular: {waved} aceitou! 🎉
              </Button>
            </div>
          )}

          {accepted && (
            <div className="bg-katu-green/10 rounded-2xl p-3 border border-katu-green/20">
              <p className="text-sm text-katu-green font-semibold mb-1">Chat aberto com {waved}!</p>
              <p className="text-xs text-muted-foreground">A conversa existe apenas enquanto vocês dois estiverem no mesmo local. Ao sair, o chat é encerrado.</p>
            </div>
          )}
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

// Step 6 — Silenciar e Bloquear (swipe animation)
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
          Deslize um card para a esquerda para ver as opções de controle.
        </p>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="flex flex-col gap-4 mt-2">
          {/* Swipe demo with CSS animation */}
          <div className="relative overflow-hidden rounded-xl shadow-sm border border-border">
            {/* Actions background — stacked vertically, transparent, ~80px */}
            <div className="absolute right-0 top-0 bottom-0 flex flex-col" style={{ width: 80 }}>
              <button className="flex-1 flex flex-col items-center justify-center gap-1">
                <VolumeX size={18} className="text-foreground/70" />
                <span className="text-xs text-foreground/70 font-medium">Silenciar</span>
              </button>
              <button className="flex-1 flex flex-col items-center justify-center gap-1">
                <Ban size={18} className="text-foreground/70" />
                <span className="text-xs text-foreground/70 font-medium">Bloquear</span>
              </button>
            </div>

            {/* Card with swipe animation */}
            <div
              className="bg-card p-3 flex items-center gap-3"
              style={{
                animation: animating ? 'tutorial-swipe 2s ease-in-out 0s 2 forwards' : 'none',
              }}
            >
              <CharAvatar char={CHARACTERS[0]} size="md" showBadge />
              <div className="flex-1">
                <p className="font-semibold text-sm">{CHARACTERS[0].name}, {CHARACTERS[0].age}</p>
                <p className="text-xs text-muted-foreground">Aqui: {CHARACTERS[0].intention}</p>
              </div>
              <Button size="sm" className="bg-accent text-accent-foreground rounded-xl text-xs font-semibold">
                <HandshakeIcon className="h-4 w-4 mr-1" /> Acenar
              </Button>
            </div>
          </div>

          {/* Rules */}
          <div className="grid grid-cols-1 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <VolumeX size={18} className="text-foreground/70" />
                  <p className="font-semibold text-sm">Silenciar</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Válido apenas naquela sessão e naquele local. As duas pessoas continuam se vendo, mas não conseguem interagir.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban size={18} className="text-destructive" />
                  <p className="font-semibold text-sm text-destructive">Bloquear</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Permanente até que você desbloqueie, independente do local ou sessão. A pessoa bloqueada deixa de ver quem a bloqueou em qualquer local.
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

// Step 7 — Final
function StepFinal({ onComplete, onRestart }: { onComplete: () => void; onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-8 bg-gradient-to-b from-[#124854] to-[#1F3A5F]">
      <div className="flex flex-col items-center gap-4">
        <img src={katuuLogo} alt="Katuu" className="h-16 object-contain" />
        <h2 className="text-2xl font-bold text-white">Pronto!</h2>
        <p className="text-white/70 text-base leading-relaxed max-w-xs">
          Agora você sabe como o Katuu funciona. Veja quem está aqui com você <strong className="text-white">agora</strong>.
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {CHARACTERS.map((c) => (
          <div key={c.name} className="flex flex-col items-center gap-1">
            <CharAvatar char={c} size="md" showBadge />
            <span className="text-xs text-white/60">{c.name}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={onComplete} className="w-full py-4 rounded-2xl bg-accent text-accent-foreground font-bold text-base shadow-lg hover:bg-accent/90">
          Começar a usar o Katuu 🚀
        </Button>
        <Button variant="ghost" onClick={onRestart} className="w-full py-2.5 text-white/50 hover:text-white hover:bg-white/10">
          Ver tutorial novamente
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export function TutorialFlow({ onComplete }: TutorialFlowProps) {
  const { user } = useAuth();
  const { isProfileComplete } = useProfile();
  const profileComplete = isProfileComplete();

  // Build steps array, conditionally including step 4 (profile)
  const steps = useMemo(() => {
    const base = ['welcome', 'locais', 'momento', 'selfie'];
    if (!profileComplete) base.push('perfil');
    base.push('aceno', 'controles', 'final');
    return base;
  }, [profileComplete]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  const markCompleted = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ tutorial_enabled: false })
      .eq('id', user.id);
  }, [user]);

  const handleComplete = useCallback(async () => {
    await markCompleted();
    onComplete();
  }, [markCompleted, onComplete]);

  const handleSkip = useCallback(async () => {
    await markCompleted();
    onComplete();
  }, [markCompleted, onComplete]);

  const next = () => setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStepIndex((s) => Math.max(s - 1, 0));
  const restart = () => setStepIndex(0);

  // Intermediate steps (between welcome and final)
  const isIntermediate = stepIndex > 0 && stepIndex < steps.length - 1;
  // Dots count = intermediate steps only
  const dotSteps = steps.length - 2;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* Header with dots */}
      {isIntermediate && (
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
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

      {/* Step content */}
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
