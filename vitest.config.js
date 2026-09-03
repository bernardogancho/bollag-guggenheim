import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js', 'test/**/*.test.js'],
    setupFiles: ['src/admin/lib/__tests__/setup.js'],
    passWithNoTests: true,
  },
});
