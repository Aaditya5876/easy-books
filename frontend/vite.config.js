import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // recharts 2.x ships react-is 18, which doesn't recognise React 19
      // elements — charts then render empty. Always bundle the frontend's own
      // react-is (19, same major as react).
      'react-is': path.dirname(require.resolve('react-is/package.json')),
      // shared/dist is CommonJS (for the backend), which the dev server can't
      // serve to the browser as ESM. Use the TypeScript source directly — Vite
      // compiles it, and edits to shared show up without a rebuild.
      '@easy-books/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
