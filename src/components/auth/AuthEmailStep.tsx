import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthEmailStepProps {
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onExistingUser: () => void;
  onNewUser: () => void;
}

export function AuthEmailStep({ email, setEmail, onBack, onExistingUser, onNewUser }: AuthEmailStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleContinue = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Insira um e-mail válido');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('check_email_exists', { p_email: email });
      if (rpcError) throw rpcError;
      if (data) {
        onExistingUser();
      } else {
        onNewUser();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center">
      <h2 className="text-2xl font-bold text-white mb-1">Seu e-mail</h2>
      <p className="text-white/70 text-sm mb-6">Informe seu e-mail para continuar</p>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-2"
        autoFocus
      />
      {error && <p className="text-red-300 text-xs mb-2">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={loading}
        className="w-full bg-white text-gray-800 font-medium rounded-full py-3 px-6 shadow-md hover:shadow-lg transition-shadow mt-2 disabled:opacity-50"
      >
        {loading ? 'Verificando...' : 'Continuar'}
      </button>

      <button onClick={onBack} className="mt-4 flex items-center gap-1 text-white/70 text-sm hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
    </div>
  );
}
