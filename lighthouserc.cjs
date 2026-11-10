module.exports = {
  ci: {
    collect: {
      // Testet direkt den generierten Astro-Build-Ordner ohne separaten Server-Prozess
      staticDistDir: './dist',
      numberOfRuns: 1,
      settings: {
        // Unverzichtbar in Linux-Container-/Codespace-Umgebungen
        chromeFlags: '--no-sandbox --headless --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};