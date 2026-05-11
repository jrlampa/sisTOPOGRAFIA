/**
 * router.tsx — Roteamento SPA enterprise do sisTOPOGRAFIA.
 */
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import { useAuth } from "./auth/AuthProvider";

// ─── Fallback de carregamento ─────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Iniciando sistema…</p>
      </div>
    </div>
  );
}

/**
 * Proteção de rota para usuários autenticados.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/#acesso" replace />;
  return <>{children}</>;
}

// ─── Lazy imports ─────────────────────────────────────────────────────────

const LandingPage = lazy(() =>
  lazyWithRetry(() => import("./pages/LandingPage")),
);
const DashboardPage = lazy(() =>
  lazyWithRetry(() => import("./pages/DashboardPage")),
);
const SaaSAdminPage = lazy(() =>
  lazyWithRetry(() => import("./pages/SaaSAdminPage")),
);
const SuperAdminDashboard = lazy(() =>
  lazyWithRetry(() => import("./pages/SuperAdminDashboard")),
);
const AjudaPage = lazy(() => lazyWithRetry(() => import("./pages/AjudaPage")));
const StatusPage = lazy(() =>
  lazyWithRetry(() => import("./pages/StatusPage")),
);
const NotFoundPage = lazy(() =>
  lazyWithRetry(() => import("./pages/NotFoundPage")),
);
const AdminPage = lazy(() =>
  lazyWithRetry(() => import("./components/AdminPage")),
);
const ProjetoPage = lazy(() => lazyWithRetry(() => import("./App")));

// ─── Componentes de Layout ───────────────────────────────────────────────
import { PortalLayout } from "./components/PortalLayout";
import { ProjectPage } from "./pages/ProjectPage";
import { TeamPage } from "./pages/TeamPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Landing Page (Ponto de entrada único para marketing e login) */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />

            {/* Nova Arquitetura de Portal (Item B) — PROTEGIDA */}
            <Route 
              path="/portal" 
              element={
                <PrivateRoute>
                  <PortalLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/portal/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="projects" element={<ProjectPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="governance" element={<SuperAdminDashboard />} />
              <Route path="admin" element={<SaaSAdminPage />} />
              <Route path="status" element={<StatusPage />} />
              <Route path="help" element={<AjudaPage />} />
            </Route>

            {/* O Editor imersivo (Fullscreen) — PROTEGIDO */}
            <Route path="/editor/:projeto_id" element={<PrivateRoute><ProjetoPage /></PrivateRoute>} />
            <Route path="/app" element={<PrivateRoute><ProjetoPage /></PrivateRoute>} />

            {/* Administração Global */}
            <Route path="/saas-admin" element={<PrivateRoute><SuperAdminDashboard /></PrivateRoute>} />

            {/* Páginas Legadas / Auxiliares */}
            <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
            <Route path="/ajuda" element={<AjudaPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
