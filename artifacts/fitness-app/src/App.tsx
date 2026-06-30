import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { initApiAuth } from "@/lib/api-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import WorkoutsPage from "@/pages/WorkoutsPage";
import NewWorkoutPage from "@/pages/NewWorkoutPage";
import WorkoutDetailPage from "@/pages/WorkoutDetailPage";
import GoalsPage from "@/pages/GoalsPage";
import ProgressPage from "@/pages/ProgressPage";
import AiCoachPage from "@/pages/AiCoachPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center max-w-[430px] mx-auto">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ConfigErrorScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Configuration missing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This preview is missing Supabase environment variables.
        </p>
        <p className="mt-4 text-sm text-foreground">
          Add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong>
          in Vercel Project Settings then redeploy.
        </p>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Redirect to={user ? "/dashboard" : "/auth"} />;
}

function AuthRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect to="/dashboard" />;
  return <AuthPage />;
}

function AppInit() {
  useEffect(() => {
    initApiAuth();
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthRedirect} />
      <Route path="/dashboard">
        {() => <AuthGuard><DashboardPage /></AuthGuard>}
      </Route>
      <Route path="/workouts/new">
        {() => <AuthGuard><NewWorkoutPage /></AuthGuard>}
      </Route>
      <Route path="/workouts/:id">
        {() => <AuthGuard><WorkoutDetailPage /></AuthGuard>}
      </Route>
      <Route path="/workouts">
        {() => <AuthGuard><WorkoutsPage /></AuthGuard>}
      </Route>
      <Route path="/goals">
        {() => <AuthGuard><GoalsPage /></AuthGuard>}
      </Route>
      <Route path="/progress">
        {() => <AuthGuard><ProgressPage /></AuthGuard>}
      </Route>
      <Route path="/ai-coach">
        {() => <AuthGuard><AiCoachPage /></AuthGuard>}
      </Route>
      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppInit />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
