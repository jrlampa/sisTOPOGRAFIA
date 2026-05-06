# CLAUDE.md

## Purpose

This document defines implementation rules for AI-assisted UI work and Figma integration via MCP in this repository.

Scope: frontend architecture in [src](src), static assets in [public](public), and design/quality docs in [docs](docs).

---

## 1. Design System Structure

### 1.1 Token Definitions

Primary token sources:

- Runtime CSS variables in [src/index.css](src/index.css)
- Theme token maps in [src/theme/tokens.ts](src/theme/tokens.ts)
- Tailwind semantic extensions in [tailwind.config.js](tailwind.config.js)

Runtime application pattern:

- Theme values are applied by setting HTML attributes/classes in [src/hooks/useAppLifecycleEffects.ts](src/hooks/useAppLifecycleEffects.ts) and [src/components/PageShell.tsx](src/components/PageShell.tsx)
- [src/theme/ThemeProvider.tsx](src/theme/ThemeProvider.tsx) exists but is not the active source of truth in app bootstrap

Token format examples:

```ts
// src/theme/tokens.ts
export type ThemeTokenMap = Record<string, string>;

export const THEME_TOKENS = {
  light: { "--app-shell-bg": "#eef6fb", "--enterprise-blue": "#0c6fb8" },
  dark: { "--app-shell-bg": "#071524", "--enterprise-blue": "#4ec7f0" },
  sunlight: { "--app-shell-bg": "#ffffff", "--enterprise-blue": "#000000" },
};
```

```css
/* src/index.css */
:root {
  --app-shell-bg: #eef6fb;
}
[data-theme="dark"] {
  --app-shell-bg: #071524;
}
```

```ts
// tailwind.config.js
extend: {
  colors: {
    brand: { 500: "#3b82f6" },
    severity: { ok: { DEFAULT: "#16a34a" } },
    surface: { glass: "rgba(255,255,255,0.7)" }
  },
  borderRadius: { card: "1.5rem", panel: "0.75rem" }
}
```

Critical note:

- Project uses Tailwind v4 in [package.json](package.json) with PostCSS plugin in [postcss.config.js](postcss.config.js)
- [src/index.css](src/index.css) currently uses legacy Tailwind directives and does not declare @config for [tailwind.config.js](tailwind.config.js)
- For Figma-to-code consistency, prefer CSS variable tokens first, and only rely on Tailwind custom extensions after v4 config loading is explicitly validated

### 1.2 Token Transformation Systems

Observed transformation approach:

- No Style Dictionary/Theo pipeline detected
- Transformation is runtime-only: React sets data-theme + dark class, CSS variables resolve styles

Rules:

- Add new core visual tokens first in [src/theme/tokens.ts](src/theme/tokens.ts)
- Mirror defaults/utility usage in [src/index.css](src/index.css)
- Avoid hardcoded colors in shell/layout components

---

## 2. Component Library

### 2.1 Where UI Components Are Defined

Main locations:

- Shared UI/components in [src/components](src/components)
- Route pages in [src/pages](src/pages)
- Feature-heavy panel modules in [src/components/BtTopologyPanel](src/components/BtTopologyPanel) and [src/components/MtTopologyPanel](src/components/MtTopologyPanel)

Routing and composition:

- App routes in [src/router.tsx](src/router.tsx)
- Main engineering workspace assembled in [src/App.tsx](src/App.tsx) via many specialized hooks

### 2.2 Component Architecture

Architecture style:

- React function components + hooks
- Feature-oriented decomposition with domain subfolders
- High-level containers orchestrate smaller renderers/primitives

Pattern examples:

```tsx
// src/router.tsx
const DashboardPage = lazy(() =>
  lazyWithRetry(() => import("./pages/DashboardPage")),
);
<Route path="/dashboard" element={<DashboardPage />} />;
```

```tsx
// src/App.tsx
const { appState, setAppState } = useAppOrchestrator();
const { isCalculating, btSummary } = useBtDerivedState({
  appState,
  setAppState,
});
return <AppWorkspace /* composed props */ />;
```

### 2.3 Documentation / Storybook

- No Storybook configuration or \*.stories files detected
- Frontend behavior standards are documented in:
  - [docs/FRONTEND_COMPONENT_GUIDELINES.md](docs/FRONTEND_COMPONENT_GUIDELINES.md)
  - [docs/DEFINITION_OF_DONE_FRONTEND.md](docs/DEFINITION_OF_DONE_FRONTEND.md)

Rule for Figma MCP:

- Treat the docs above as source of component quality rules
- Do not assume Storybook-driven contracts exist

---

## 3. Frameworks & Libraries

Core stack (from [package.json](package.json)):

- UI: React 19 + React DOM
- Routing: react-router-dom
- Styling: Tailwind CSS v4 + global CSS variables
- Motion: framer-motion
- Maps/UI viz: leaflet, react-leaflet, recharts
- Auth/data services: @supabase/supabase-js

Build and tooling:

- Bundler/dev server: Vite in [vite.config.ts](vite.config.ts)
- Language/toolchain: TypeScript + tsx
- Unit tests: Vitest
- E2E tests: Playwright
- PWA: vite-plugin-pwa

Bundling strategy evidence:

```ts
// vite.config.ts (manual chunking)
if (id.includes("node_modules/lucide-react/")) return "icons";
if (isSrcPath("components/BtTopologyPanel")) return "feature-bt-core";
```

Rule for Figma MCP:

- Prefer route-level and feature-level code splitting for heavy UI additions
- Keep icon-intensive features in existing icon chunking behavior

---

## 4. Asset Management

### 4.1 Storage and References

Current static assets:

- Root public assets in [public](public), including [public/logo.png](public/logo.png), [public/marker-icon.png](public/marker-icon.png), [public/marker-icon-2x.png](public/marker-icon-2x.png), [public/marker-shadow.png](public/marker-shadow.png)
- Branding references used in UI from /branding paths in [src/components/AppHeader.tsx](src/components/AppHeader.tsx)

Important repository mismatch:

- [public/branding](public/branding) appears empty in workspace scan, while UI references /branding/logo_sisrua_optimized.png and other files
- Validate actual deployment artifact presence before shipping any Figma-derived brand updates

### 4.2 Optimization Techniques

Observed techniques:

- Vite production build with esbuild minification in [vite.config.ts](vite.config.ts)
- PWA caching and runtime caching rules in [vite.config.ts](vite.config.ts)
- Some optimized naming convention exists (example: logo_sisrua_optimized.png in UI references)

### 4.3 CDN / External Delivery

Observed external origins and policies:

- Map tile/CDN sources configured in map components and CSP:
  - OpenStreetMap tiles in [src/components/MapSelector.tsx](src/components/MapSelector.tsx)
  - Carto basemaps in [src/components/MapPreview.tsx](src/components/MapPreview.tsx)
- CSP generation in [vite.config.ts](vite.config.ts) controls connect-src/img-src

Rule for Figma MCP:

- Export raster assets to [public](public) with deterministic names
- For map-themed mockups, do not hardcode unapproved third-party origins beyond CSP allowlist

---

## 5. Icon System

Primary icon library:

- lucide-react imports are used extensively across pages and components in [src/components](src/components) and [src/pages](src/pages)

Import pattern:

```tsx
import { Settings, Loader2, AlertCircle } from "lucide-react";
```

Usage pattern:

```tsx
<Settings size={18} strokeWidth={2} />
```

Naming convention:

- PascalCase icon component names directly from Lucide catalog
- Aliasing when needed (example Link as LinkIcon)

Rule for Figma MCP:

- Map Figma icon nodes to Lucide names first
- If no Lucide equivalent exists, create a tracked exception and document in PR

---

## 6. Styling Approach

### 6.1 Methodology

Hybrid approach:

- Utility-first Tailwind classes in JSX
- Global CSS layers and semantic utility classes in [src/index.css](src/index.css)
- Runtime theming through CSS variables and HTML attributes/classes

Examples:

```css
/* src/index.css */
.app-shell {
  background-color: var(--app-shell-bg);
  color: var(--app-shell-fg);
}
.glass-panel {
  background: var(--glass-bg);
  border: 2px solid var(--glass-border);
}
```

```tsx
// component-level utility usage
<div className="rounded-2xl border bg-white/90 shadow-xl dark:bg-slate-900" />
```

### 6.2 Global Styles

Global styles live in [src/index.css](src/index.css):

- Fonts import
- Theme variable defaults and dark overrides
- Scrollbar styling
- App-shell atmosphere utilities
- Glass panel utilities

### 6.3 Responsive Design

Responsive implementation style:

- Tailwind breakpoints in class names (sm/md/lg/xl)
- Fluid layouts and max-width containers
- Feature sections commonly use grid/flex with breakpoint modifiers

Rule for Figma MCP:

- Always provide at least desktop + mobile variants when generating code from Figma
- Preserve existing breakpoint semantics rather than introducing custom media query systems

---

## 7. Project Structure

Top-level frontend organization in [src](src):

- [src/components](src/components): reusable and feature components
- [src/pages](src/pages): route-oriented pages
- [src/hooks](src/hooks): behavior/state orchestration hooks
- [src/services](src/services): client-side service interfaces
- [src/theme](src/theme): theme token maps and provider
- [src/utils](src/utils): helper utilities
- [src/auth](src/auth): auth context and integration
- [src/router.tsx](src/router.tsx): route map
- [src/App.tsx](src/App.tsx): heavy engineering workspace shell

Feature organization pattern:

- Domain-centric grouping (BT/MT topology, admin, settings, maps)
- Nested submodules for complex domains (example [src/components/BtTopologyPanel](src/components/BtTopologyPanel))

Rule for Figma MCP:

- Place new UI in existing domain folders instead of generic dumping
- For cross-feature primitives, colocate in [src/components](src/components) with explicit prop contracts

---

## 8. Figma MCP Integration Rules (Operational)

### 8.1 Source of Truth Priority

1. Runtime token variables in [src/theme/tokens.ts](src/theme/tokens.ts)
2. Semantic/global classes in [src/index.css](src/index.css)
3. Existing component API contracts in [src/components](src/components)
4. Tailwind extension tokens in [tailwind.config.js](tailwind.config.js) after config loading validation

### 8.2 Mapping Protocol

When converting Figma to code:

1. Extract colors, spacing, radius, typography from Figma node
2. Map to existing CSS variables first (app-shell, glass, enterprise palette)
3. Map icons to Lucide names
4. Reuse existing components/layout shells where possible
5. Keep route/page integration through [src/router.tsx](src/router.tsx)

### 8.3 Do / Do Not

Do:

- Reuse app-shell and glass utilities
- Preserve data-theme and dark class behavior
- Keep accessibility labels on icon-only controls
- Respect CI quality gates from docs

Do not:

- Introduce a second token system
- Hardcode design constants already available as tokens
- Add Storybook assumptions to workflow
- Break existing chunking boundaries in [vite.config.ts](vite.config.ts)

### 8.4 Validation Checklist for AI-Generated UI

- Typecheck: npm run typecheck:frontend
- Lint: npm run lint:frontend
- Tests: npm run test:frontend
- Build: npm run build
- A11y smoke: npm run a11y:smoke

Reference quality docs:

- [docs/FRONTEND_COMPONENT_GUIDELINES.md](docs/FRONTEND_COMPONENT_GUIDELINES.md)
- [docs/DEFINITION_OF_DONE_FRONTEND.md](docs/DEFINITION_OF_DONE_FRONTEND.md)

---

## 9. Known Gaps to Address Before Large Figma Rollouts

1. Tailwind v4 config loading should be explicitly verified/aligned with [tailwind.config.js](tailwind.config.js)
2. Branding files referenced by UI should be reconciled with actual [public/branding](public/branding) contents
3. If design velocity increases, consider introducing Storybook or equivalent component docs as a future enhancement
