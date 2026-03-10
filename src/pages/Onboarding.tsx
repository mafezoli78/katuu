import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

import type { Gender } from '@/types/gender';
import { GENDER_OPTIONS } from '@/types/gender';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DateOfBirthPicker } from '@/components/profile/DateOfBirthPicker';
import { InterestsStep } from '@/components/onboarding/InterestsStep';
import { useInterestCategories } from '@/hooks/useInterestCategories';
import { Camera } from 'lucide-react';
import logoKatu from '@/assets/logo-katuu-oficial.png';

export default function Onboarding() {
  const { user } = useAuth();
  const { profile, updateProfile, updateInterests, uploadAvatar, isProfileComplete } = useProfile();
  const { categories } = useInterestCategories();
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [ageError, setAgeError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    } else if (isProfileComplete()) {
      navigate('/location', { replace: true });
    }
  }, [user, isProfileComplete, navigate]);

  useEffect(() => {
    if (profile) {
      if (profile.nome) setNome(profile.nome);
      if (profile.data_nascimento) setDataNascimento(profile.data_nascimento);
      if (profile.bio) setBio(profile.bio);
      if (profile.gender) setGender(profile.gender);
      if (profile.foto_url) setAvatarPreview(profile.foto_url);
    }
  }, [profile]);

  const validateAge = (birthDate: string): boolean => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 18) {
      setAgeError('Você precisa ter pelo menos 18 anos para usar o Katu');
      return false;
    }
    setAgeError('');
    return true;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(i => i !== interestId)
        : [...prev, interestId]
    );
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!nome.trim()) {
        toast({ variant: 'destructive', title: 'Por favor, insira seu nome' });
        return;
      }
      if (!dataNascimento) {
        toast({ variant: 'destructive', title: 'Por favor, insira sua data de nascimento' });
        return;
      }
      if (!validateAge(dataNascimento)) return;
      setStep(2);
    } else if (step === 2) {
      if (selectedInterests.length < 3) {
        toast({ variant: 'destructive', title: 'Selecione pelo menos 3 interesses' });
        return;
      }
      setStep(3);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }

      const { error: profileError } = await updateProfile({
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        bio: bio.trim() || null,
        gender: gender || null,
      });

      if (profileError) {
        const msg = profileError.message || String(profileError);
        if (msg.includes('MINIMUM_AGE')) {
          setAgeError('Você precisa ter pelo menos 18 anos');
          setStep(1);
          setLoading(false);
          return;
        }
        throw profileError;
      }

      const { error: interestsError } = await updateInterests(selectedInterests);
      if (interestsError) throw interestsError;

      toast({ title: 'Perfil criado com sucesso!' });
      navigate('/location', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar perfil' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to get interest name by ID
  const getInterestName = (interestId: string): string => {
    for (const cat of categories) {
      const found = cat.interests.find(i => i.id === interestId);
      if (found) return found.name;
    }
    return interestId;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary p-6 flex items-center justify-center">
        <img src={logoKatu} alt="Katu" className="w-20 h-auto" />
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 py-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 w-12 rounded-full transition-colors ${
              s <= step ? 'bg-accent' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <div className="p-4 page-enter">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Complete seu perfil para começar</CardTitle>
              <CardDescription>
                Esses dados são necessários para que você possa interagir com outras pessoas nos locais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar upload */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-lg overflow-hidden bg-primary flex items-center justify-center">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-primary-foreground text-2xl font-semibold">
                        {nome ? nome[0].toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-accent text-accent-foreground rounded-full p-2 cursor-pointer hover:bg-accent/90 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome <span className="text-destructive">*</span></Label>
                <Input
                  id="nome"
                  placeholder="Como você quer ser chamado?"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de nascimento <span className="text-destructive">*</span></Label>
                <DateOfBirthPicker
                  value={dataNascimento}
                  onChange={(v) => {
                    setDataNascimento(v);
                    if (!v.includes('00')) validateAge(v);
                  }}
                />
                {ageError && (
                  <p className="text-sm text-destructive">{ageError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gênero (opcional)</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (opcional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Uma breve descrição sobre você..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={150}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/150
                </p>
              </div>

              <Button
                onClick={handleNextStep}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={!!ageError}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <InterestsStep
            selectedInterests={selectedInterests}
            onToggleInterest={toggleInterest}
            onNext={handleNextStep}
            onBack={() => setStep(1)}
          />
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Tudo pronto!</CardTitle>
              <CardDescription>Confira seu perfil antes de continuar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-primary flex items-center justify-center shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-primary-foreground text-xl font-semibold">
                      {nome[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{nome}</h3>
                  {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Seus interesses:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedInterests.map((interestId) => (
                    <Badge key={interestId} variant="secondary">
                      {getInterestName(interestId)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={handleComplete}
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Começar a usar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
