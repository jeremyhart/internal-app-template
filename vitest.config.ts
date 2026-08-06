import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: Vitest bundles its own copy of Vite, and
// sharing one config file makes the two plugin type universes collide.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
