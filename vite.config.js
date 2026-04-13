import { defineConfig } from 'vite';
import { resolve } from 'path';
import handlebars from './plugins/handlebars.js';

export default defineConfig(({ mode }) => ({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  base: mode === 'production' ? '/smartroom-storage/' : '/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        admin: resolve(__dirname, 'src/admin.html'),
        wp: resolve(__dirname, 'src/wp.html'),
        'payment-success': resolve(__dirname, 'src/payment-success.html'),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  plugins: [
    handlebars({
      partialDirectory: resolve(__dirname, 'src/partials'),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/js'),
    },
  },
}));
