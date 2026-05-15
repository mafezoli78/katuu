import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialFlow } from "@/components/tutorial/TutorialFlow";
import { useAutoPushSubscription } from "@/hooks/useAutoPushSubscription";

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

// Trata deep links para reset de senha — apenas no app nativo
function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const capAppModule = await import('@capacitor/app');
      const CapApp = capAppModule.App;
      const { supabase } = await import('@/integrations/supabase/client');

      const handleUrl = async (url: string) => {
        try {
          const parsed = new URL(url);
          const hashParams = new URLSearchParams(parsed.hash.replace('#', ''));
          const type = hashParams.get('type') || parsed.searchParams.get('type');
          const accessToken = hashParams.get('access_token') || parsed.searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || parsed.searchParams.get('refresh_token');

          if (type === 'recovery' && accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            navigate('/reset-password', { replace: true });
          }
        } catch (e) {
          console.error('[DeepLink] Error:', e);
        }
      };

      const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
        void handleUrl(url);
      });

      CapApp.getLaunchUrl()
        .then(({ url }) => { if (url) void handleUrl(url); })
        .catch(() => {});

      cleanup = () => {
        listenerPromise.then(l => l.remove());
      };
    };

    init();
    return () => { cleanup?.(); };
  }, [navigate]);

  return null;
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { shouldShowTutorial, loading: tutorialLoading, dismissTutorial } = useTutorial();

  // Push subscription apenas em ambiente web — não no app nativo
  useAutoPushSubscription();

  // Aguarda estados essenciais carregarem
  if (authLoading || tutorialLoading) {
    return <PageLoader />;
  }

  if (user && shouldShowTutorial) {
    return <TutorialFlow onComplete={dismissTutorial} />;
  }

  if (user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <DeepLinkHandler />
        <Routes>
          <Route path="/" element={<Splash />} />
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
    );
  }

  return (
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
