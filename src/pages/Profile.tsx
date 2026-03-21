import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useInterestCategories } from '@/hooks/useInterestCategories';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Gender } from '@/types/gender';
import { GENDER_OPTIONS } from '@/types/gender';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { EmailChangeDialog } from '@/components/profile/EmailChangeDialog';
import { PasswordChangeDialog } from '@/components/profile/PasswordChangeDialog';
import { DateOfBirthPicker } from '@/components/profile/DateOfBirthPicker';
import { 
  LogOut, Check, User, Heart, Pencil, X, 
  Mail, Lock, RotateCcw, Bell, BellOff
} from 'lucide-react';

const MIN_BIO_LENGTH = 40;
const MAX_BIO_LENGTH = 150;
const MAX_INTERESTS = 10;
const MAX_PER_CATEGORY = 4;

export default function Profile() {
  const { user, signOut } = useAuth();
  const { profile, interests, updateProfile, updateInterests, calculateAge } = useProfile();
  const { categories } = useInterestCategories();
  const { permission, supported, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [gender, setGender] = useState<Gender | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setBio(profile.bio || '');
      setDataNascimento(profile.data_nascimento || '');
      setGender(profile.gender ?? null);
    }
    setSelectedInterests(interests.map(i => i.interest_id));
  }, [profile, interests]);

  const getCategoryCount = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.interests.filter(i => selectedInterests.includes(i.id)).length;
  };

  const toggleInterest = (interestId: string, categoryId: string) => {
    const isSelected = selectedInterests.includes(interestId);
    if (!isSelected) {
      if (selectedInterests.length >= MAX_INTERESTS) return;
      if (getCategoryCount(categoryId) >= MAX_PER_CATEGORY) return;
    }
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(i => i !== interestId)
        : [...prev, interestId]
    );
  };

  const getInterestName = (interestId: string): string => {
    for (const cat of categories) {
      const found = cat.interests.find(i => i.id === interestId);
      if (found) return found.name;
    }
    return interestId;
  };

  const validateForm = (): boolean => {
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' });
      return false;
    }
    if (!dataNascimento) {
      toast({ variant: 'destructive', title: 'Data de nascimento é obrigatória' });
      return false;
    }
    if (!gender) {
      toast({ variant: 'destructive', title: 'Gênero é obrigatório' });
      return false;
    }
    if (!bio.trim()) {
      toast({ variant: 'destructive', title: 'Bio é obrigatória' });
      return false;
    }
    if (bio.trim().length < MIN_BIO_LENGTH) {
      toast({ variant: 'destructive', title: `Bio deve ter pelo menos ${MIN_BIO_LENGTH} caracteres` });
      return false;
    }
    if (selectedInterests.length < 3) {
      toast({ variant: 'destructive', title: 'Selecione pelo menos 3 interesses' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await updateProfile({ 
        nome: nome.trim(), 
        bio: bio.trim(),
        data_nascimento: dataNascimento,
        gender: gender,
      });
      await updateInterests(selectedInterests);
      toast({ title: 'Perfil atualizado!' });
      setEditing(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (permission === 'granted') {
        await unsubscribe();
        toast({ title: 'Notificações desativadas' });
      } else {
        const success = await subscribe();
        if (success) {
          toast({ title: 'Notificações ativadas! 🔔' });
        } else if (permission === 'denied') {
          toast({
            variant: 'destructive',
            title: 'Notificações bloqueadas',
            description: 'Habilite nas configurações do navegador.',
          });
        }
      }
    } finally {
      setPushLoading(false);
    }
  };

  const age = profile?.data_nascimento ? calculateAge(profile.data_nascimento) : null;

  const getBioStatus = () => {
    const length = bio.trim().length;
    if (length === 0) return { color: 'text-muted-foreground', message: `0/${MAX_BIO_LENGTH}` };
    if (length < MIN_BIO_LENGTH) return { color: 'text-amber-500', message: `${length}/${MAX_BIO_LENGTH} (mín. ${MIN_BIO_LENGTH})` };
    return { color: 'text-muted-foreground', message: `${length}/${MAX_BIO_LENGTH}` };
  };

  const bioStatus = getBioStatus();

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 page-fade pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-katu-blue" />
            <h1 className="text-xl font-bold">Meu Perfil</h1>
          </div>
          {!editing && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setEditing(true)}
              className="h-9 rounded-lg"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-20 katu-gradient" />
          <CardContent className="relative pt-0 pb-6">
            {/* Avatar — inicial do nome */}
            <div className="flex justify-center -mt-12 mb-4">
              <div className="h-24 w-24 rounded-lg ring-4 ring-card shadow-lg overflow-hidden bg-katu-blue flex items-center justify-center">
                <span className="text-white text-3xl font-bold">
                  {profile?.nome?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Nome *</Label>
                  <Input 
                    value={nome} 
                    onChange={(e) => setNome(e.target.value)} 
                    maxLength={50} 
                    className="mt-1.5 h-11 rounded-xl"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Data de nascimento *</Label>
                  <div className="mt-1.5">
                    <DateOfBirthPicker
                      value={dataNascimento}
                      onChange={setDataNascimento}
                    />
                  </div>
                  {dataNascimento && !dataNascimento.includes('00') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Idade: {calculateAge(dataNascimento)} anos
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Gênero *</Label>
                  <Select value={gender ?? ''} onValueChange={(v) => setGender(v as Gender)}>
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue placeholder="Selecione seu gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Bio *</Label>
                  <Textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    maxLength={MAX_BIO_LENGTH} 
                    rows={3}
                    className="mt-1.5 rounded-xl resize-none"
                    placeholder="Conte um pouco sobre você..."
                  />
                  <p className={`text-xs text-right mt-1 ${bioStatus.color}`}>
                    {bioStatus.message}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {profile?.nome}
                  {age && <span className="text-muted-foreground font-normal">, {age}</span>}
                </h2>
                {profile?.bio && (
                  <p className="text-muted-foreground mt-2 text-sm">{profile.bio}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interests Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-accent" />
              Interesses
              {editing && <span className="text-xs text-muted-foreground font-normal">(3–{MAX_INTERESTS})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                {categories.map((category) => {
                  const catCount = getCategoryCount(category.id);
                  return (
                    <div key={category.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
                        {catCount > 0 && (
                          <span className="text-xs text-muted-foreground">{catCount}/{MAX_PER_CATEGORY}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {category.interests.map((interest) => {
                          const isSelected = selectedInterests.includes(interest.id);
                          const categoryFull = catCount >= MAX_PER_CATEGORY && !isSelected;
                          const maxReached = selectedInterests.length >= MAX_INTERESTS && !isSelected;
                          const disabled = categoryFull || maxReached;
                          return (
                            <Badge
                              key={interest.id}
                              variant={isSelected ? 'default' : 'outline'}
                              className={`cursor-pointer py-1.5 px-3 rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-katu-green text-white hover:bg-katu-green/90'
                                  : disabled
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-muted'
                              }`}
                              onClick={() => !disabled && toggleInterest(interest.id, category.id)}
                            >
                              {interest.name}
                              {isSelected && <Check className="ml-1.5 h-3 w-3" />}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {interests.length > 0 ? (
                  interests.map((i) => (
                    <Badge 
                      key={i.interest_id} 
                      variant="secondary"
                      className="py-1.5 px-3 rounded-lg bg-katu-green/10 text-katu-green"
                    >
                      {getInterestName(i.interest_id)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum interesse selecionado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Settings */}
        {!editing && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                onClick={() => setEmailDialogOpen(true)}
                className="w-full justify-start h-11 rounded-xl"
              >
                <Mail className="h-4 w-4 mr-2" />
                Alterar email
                <span className="ml-auto text-xs text-muted-foreground truncate max-w-[140px]">
                  {user?.email}
                </span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setPasswordDialogOpen(true)}
                className="w-full justify-start h-11 rounded-xl"
              >
                <Lock className="h-4 w-4 mr-2" />
                Alterar senha
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  if (!user) return;
                  await supabase.from('profiles').update({ tutorial_enabled: true }).eq('id', user.id);
                  toast({ title: 'Tutorial reativado! Reinicie o app para vê-lo.' });
                }}
                className="w-full justify-start h-11 rounded-xl"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Mostrar tutorial novamente
              </Button>

              {permission !== 'denied' && (
                <Button
                  variant="outline"
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className="w-full justify-start h-11 rounded-xl"
                >
                  {permission === 'granted' ? (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      Desativar notificações
                      <span className="ml-auto text-xs text-katu-green">Ativas</span>
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Ativar notificações
                    </>
                  )}
                </Button>
              )}

              {permission === 'denied' && (
                <p className="text-xs text-muted-foreground px-1">
                  🔕 Notificações bloqueadas. Para ativar, acesse as configurações do navegador.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {editing ? (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditing(false);
                  if (profile) {
                    setNome(profile.nome || '');
                    setBio(profile.bio || '');
                    setDataNascimento(profile.data_nascimento || '');
                    setGender(profile.gender ?? null);
                  }
                  setSelectedInterests(interests.map(i => i.interest_id));
                }} 
                className="flex-1 h-11 rounded-xl"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="flex-1 h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              className="w-full h-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da conta
            </Button>
          )}
        </div>
      </div>

      <EmailChangeDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        currentEmail={user?.email || ''}
      />

      <PasswordChangeDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </MobileLayout>
  );
}
