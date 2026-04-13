import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


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
    'data:',
    'blob:',
    'https://*.tile.openstreetmap.org',
    'https://server.arcgisonline.com',
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
    `img-src ${dedupe(imgSrc).join(' ')}`,
    `connect-src ${dedupe(connectSrc).join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';
  const productionCsp = buildProductionCsp(env);

  const cspMetaPlugin = {
    name: 'inject-production-csp-meta',
    transformIndexHtml(html: string) {
      if (!isProduction) {
        return html;
      }

      const cspMeta = `  <meta http-equiv="Content-Security-Policy" content="${productionCsp}">`;
      return html.replace('</head>', `${cspMeta}\n</head>`);
    },
  };

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/downloads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [
      react(),
      cspMetaPlugin,
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.png'],
        manifest: {
          name: 'sisRUA Unified',
          short_name: 'sisRUA',
          description: 'Exportação Profissional OSM para DXF 2.5D',
          theme_color: '#4F46E5',
          background_color: '#0F172A',
          display: 'standalone',
          icons: [
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/overpass-api\.de\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'osm-data-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ]
        }
      })
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 500,
      minify: 'esbuild',
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            leaflet: ['leaflet', 'react-leaflet', 'proj4'],
            motion: ['framer-motion'],
            icons: ['lucide-react'],
            recharts: ['recharts'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'tests/',
          'legacy_src/',
          '*.config.ts',
          'dist/',
          'build/'
        ]
      }
    },
  };
});
