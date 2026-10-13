import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `base` is relative so the static build works from any sub-path (GitHub Pages project site).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    include: ['tests/{unit,gradcheck,parity,determinism}/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
