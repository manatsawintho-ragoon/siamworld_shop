import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // tsconfig keeps jsx: "preserve" for the Next compiler, so tell the test
  // transform how to compile the JSX in component tests itself.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // Mirrors the "@/*" -> "src/*" alias in tsconfig.json so imports in tests
    // resolve the same way they do in the Next build.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
