import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AuthRegisterStepProps {
  email: string;
  onBack: () => void;
}

export function AuthRegisterStep({ email, onBack }: AuthRegisterStepProps) {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleRegister = async () => {
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Informe seu nome' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As senhas não coincidem' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, { nome });
    setLoading(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: error.message.includes('already registered') ? 'Este email já está cadastrado' : error.message,
      });
    } else {
      setShowConfirmation(true);
    }
  };

  if (showConfirmation) {
    return (
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mb-6">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Verifique seu e-mail</h2>
        <p className="text-white/70 text-sm mb-6">
          Enviamos um e-mail de confirmação para <span className="text-white font-medium">{email}</span>. Verifique sua caixa de entrada para ativar sua conta.
        </p>
        <button onClick={onBack} className="mt-4 flex items-center gap-1 text-white/70 text-sm hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <h2 className="text-2xl font-bold text-white mb-1">Criar conta</h2>
      <p className="text-white/70 text-sm mb-6">Preencha os dados para começar</p>

      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-3"
        autoFocus
      />

      <div className="w-full relative mb-3">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Crie uma senha"
          className="w-full rounded-full py-3 px-6 pr-12 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full relative mb-2">
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirme a senha"
          className="w-full rounded-full py-3 px-6 pr-12 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
        />
      </div>

      <button
        onClick={handleRegister}
        disabled={loading}
        className="w-full bg-white text-gray-800 font-medium rounded-full py-3 px-6 shadow-md hover:shadow-lg transition-shadow mt-2 disabled:opacity-50"
      >
        {loading ? 'Criando...' : 'Criar conta'}
      </button>

      <button onClick={onBack} className="mt-4 flex items-center gap-1 text-white/70 text-sm hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
    </div>
  );
}
