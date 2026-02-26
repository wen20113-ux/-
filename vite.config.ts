import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/260226_REPO/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
