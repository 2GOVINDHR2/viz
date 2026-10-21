import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `base` is relative so the static build works from any sub-path (GitHub Pages project site).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    // The UI fuzzer (invariant E) takes ~15 minutes, so it runs only from `npm run test:fuzz`, as its own CI job.
    include: [
      'tests/{unit,gradcheck,parity,determinism}/**/*.test.ts',
      ...(process.env.VITEST_FUZZ ? ['tests/fuzz/**/*.test.ts'] : []),
    ],
    environment: 'node',
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
