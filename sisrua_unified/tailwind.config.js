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
        // Surface tokens (glass-morphism panels)
        surface: {
          glass: "rgba(255,255,255,0.7)",
          "glass-dark": "rgba(15,23,42,0.7)",
          overlay: "rgba(15,23,42,0.4)",
        },
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
      },
    },
  },
  plugins: [],
};
