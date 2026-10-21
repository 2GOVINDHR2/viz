/**
 * Unit-suite mutant (ADR-054): runs the unit tests with every server render replaced by an empty screen.
 * A test that still passes either does not render, or renders without checking what it rendered.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'react-dom/server': fileURLToPath(new URL('./blank-server.ts', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 240_000 },
});
