import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { nome: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    // Timeout de segurança: 8 segundos
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialLoadDone) {
        console.warn('[Auth] Timeout - forçando loading=false');
        initialLoadDone = true;
        setLoading(false);
      }
    }, 8000);

    // Carrega sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error('[Auth] Erro ao carregar sessão:', err);
      })
      .finally(() => {
        if (mounted && !initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      });

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        console.log('[Auth] Evento:', _event);
        setSession(session);
        setUser(session?.user ?? null);
        if (!initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const signUp = async (email: string, password: string, metadata?: { nome: string }) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      return { error: error as Error | null };
    } catch (err) {
      console.error('[Auth] Erro signUp:', err);
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      
      // Atualiza estado imediatamente
      setSession(data.session);
      setUser(data.session?.user ?? null);
      
      return { error: null };
    } catch (err) {
      console.error('[Auth] Erro signIn:', err);
      return { error: err as Error };
    }
  };

const signInWithOAuth = async (provider: 'google') => {
  try {
    const win = window as any;
    const SocialLogin = win.Capacitor?.Plugins?.SocialLogin;
    
    if (!SocialLogin) {
      return { error: new Error('Login com Google não disponível neste dispositivo') };
    }

    // Inicializa o plugin (necessário em alguns dispositivos)
    try {
      await SocialLogin.initialize();
    } catch (e) {
      // Ignora se já estiver inicializado
      console.log('[Auth] SocialLogin initialize:', e);
    }

    const result = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['profile', 'email'],
      },
    });

    if (!result?.accessToken?.token) {
      return { error: new Error('Falha ao obter token do Google') };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: result.accessToken.token,
    });

    if (error) return { error };
    
    setSession(data.session);
    setUser(data.session?.user ?? null);
    
    return { error: null };
  } catch (err: any) {
    console.error('[Auth] Erro Google SignIn:', err);
    return { error: err as Error };
  }
};

  const signOut = async () => {
    try {
      // Tenta limpar presença (não bloqueia se falhar)
      if (user?.id) {
        try {
          const { data: presence } = await supabase
            .from('presence')
            .select('place_id')
            .eq('user_id', user.id)
            .eq('ativo', true)
            .maybeSingle();

          if (presence?.place_id) {
            await supabase.rpc('end_presence_cascade', {
              p_user_id: user.id,
              p_place_id: presence.place_id,
              p_motivo: 'manual',
              p_force: true,
            } as any);
          }
        } catch (err) {
          console.error('[Auth] Erro ao limpar presença:', err);
        }
      }
    } finally {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}