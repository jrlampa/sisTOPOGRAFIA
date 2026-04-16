import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function parseSpaceSeparatedSources(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractOrigin(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildProductionCsp(env: Record<string, string>) {
  const apiOrigin = extractOrigin(env.VITE_API_URL);
  const connectSrc = [
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...parseSpaceSeparatedSources(env.VITE_CSP_CONNECT_SRC),
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://*.tile.openstreetmap.org",
    "https://server.arcgisonline.com",
    ...parseSpaceSeparatedSources(env.VITE_CSP_IMG_SRC),
  ];

  const dedupe = (values: string[]) => Array.from(new Set(values));

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self' data:",
    `img-src ${dedupe(imgSrc).join(" ")}`,
    `connect-src ${dedupe(connectSrc).join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const isProduction = mode === "production";
  const productionCsp = buildProductionCsp(env);

  const cspMetaPlugin = {
    name: "inject-production-csp-meta",
    transformIndexHtml(html: string) {
      if (!isProduction) {
        return html;
      }

      const cspMeta = `  <meta http-equiv="Content-Security-Policy" content="${productionCsp}">`;
      return html.replace("</head>", `${cspMeta}\n</head>`);
    },
  };

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
        "/downloads": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
        "/health": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      cspMetaPlugin,
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "logo.png"],
        manifest: {
          name: "sisRUA Unified",
          short_name: "sisRUA",
          description: "Exportação Profissional OSM para DXF 2.5D",
          theme_color: "#4F46E5",
          background_color: "#0F172A",
          display: "standalone",
          icons: [
            {
              src: "logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/overpass-api\.de\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "osm-data-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
              },
            },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      chunkSizeWarningLimit: 500,
      minify: "esbuild",
      target: "esnext",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/scheduler/")
            ) {
              return "vendor-react";
            }
            if (
              id.includes("node_modules/leaflet/") ||
              id.includes("node_modules/react-leaflet/") ||
              id.includes("node_modules/proj4/")
            ) {
              return "leaflet";
            }
            if (id.includes("node_modules/framer-motion/")) {
              return "motion";
            }
            if (id.includes("node_modules/lucide-react/")) {
              return "icons";
            }
            if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3") || id.includes("node_modules/victory-vendor/")) {
              return "recharts";
            }
            if (id.includes("node_modules/xlsx/")) {
              return "xlsx";
            }
            if (id.includes("node_modules/posthog-js/")) {
              return "analytics";
            }
            if (id.includes("node_modules/groq-sdk/") || id.includes("node_modules/groq/")) {
              return "ai-sdk";
            }
            if (id.includes("node_modules/jszip/")) {
              return "jszip";
            }
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          "tests/",
          "legacy_src/",
          "*.config.ts",
          "dist/",
          "build/",
        ],
      },
    },
  };
});
