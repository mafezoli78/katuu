import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import logoKatuu from '@/assets/logo-katuu-oficial.png';
import iconKatuu from '@/assets/icon-katuu.png';
import { AuthMainStep } from '@/components/auth/AuthMainStep';
import { AuthEmailStep } from '@/components/auth/AuthEmailStep';
import { AuthPasswordStep } from '@/components/auth/AuthPasswordStep';
import { AuthRegisterStep } from '@/components/auth/AuthRegisterStep';

type Step = 'main' | 'email' | 'password' | 'register';

export default function Auth() {
  const [step, setStep] = useState<Step>('main');
  const [email, setEmail] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectAttemptedRef = useRef(false);
  
  const { user, loading, signInWithOAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redireciona usuário autenticado para /location (não /home)
  // O App.tsx/PostLoginRedirect decide o destino final baseado na presença
  useEffect(() => {
    // Evita redirecionamentos múltiplos
    if (redirectAttemptedRef.current) return;
    
    // Não redireciona enquanto o auth está carregando
    if (loading) return;
    
    // Se já está redirecionando, não faz nada
    if (isRedirecting) return;

    if (user) {
      redirectAttemptedRef.current = true;
      setIsRedirecting(true);
      
      // Pequeno delay para garantir que o estado de sessão foi sincronizado
      const timer = setTimeout(() => {
        navigate('/location', { replace: true });
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [user, loading, isRedirecting, navigate]);

  // Se estiver redirecionando, mostra um loader simples
  if (isRedirecting || (user && !redirectAttemptedRef.current)) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(to bottom, #124854, #1F3A5F)' }}
      >
        <img src={iconKatuu} alt="Katuu" className="w-16 h-16 object-contain mb-4 animate-pulse-soft" />
        <p className="text-white/80 text-sm">Entrando...</p>
      </div>
    );
  }

  const handleOAuth = async (provider: 'google') => {
    const { error } = await signInWithOAuth(provider);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #124854, #1F3A5F)' }}>
      {/* Subtle background orbs */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-40 right-10 w-40 h-40 rounded-full bg-white/15 blur-3xl" />
      </div>

      {/* Logo area */}
      <div className="flex flex-col items-center justify-end pt-16 pb-6 relative z-10 animate-fade-in" style={{ flex: '2' }}>
        <img src={logoKatuu} alt="Katuu" className="w-44 h-auto mb-4 drop-shadow-lg" />
        <img src={iconKatuu} alt="" className="w-20 h-20 object-contain drop-shadow-xl" />
      </div>

      {/* Content area */}
      <div className="relative z-10 px-8 pb-10 flex flex-col items-center animate-slide-up" style={{ flex: '3' }}>
        {step === 'main' && (
          <AuthMainStep
            onGoogle={() => handleOAuth('google')}
            onEmail={() => setStep('email')}
          />
        )}

        {step === 'email' && (
          <AuthEmailStep
            email={email}
            setEmail={setEmail}
            onBack={() => setStep('main')}
            onExistingUser={() => setStep('password')}
            onNewUser={() => setStep('register')}
          />
        )}

        {step === 'password' && (
          <AuthPasswordStep
            email={email}
            onBack={() => setStep('email')}
          />
        )}

        {step === 'register' && (
          <AuthRegisterStep
            email={email}
            onBack={() => setStep('email')}
          />
        )}

        {/* Footer */}
        <p className="mt-8 text-xs text-white/60 text-center max-w-xs">
          Ao continuar, você concorda com os{' '}
          <Link to="/terms" className="underline text-white/80">Termos de Uso</Link>
          {' '}e com a{' '}
          <Link to="/privacy" className="underline text-white/80">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  );
}