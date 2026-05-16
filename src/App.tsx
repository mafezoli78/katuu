import React, { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialFlow } from "@/components/tutorial/TutorialFlow";
import { useAutoPushSubscription } from "@/hooks/useAutoPushSubscription";
import { supabase } from '@/integrations/supabase/client';

const Splash = lazy(() => import("./pages/Splash"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Home = lazy(() => import("./pages/Home"));
const Profile = lazy(() => import("./pages/Profile"));
const Waves = lazy(() => import("./pages/Waves"));
const Chat = lazy(() => import("./pages/Chat"));
const Location = lazy(() => import("./pages/Location"));
const Debug = lazy(() => import("./pages/Debug"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// ============================================================
// ERROR BOUNDARY - Captura erros de renderização
// ============================================================

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Erro capturado:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-4" 
             style={{ background: 'linear-gradient(to bottom, #124854, #1F3A5F)' }}>
          <div className="text-5xl mb-2">😕</div>
          <h1 className="text-white text-xl font-bold text-center">
            Algo deu errado
          </h1>
          <p className="text-white/70 text-sm text-center max-w-xs">
            O app encontrou um problema ao carregar. Isso pode acontecer em aparelhos com WebView desatualizado.
          </p>
          <div className="mt-4 p-4 bg-white/10 rounded-xl text-white/60 text-xs max-w-xs">
            <p className="font-semibold mb-2">💡 Como resolver:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Atualize o <strong>Android System WebView</strong> na Play Store</li>
              <li>Reinicie o aparelho</li>
              <li>Verifique se há atualizações do sistema</li>
            </ul>
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-4 px-8 py-3 bg-white text-[#124854] font-semibold rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            Tentar novamente
          </button>
          {this.state.error && (
            <div className="mt-4 p-3 bg-black/30 rounded-lg max-w-xs w-full">
              <p className="text-white/50 text-xs font-mono break-all text-left">
                {this.state.error.message}
              </p>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// ERROR BOUNDARY PARA LAZY LOADING
// ============================================================

class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[LazyErrorBoundary] Erro ao carregar componente:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
            <p className="text-destructive font-semibold text-lg">Algo deu errado</p>
            <p className="text-muted-foreground text-sm text-center">
              Não foi possível carregar esta página. Tente recarregar o app.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-semibold"
            >
              Tentar novamente
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ============================================================
// QUERY CLIENT
// ============================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse-soft text-muted-foreground">Carregando...</div>
    </div>
  );
}

// DeepLinkHandler simplificado - sem import dinâmica do Capacitor
function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica se há hash de recovery na URL atual (web)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        }).then(() => {
          navigate('/reset-password', { replace: true });
        });
      }
      return;
    }

    // Tenta capturar deep link via mensagem (app nativo)
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const url = data?.url || event.data;
        if (!url || typeof url !== 'string') return;
        
        const parsed = new URL(url);
        const hashParams = new URLSearchParams(parsed.hash.replace('#', ''));
        const type = hashParams.get('type') || parsed.searchParams.get('type');
        const accessToken = hashParams.get('access_token') || parsed.searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || parsed.searchParams.get('refresh_token');

        if (type === 'recovery' && accessToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          }).then(() => {
            navigate('/reset-password', { replace: true });
          });
        }
      } catch {
        // Ignora mensagens que não são deep links
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return null;
}

function PostLoginRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/home', { replace: true });
  }, [navigate]);

  return <PageLoader />;
}

// ============================================================
// ROTAS PRINCIPAIS
// ============================================================

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { shouldShowTutorial, loading: tutorialLoading, dismissTutorial } = useTutorial();

  useAutoPushSubscription();

  if (authLoading || tutorialLoading) {
    return <PageLoader />;
  }

  if (user && shouldShowTutorial) {
    return <TutorialFlow onComplete={dismissTutorial} />;
  }

  if (user) {
    return (
      <LazyErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <DeepLinkHandler />
          <Routes>
            <Route path="/" element={<PostLoginRedirect />} />
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/waves" element={<Waves />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/location" element={<Location />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="*" element={<Navigate to="/location" replace />} />
          </Routes>
        </Suspense>
      </LazyErrorBoundary>
    );
  }

  return (
    <LazyErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <DeepLinkHandler />
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/debug" element={<Debug />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Suspense>
    </LazyErrorBoundary>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;