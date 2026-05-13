import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialFlow } from "@/components/tutorial/TutorialFlow";
import { useAutoPushSubscription } from "@/hooks/useAutoPushSubscription";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

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

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse-soft text-muted-foreground">Carregando...</div>
    </div>
  );
}

function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleUrl = async (url: string) => {
      try {
        console.log('[DeepLink] received:', url);
        const parsed = new URL(url);

        // Extrai parâmetros do hash ou query string
        const hashParams = new URLSearchParams(parsed.hash.replace('#', ''));
        const queryParams = parsed.searchParams;

        const type = hashParams.get('type') || queryParams.get('type');
        const code = queryParams.get('code');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        if (type === 'recovery') {
          // Reset de senha
          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
          }
          navigate('/reset-password', { replace: true });
          return;
        }

        if (code) {
          // PKCE flow — troca o code por sessão
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            navigate('/home', { replace: true });
          }
          return;
        }

        if (accessToken && refreshToken) {
          // Token flow direto
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          navigate('/home', { replace: true });
          return;
        }

      } catch (e) {
        console.error('[DeepLink] Error:', e);
      }
    };

    // Listener para app já aberto
    const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
      void handleUrl(url);
    });

    // Verifica se o app foi aberto via deep link (cold start)
    CapApp.getLaunchUrl()
      .then(({ url }) => { if (url) void handleUrl(url); })
      .catch(() => {});

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [navigate]);

  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { shouldShowTutorial, loading: tutorialLoading, dismissTutorial } = useTutorial();

  useAutoPushSubscription();

  if (loading || tutorialLoading) {
    return null;
  }

  if (user && shouldShowTutorial) {
    return <TutorialFlow onComplete={dismissTutorial} />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <DeepLinkHandler />
      <Routes>
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/debug" element={<Debug />} />

        {user ? (
          <>
            <Route path="/" element={<Splash />} />
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/waves" element={<Waves />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/location" element={<Location />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/location" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Splash />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}

const App = () => (
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
);

export default App;
