import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh for better development experience
      fastRefresh: true,
    }), 
    tailwind()
  ],
  build: {
    outDir: '../../dist/client',
    sourcemap: true,
    // Performance optimizations
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        sourcemapFileNames: '[name].js.map',
        // Code splitting for better caching
        manualChunks: {
          // Separate vendor chunks for better caching
          react: ['react', 'react-dom'],
          // Separate lazy-loaded components
          components: ['./src/components/Leaderboard.tsx', './src/components/Archive.tsx'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  // Development server optimizations
  server: {
    hmr: {
      overlay: false, // Disable error overlay for better mobile testing
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: [], // Don't pre-bundle large dependencies
  },
});
