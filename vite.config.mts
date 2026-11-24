import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [react(), tailwindcss(),{name:'development-csp',apply:'serve',transformIndexHtml:html=>html.replace("connect-src 'self'","connect-src 'self' ws://localhost:5173")}],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: { outDir: resolve(import.meta.dirname, 'dist'), emptyOutDir: true },
  server: { port: 5173, strictPort: true }
});
