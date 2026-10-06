import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getDevHttpsConfig } from './vite.https.js'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: getDevHttpsConfig(),
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
