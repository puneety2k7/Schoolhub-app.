import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared/src') } },
  // Ports come from v2.config.env via the start script; defaults avoid the old SchoolHub ports (4010 / 8080).
  server: { host: process.env.V2_FRONTEND_HOST ?? '127.0.0.1', port: Number(process.env.V2_FRONTEND_PORT ?? 5180), strictPort: true, proxy: { '/api': process.env.V2_API_URL ?? 'http://127.0.0.1:4120' } },
  preview: { host: process.env.V2_FRONTEND_HOST ?? '127.0.0.1', port: Number(process.env.V2_FRONTEND_PORT ?? 5180), strictPort: true, proxy: { '/api': process.env.V2_API_URL ?? 'http://127.0.0.1:4120' } },
});
