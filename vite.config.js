import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
