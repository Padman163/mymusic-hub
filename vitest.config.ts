// vitest.config.ts
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Erkennt Unit-, Komponenten- und Integrationstests
    include: ['tests/**/*.{test,spec}.{ts,js,mjs}'],
    environment: 'node', // auf 'happy-dom' ändern, falls DOM-Simulation benötigt wird
    globals: true,
  },
});