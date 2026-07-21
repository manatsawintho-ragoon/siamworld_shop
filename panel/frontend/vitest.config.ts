import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Mirrors the "@/*" -> "src/*" alias in tsconfig.json so imports in tests
    // resolve the same way they do in the Next build.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
