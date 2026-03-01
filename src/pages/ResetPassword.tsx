import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Detect recovery event from URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    if (password !== confirm) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As senhas não coincidem' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Senha atualizada!', description: 'Você já pode entrar com sua nova senha.' });
      navigate('/auth');
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
        <p className="text-muted-foreground">Link de recuperação inválido ou expirado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'linear-gradient(to bottom, #124854, #1F3A5F)' }}>
      <div className="w-full max-w-sm flex flex-col items-center">
        <h1 className="text-2xl font-bold text-white mb-1">Nova senha</h1>
        <p className="text-white/70 text-sm mb-6">Escolha uma nova senha para sua conta</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha"
          className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-3"
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar senha"
          className="w-full rounded-full py-3 px-6 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 mb-2"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-white text-gray-800 font-medium rounded-full py-3 px-6 shadow-md hover:shadow-lg transition-shadow mt-2 disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar senha'}
        </button>
      </div>
    </div>
  );
}
