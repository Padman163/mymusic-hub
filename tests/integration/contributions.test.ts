import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../netlify/functions/contributions';
import { defaultContributionPriority } from '../../src/lib/contribution-priority';
import { defaultContributionStatus } from '../../src/lib/contribution-status';
import { mockBlobStore } from '../fixtures/blob-store';

const getStoreMock = vi.hoisted(() => vi.fn<(name: string) => ReturnType<typeof mockBlobStore>>());
vi.mock('@netlify/blobs', () => ({ getStore: getStoreMock }));
const identity = vi.hoisted(() => ({
  getUser: vi.fn(),
  verifyRequestOrigin: vi.fn(),
}));
vi.mock('@netlify/identity', () => identity);

describe('Contributions-API', () => {
  let store: ReturnType<typeof mockBlobStore>;
  beforeEach(() => {
    vi.stubEnv("NETLIFY_DEV", "false");
    vi.stubEnv("LOCAL_NETLIFY_ONLINE_DATA", "false");
    identity.getUser.mockReset().mockResolvedValue({ id: 'admin', roles: ['admin'] });
    identity.verifyRequestOrigin.mockReset();
    store = mockBlobStore();
    store.put('contributions', []);
    getStoreMock.mockReset().mockReturnValue(store);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('weist nicht unterstützte HTTP-Methoden zurück', async () => {
    const response = await handler(new Request('http://localhost/api/contributions', { method: 'PUT' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Diese Methode wird nicht unterstützt.' });
  });

  it('meldet fehlenden Blob-Kontext mit HTTP 503', async () => {
    getStoreMock.mockImplementation(() => {
      throw Object.assign(new Error('Kein Blob-Kontext'), { name: 'MissingBlobsEnvironmentError' });
    });
    const response = await handler(new Request('http://localhost/api/contributions'));

    expect(response.status).toBe(503);
  });

  it('lehnt ungültiges JSON ab, ohne den Blob-Store aufzurufen', async () => {
    const response = await handler(
      new Request('http://localhost/api/contributions', {
        method: 'POST',
        body: '{ungültig',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Die Anfrage enthält kein gültiges JSON.' });
    expect(getStoreMock).not.toHaveBeenCalled();
  });

  it('erlaubt in Deploy-Vorschauen nur Admins Änderungen', async () => {
    vi.stubEnv('CONTEXT', 'deploy-preview');
    vi.stubEnv('NETLIFY_DEV', 'false');

    const read = await handler(new Request('http://localhost/api/contributions'));
    expect(read.status).toBe(200);

    identity.getUser.mockResolvedValueOnce({ id: 'learner', roles: [] });
    const write = await handler(new Request('http://localhost/api/contributions', {
      method: 'POST',
      body: JSON.stringify({ type: 'Bug', title: 'Preview', area: 'Theorie' }),
    }));
    expect(write.status).toBe(403);
    expect(store.value('contributions')).toEqual([]);
    const adminWrite = await handler(new Request('http://localhost/api/contributions', {
      method: 'POST',
      body: JSON.stringify({ type: 'Bug', title: 'Preview', area: 'Theorie' }),
    }));
    expect(adminWrite.status).toBe(201);
  });

  it('lehnt Beiträge ohne gültigen Bereich vor dem Speichern ab', async () => {
    const response = await handler(
      new Request('http://localhost/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'Bug', title: 'Fehler' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('speichert Defaults und behält den Konflikt- und Löschschutz bei', async () => {
    const request = (method: string, body?: unknown) => handler(new Request('http://localhost/api/contributions', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const fields = { type: 'Bug', title: 'Test', description: '', area: 'Theorie' };
    const post = await request('POST', fields);
    expect(post.status).toBe(201);
    const { contribution } = await post.json();
    expect(contribution).toMatchObject({ priority: defaultContributionPriority, status: defaultContributionStatus });
    expect(await (await request('GET')).json()).toEqual({ contributions: [contribution] });

    expect((await request('PATCH', { expected: contribution, fields: { ...fields, title: 'Korrigiert' } })).status).toBe(200);
    expect((await request('DELETE', { expected: contribution })).status).toBe(409);
    const updated = { ...contribution, title: 'Korrigiert' };
    expect((await request('DELETE', { expected: updated })).status).toBe(200);
    expect((await request('DELETE', { expected: updated })).status).toBe(404);
  });
});
