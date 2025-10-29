import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    include: [
      'src/tests/**/*.test.ts',
      'src/tests/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/tests/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './src/client'),
      '@server': path.resolve(__dirname, './src/server'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
