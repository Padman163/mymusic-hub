import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../netlify/functions/contributions';

describe('Contributions-API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('weist nicht unterstützte HTTP-Methoden zurück', async () => {
    const response = await handler(new Request('http://localhost/api/contributions', { method: 'PUT' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Diese Methode wird nicht unterstützt.' });
  });

  it('meldet fehlende GitHub-Konfiguration mit HTTP 503', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.stubEnv('GITHUB_REPOSITORY', '');
    const response = await handler(new Request('http://localhost/api/contributions'));

    expect(response.status).toBe(503);
  });

  it('lehnt ungültiges JSON ab, ohne den GitHub-Store aufzurufen', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repository');
    const response = await handler(
      new Request('http://localhost/api/contributions', {
        method: 'POST',
        body: '{ungültig',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Die Anfrage enthält kein gültiges JSON.' });
  });

  it('lehnt Beiträge ohne gültigen Bereich vor dem Speichern ab', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repository');
    const response = await handler(
      new Request('http://localhost/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'Bug', title: 'Fehler' }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
