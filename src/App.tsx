import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const PublicRankings = lazy(() => import("./components/PublicRankings"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { OfflineBanner } from "@/components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <main className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
  </main>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NextThemesProvider attribute="class" defaultTheme="light" storageKey="teachpro-theme">
      <TooltipProvider>
        <Sonner />
        <OfflineBanner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />}>
                  <Route path="students/:studentId" element={<StudentProfile />} />
                </Route>
                <Route path="/students/:studentId" element={<StudentProfile />} />
                <Route path="/rankings" element={<PublicRankings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </NextThemesProvider>
  </QueryClientProvider>
);

export default App;
