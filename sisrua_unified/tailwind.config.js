import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  darkMode: "class",
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Severity scale — used for CQT, validations, health indicators
        severity: {
          ok: { DEFAULT: "#16a34a", light: "#dcfce7", border: "#86efac" },
          warn: { DEFAULT: "#d97706", light: "#fef3c7", border: "#fcd34d" },
          critical: { DEFAULT: "#dc2626", light: "#fee2e2", border: "#fca5a5" },
        },
        // Mapping to CSS variables from tokens.ts
        app: {
          shell: {
            bg: "var(--app-shell-bg)",
            fg: "var(--app-shell-fg)",
          },
          header: {
            bg: "var(--app-header-bg)",
            border: "var(--app-header-border)",
          },
          sidebar: {
            bg: "var(--app-sidebar-bg)",
            border: "var(--app-sidebar-border)",
          },
          panel: {
            bg: "var(--app-panel-bg)",
            border: "var(--app-panel-border)",
            shadow: "var(--app-panel-shadow)",
          },
          title: "var(--text-app-title)",
          subtle: "var(--text-app-subtle)",
        },
        // Surface tokens (glass-morphism panels)
        surface: {
          glass: "var(--glass-bg)",
          soft: "var(--surface-soft)",
          strong: "var(--surface-strong)",
          "glass-dark": "rgba(15,23,42,0.7)",
          overlay: "rgba(15,23,42,0.4)",
        },
        glass: {
          border: "var(--glass-border)",
          "border-hover": "var(--glass-border-hover)",
          "hover-bg": "var(--glass-hover-bg)",
        },
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      zIndex: {
        flat: "0",
        raised: "10",
        floating: "20",
        sticky: "30",
        modal: "40",
      },
      borderRadius: {
        card: "1.5rem", // 24px — stat cards
        panel: "0.75rem", // 12px — secondary panels
        chip: "0.5rem", // 8px  — badges / chips
      },
      boxShadow: {
        severity: "0 0 0 3px currentColor",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
