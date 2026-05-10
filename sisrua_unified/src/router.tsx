/**
 * router.tsx — Roteamento SPA enterprise do sisTOPOGRAFIA.
 *
 * Mapa de rotas:
 *   /              → LandingDraftPage (marketing)
 *   /dashboard     → DashboardPage (KPIs do tenant)
 *   /app           → ProjetoPage (mapa + DXF — componente App existente)
 *   /admin         → AdminClientePage (autoatendimento do cliente)
 *   /saas-admin    → SaaSAdminPage (gestão global da plataforma)
 *   /ajuda         → AjudaPage (central de ajuda)
 *   /status        → StatusPage (saúde da plataforma)
 *   *              → NotFoundPage (404)
 *
 * Todos os componentes de página são lazy-loaded para otimização de bundle.
 */
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazyWithRetry } from "./utils/lazyWithRetry";

// ─── Lazy imports ─────────────────────────────────────────────────────────

const LandingDraftPage = lazy(() =>
  lazyWithRetry(() => import("./components/LandingDraftPage")),
);
const DashboardPage = lazy(() =>
  lazyWithRetry(() => import("./pages/DashboardPage")),
);
const SaaSAdminPage = lazy(() =>
  lazyWithRetry(() => import("./pages/SaaSAdminPage")),
);
const AjudaPage = lazy(() => lazyWithRetry(() => import("./pages/AjudaPage")));
const StatusPage = lazy(() =>
  lazyWithRetry(() => import("./pages/StatusPage")),
);
const NotFoundPage = lazy(() =>
  lazyWithRetry(() => import("./pages/NotFoundPage")),
);
// AdminPage e App (ProjetoPage) são importados diretamente pois têm estado pesado
// e o lazy não traz ganho real nessas rotas críticas.
const AdminPage = lazy(() =>
  lazyWithRetry(() => import("./components/AdminPage")),
);
const ProjetoPage = lazy(() => lazyWithRetry(() => import("./App")));

// ─── Fallback de carregamento ─────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs font-medium text-slate-500">Carregando…</p>
      </div>
    </div>
  );
}

// ─── Roteador principal ───────────────────────────────────────────────────
import { PortalLayout } from "./components/PortalLayout";
import { ProjectPage } from "./pages/ProjectPage";
import { TeamPage } from "./pages/TeamPage";

// ─── Roteador principal ───────────────────────────────────────────────────

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingDraftPage />} />

            {/* Nova Arquitetura de Portal (Item B) */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="finance" element={<div className="p-8 text-white font-black uppercase tracking-widest italic opacity-40">FinOps Central (Coming Soon)</div>} />
...

              <Route path="modularity" element={<div className="p-8 text-white font-black uppercase tracking-widest italic opacity-40">Configurações da Engine</div>} />
              <Route path="settings" element={<div className="p-8 text-white font-black uppercase tracking-widest italic opacity-40">Perfil & Preferências</div>} />
            </Route>

            {/* O Editor imersivo (Fullscreen) */}
            <Route path="/editor/:projeto_id" element={<ProjetoPage />} />
            <Route path="/app" element={<ProjetoPage />} />

            <Route path="/admin" element={<AdminPage />} />
            <Route path="/saas-admin" element={<SaaSAdminPage />} />
            <Route path="/ajuda" element={<AjudaPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/landing" element={<LandingDraftPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
