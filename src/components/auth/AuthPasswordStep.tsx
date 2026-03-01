import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AuthPasswordStepProps {
  email: string;
  onBack: () => void;
}

export function AuthPasswordStep({ email, onBack }: AuthPasswordStepProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleLogin = async () => {
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' ? 'Senha incorreta' : error.message,
      });
    }
  };

  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'E-mail enviado', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <h2 className="text-2xl font-bold text-white mb-1">Sua senha</h2>
      <p className="text-white/70 text-sm mb-6">{email}</p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-2"
        autoFocus
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-white text-gray-800 font-medium rounded-full py-3 px-6 shadow-md hover:shadow-lg transition-shadow mt-2 disabled:opacity-50"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <button onClick={handleForgotPassword} className="mt-3 text-white/60 text-xs hover:text-white transition-colors">
        Esqueci minha senha
      </button>

      <button onClick={onBack} className="mt-3 flex items-center gap-1 text-white/70 text-sm hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
    </div>
  );
}
