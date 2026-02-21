import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // Use Vite default chunk splitting to avoid runtime module init ordering issues
      chunkSizeWarningLimit: 500,
      // Use esbuild minification (faster and already included)
      minify: 'esbuild',
      target: 'esnext'
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'src/hooks/**/*.{ts,tsx}',
          'src/services/**/*.{ts,tsx}',
          'src/utils/**/*.{ts,tsx}',
          'src/config/api.ts',
          'src/constants.ts',
          'src/contexts/AuthContext.tsx',
          'src/components/ui/Toast.tsx',
          'src/components/ui/ProgressIndicator.tsx',
          'src/components/ui/ErrorBoundary.tsx',
          'src/components/settings/LayerToggle.tsx',
          'src/components/settings/NestedLayerToggle.tsx',
          'src/components/settings/SettingsExportFooter.tsx',
          'src/components/layout/HistoryControls.tsx',
          'src/components/gis/DxfLegend.tsx',
        ],
        thresholds: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
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
