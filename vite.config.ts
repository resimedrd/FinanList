import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react-core': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-appwrite': ['appwrite'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable']
        }
      }
    }
  }
});
