// vitest.config.ts
import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

export default getViteConfig(
  defineConfig({
    test: {
      // Erkennt Unit-, Komponenten- und Integrationstests
      include: ['tests/**/*.{test,spec}.{ts,js,mjs}'],
      exclude: ['tests/e2e/**'],
      environment: 'node', // auf 'happy-dom' ändern, falls DOM-Simulation benötigt wird
      globals: true,
    },
  }),
);