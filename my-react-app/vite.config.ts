import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    // In development the site calls /api/... and Vite forwards it to the FastAPI backend,
    // so the browser sees one origin and no CORS setup is needed.
    proxy: {
      '/api': {
        // Override with API_PROXY_TARGET=http://host:port if the backend runs elsewhere.
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:6767',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
