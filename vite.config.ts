/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fieldlog-html',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  // Scope dep pre-scan to our entry HTML so it does not walk into
  // reference/vendor-docs/ (cloned upstream repos contain ~100 playground
  // index.html files and test-fixture packages that fail to resolve here).
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    // Keep chokidar out of reference/vendor-docs/ (~50k upstream-docs files).
    // Without this the dev server can take minutes to serve the first request
    // and HMR thrashes on file events from cloned vendor repos.
    watch: {
      ignored: ['**/reference/vendor-docs/**'],
    },
    // fs.deny prevents the dev server from serving any file under
    // reference/vendor-docs/ even if a stray import or URL reaches it.
    fs: {
      deny: ['**/reference/vendor-docs/**'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Restrict discovery to our app. Without this, Vitest's default include
    // glob walks into reference/vendor-docs/ and tries to run thousands of
    // test files from cloned upstream repos (MUI, Vitest, Zod, Vite, etc.).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
