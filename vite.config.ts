import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Scope dep pre-scan to our entry HTML so it does not walk into
  // reference/vendor-docs/ (cloned upstream repos contain ~100 playground
  // index.html files and test-fixture packages that fail to resolve here).
  optimizeDeps: {
    entries: ['index.html'],
  },
})
