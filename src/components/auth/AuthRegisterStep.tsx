import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AuthRegisterStepProps {
  email: string;
  onBack: () => void;
}

export function AuthRegisterStep({ email, onBack }: AuthRegisterStepProps) {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
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
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: error.message.includes('already registered') ? 'Este email já está cadastrado' : error.message,
      });
    } else {
      toast({ title: 'Conta criada!', description: 'Vamos configurar seu perfil' });
      navigate('/onboarding');
    }
  };

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

      <input
        type="email"
        value={email}
        disabled
        className="w-full rounded-full py-3 px-6 bg-white/5 border border-white/10 text-white/50 mb-3 cursor-not-allowed"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Crie uma senha"
        className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-2"
      />

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
