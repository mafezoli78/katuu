import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useInterestCategories } from '@/hooks/useInterestCategories';

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
import { SelfCard } from '@/components/profile/SelfCard';
import { DateOfBirthPicker } from '@/components/profile/DateOfBirthPicker';
import {
  LogOut, Check, User, Heart, Pencil, X,
  Lock, HelpCircle, Settings,
} from 'lucide-react';
import { APP_VERSION } from '@/version';

const MAX_BIO_LENGTH = 80;

const GENDER_LABEL: Record<string, string> = {
  man: 'Homem',
  woman: 'Mulher',
  non_binary: 'Não-binário',
  other: 'Outro',
};

export default function Profile() {
  const { user, signOut } = useAuth();
  const { profile, interests, updateProfile, updateInterests, calculateAge } = useProfile();
  const { categories } = useInterestCategories();

  const navigate = useNavigate();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderCustom, setGenderCustom] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setBio(profile.bio || '');
      setDataNascimento(profile.data_nascimento || '');
      setGender(profile.gender ?? null);
      setGenderCustom(profile.gender_custom || '');
    }
    setSelectedInterests(interests.map(i => i.interest_id));
  }, [profile, interests]);

  const getCategoryCount = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.interests.filter(i => selectedInterests.includes(i.id)).length;
  };

  const isNoneTag = (interestId: string): boolean => {
    for (const cat of categories) {
      const found = cat.interests.find(i => i.id === interestId);
      if (found) return found.name === 'Nenhuma delas';
    }
    return false;
  };

  const getCategoryInterestIds = (categoryId: string): string[] => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.interests.map(i => i.id) : [];
  };

  const toggleInterest = (interestId: string, categoryId: string) => {
    const isSelected = selectedInterests.includes(interestId);
    const categoryIds = getCategoryInterestIds(categoryId);

    if (isNoneTag(interestId)) {
      // Clicou em "Nenhuma delas" — desseleciona tudo da categoria e seleciona/desseleciona ela
      if (isSelected) {
        setSelectedInterests(prev => prev.filter(i => !categoryIds.includes(i)));
      } else {
        setSelectedInterests(prev => [
          ...prev.filter(i => !categoryIds.includes(i)),
          interestId,
        ]);
      }
      return;
    }

    // Clicou em tag normal — remove "Nenhuma delas" da categoria se estiver selecionada
    const noneId = categoryIds.find(id => {
      for (const cat of categories) {
        const found = cat.interests.find(i => i.id === id);
        if (found && found.name === 'Nenhuma delas') return true;
      }
      return false;
    });

    if (!isSelected) {
      setSelectedInterests(prev => [
        ...prev.filter(i => i !== noneId),
        interestId,
      ]);
    } else {
      setSelectedInterests(prev => prev.filter(i => i !== interestId));
    }
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
        gender,
        gender_custom: gender === 'other' ? (genderCustom.trim() || null) : null,
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

  const handleCancel = () => {
    setEditing(false);
    if (profile) {
      setNome(profile.nome || '');
      setBio(profile.bio || '');
      setDataNascimento(profile.data_nascimento || '');
      setGender(profile.gender ?? null);
      setGenderCustom(profile.gender_custom || '');
    }
    setSelectedInterests(interests.map(i => i.interest_id));
  };



  const age = profile?.data_nascimento ? calculateAge(profile.data_nascimento) : null;

  const getBioStatus = () => {
    const length = bio.trim().length;
    return { color: 'text-muted-foreground', message: `${length}/${MAX_BIO_LENGTH}` };
  };

  const bioStatus = getBioStatus();

  const profileLoading = !profile;

  if (profileLoading) {
    return (
      <MobileLayout headerVersion={APP_VERSION}>
        <div className="p-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6 space-y-3">
              <div className="h-7 w-48 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-full bg-muted rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout headerVersion={APP_VERSION}>
      <div className="p-4 space-y-4 page-fade pb-24">

        {/* SELF CARD — como as pessoas te veem no local atual (some sem presença) */}
        {!editing && <SelfCard />}

        {/* BLOCO 1 — Perfil */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-katu-blue" />
                Perfil
              </CardTitle>
              {!editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 rounded-lg">
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
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
                    <DateOfBirthPicker value={dataNascimento} onChange={setDataNascimento} />
                  </div>
                  {dataNascimento && !dataNascimento.includes('00') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Idade: {calculateAge(dataNascimento)} anos
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Gênero *</Label>
                  <Select
                    value={gender ?? ''}
                    onValueChange={(v) => {
                      setGender(v as Gender);
                      if (v !== 'other') setGenderCustom('');
                    }}
                  >
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
                  {gender === 'other' && (
                    <Input
                      placeholder="Como você se identifica? (opcional)"
                      value={genderCustom}
                      onChange={(e) => setGenderCustom(e.target.value.slice(0, 30))}
                      maxLength={30}
                      className="mt-2 h-11 rounded-xl"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Bio (opcional)</Label>
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

                {/* Interesses no modo edição */}
                <div>
                  <Label className="text-sm font-medium">
                    Interesses <span className="text-muted-foreground font-normal">(mín. 3)</span>
                  </Label>
                  <div className="space-y-4 mt-2">
                    {categories.map((category) => {
                      const catCount = getCategoryCount(category.id);
                      return (
                        <div key={category.id}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">{category.name}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {category.interests.map((interest) => {
                              const isSelected = selectedInterests.includes(interest.id);
                              return (
                                <Badge
                                  key={interest.id}
                                  variant={isSelected ? 'default' : 'outline'}
                                  className={`cursor-pointer py-1.5 px-3 rounded-lg transition-all ${isSelected
                                      ? 'bg-katu-green text-white hover:bg-katu-green/90'
                                      : 'hover:bg-muted'
                                    }`}
                                  onClick={() => toggleInterest(interest.id, category.id)}
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
                </div>

                {/* Botões salvar/cancelar */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleCancel} className="flex-1 h-11 rounded-xl">
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
              </>
            ) : (
              <>
                {/* Visualização do perfil */}
                <div>
                  <p className="text-xl font-bold">
                    {profile?.nome}
                    {age !== null && <span className="text-muted-foreground font-normal">, {age}</span>}
                  </p>
                  {gender && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {gender === 'other' && profile?.gender_custom
                        ? profile.gender_custom
                        : (GENDER_LABEL[gender] || gender)}
                    </p>
                  )}
                </div>
                {profile?.bio && (
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                )}

                {/* Interesses no modo visualização — filtra "Nenhuma delas" */}
                {interests.filter(i => getInterestName(i.interest_id) !== 'Nenhuma delas').length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-accent" />
                      Interesses
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {interests
                        .filter(i => getInterestName(i.interest_id) !== 'Nenhuma delas')
                        .map((i) => (
                          <Badge
                            key={i.interest_id}
                            variant="secondary"
                            className="py-1.5 px-3 rounded-lg bg-katu-green/10 text-katu-green"
                          >
                            {getInterestName(i.interest_id)}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* BLOCO 2 — Conta */}
        {!editing && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user?.app_metadata?.provider === 'email' ? (
                <p className="text-sm text-muted-foreground">
                  Login efetuado com o email{' '}
                  <span className="font-medium text-foreground">{user?.email}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Login efetuado via Google com a conta{' '}
                  <span className="font-medium text-foreground">{user?.email}</span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* BLOCO 3 — Configurações */}
        {!editing && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              <Button
                variant="outline"
                onClick={() => navigate('/tutorial')}
                className="w-full justify-start h-auto py-3 rounded-xl"
              >
                <HelpCircle className="h-4 w-4 mr-2 shrink-0 text-katu-blue" />
                <span className="flex flex-col items-start text-left">
                  <span className="font-medium">Como o Katuu funciona?</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Veja o passo a passo.
                  </span>
                </span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sair */}
        {!editing && (
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate('/auth', { replace: true });
            }}
            className="w-full h-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        )}


      </div>
    </MobileLayout>
  );
}
