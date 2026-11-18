import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { lazy, Suspense, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';
import { ToastProvider } from '@/ui/overlay';
import { ErrorState, PageSkeleton } from '@/ui/primitives';
import { Shell } from './Shell';
import { LoginPage, RegisterPage, WelcomePage } from '@/features/auth/AuthPages';

const Onboarding = lazy(() => import('@/features/onboarding/Onboarding'));
const TodayPage = lazy(() => import('@/features/today/TodayPage'));
const PlanPage = lazy(() => import('@/features/plan/PlanPage'));
const FitnessPage = lazy(() => import('@/features/fitness/FitnessPage'));
const SchoolPage = lazy(() => import('@/features/school/SchoolPage'));
const StudyGuidePage = lazy(() => import('@/features/school/StudyGuidePage'));
const ReviewPage = lazy(() => import('@/features/school/ReviewPage'));
const PracticeTestPage = lazy(() => import('@/features/school/PracticeTestPage'));
const FoodPage = lazy(() => import('@/features/food/FoodPage'));
const CarePage = lazy(() => import('@/features/care/CarePage'));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/auth/me'), retry: false, staleTime: 60_000 });
}

function RequireAuth({ onboarding }: { onboarding?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageSkeleton />;
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
    return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  }
  if (!onboarding && !me.data.onboarding.completed) return <Navigate to="/onboarding" replace />;
  if (onboarding && me.data.onboarding.completed) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Hide routes for modules the user hasn't enabled. */
function ModuleRoute({ modules, children }: { modules: string[]; children: ReactNode }) {
  const me = useMe();
  const enabled = me.data?.profile?.modules ?? [];
  if (!modules.some((m) => enabled.includes(m as never))) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth onboarding />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route index element={<TodayPage />} />
                  <Route path="plan" element={<PlanPage />} />
                  <Route path="fitness" element={<ModuleRoute modules={['fitness', 'sports']}><FitnessPage /></ModuleRoute>} />
                  <Route path="school" element={<ModuleRoute modules={['school']}><SchoolPage /></ModuleRoute>} />
                  <Route path="school/study" element={<ModuleRoute modules={['school']}><StudyGuidePage /></ModuleRoute>} />
                  <Route path="school/review" element={<ModuleRoute modules={['school']}><ReviewPage /></ModuleRoute>} />
                  <Route path="school/practice" element={<ModuleRoute modules={['school']}><PracticeTestPage /></ModuleRoute>} />
                  <Route path="food" element={<ModuleRoute modules={['nutrition']}><FoodPage /></ModuleRoute>} />
                  <Route path="care" element={<ModuleRoute modules={['skincare', 'haircare']}><CarePage /></ModuleRoute>} />
                  <Route path="progress" element={<ProgressPage />} />
                  <Route path="settings/:section?" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
