// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdminWrite } from '../netlify/functions/lib/admin-write';
import { proxyOnlineDevRequest } from '../netlify/functions/lib/online-dev-proxy';

const getUser = vi.hoisted(() => vi.fn());
vi.mock('@netlify/identity', async (importOriginal) => ({
	...await importOriginal<typeof import('@netlify/identity')>(),
	getUser,
}));

describe('Gemeinsame Online-Daten', () => {
	beforeEach(() => {
		getUser.mockReset().mockResolvedValue({ id: 'admin', roles: ['admin'] });
		vi.stubEnv('NETLIFY_DEV', 'true');
		vi.stubEnv('LOCAL_NETLIFY_ONLINE_DATA', 'true');
		vi.stubEnv('LOCAL_NETLIFY_IDENTITY_ORIGIN', 'https://example.netlify.app');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('erfordert Admin-Rolle und passenden Origin für Schreibzugriffe', async () => {
		const request = new Request('https://example.netlify.app/api/modules', {
			method: 'POST', headers: { origin: 'https://example.netlify.app' },
		});
		getUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user', roles: [] });
		expect((await authorizeAdminWrite(request))?.status).toBe(401);
		expect((await authorizeAdminWrite(request))?.status).toBe(403);
		expect(await authorizeAdminWrite(request)).toBeNull();
		expect((await authorizeAdminWrite(new Request(request.url, {
			method: 'POST', headers: { origin: 'https://evil.example' },
		})))?.status).toBe(403);
	});

	it('leitet nur das Sitzungscookie und benötigte Daten weiter und aktualisiert Kopien', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(Response.json({ saved: true }, { status: 201 }))
			.mockResolvedValueOnce(Response.json({ modules: [], questions: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const afterWrite = vi.fn().mockResolvedValue(undefined);
		const response = await proxyOnlineDevRequest(new Request('http://localhost:8888/api/modules', {
			method: 'POST',
			headers: {
				origin: 'http://localhost:8888',
				cookie: 'nf_jwt=jwt; nf_refresh=refresh; unrelated=private',
				'content-type': 'application/json',
			},
			body: '{"title":"Test"}',
		}), afterWrite);
		expect(response?.status).toBe(201);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [url, options] = fetchMock.mock.calls[0];
		expect(url.href).toBe('https://example.netlify.app/api/modules');
		expect(options.headers.get('cookie')).toBe('nf_jwt=jwt');
		expect(options.headers.get('origin')).toBe('https://example.netlify.app');
		expect(options.redirect).toBe('manual');
		expect(afterWrite).toHaveBeenCalledWith({ modules: [], questions: [] });
	});

	it('verweigert fremde Origins und Weiterleitungen ohne lokale Aktualisierung', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
			status: 302, headers: { location: 'https://other.example' },
		}));
		vi.stubGlobal('fetch', fetchMock);
		const afterWrite = vi.fn();
		const request = (origin: string) => new Request('http://localhost:8888/api/modules', {
			method: 'POST', headers: { origin },
		});
		expect((await proxyOnlineDevRequest(request('https://evil.example'), afterWrite))?.status).toBe(403);
		expect(fetchMock).not.toHaveBeenCalled();
		expect((await proxyOnlineDevRequest(request('http://localhost:8888'), afterWrite))?.status).toBe(502);
		expect(afterWrite).not.toHaveBeenCalled();
	});

	it('leitet Konto- und Versionskennung des persönlichen Lernstands weiter', async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ progress: {}, version: 'next' }));
		vi.stubGlobal('fetch', fetchMock);
		const response = await proxyOnlineDevRequest(new Request('http://localhost:8888/api/learning-progress', {
			method: 'PUT',
			headers: {
				origin: 'http://localhost:8888',
				'x-learning-account': 'account',
				'x-learning-version': 'previous',
				'content-type': 'application/json',
			},
			body: '{"accountId":"account","progress":{}}',
		}));
		expect(response?.status).toBe(200);
		const [, options] = fetchMock.mock.calls[0];
		expect(options.headers.get('x-learning-account')).toBe('account');
		expect(options.headers.get('x-learning-version')).toBe('previous');
		expect(new TextDecoder().decode(options.body)).toBe('{"accountId":"account","progress":{}}');
	});

	it('meldet einen fehlgeschlagenen Kopierabgleich nach Online-Speicherung', async () => {
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce(Response.json({}, { status: 201 }))
			.mockResolvedValueOnce(Response.json({})));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await proxyOnlineDevRequest(new Request('http://localhost:8888/api/modules', {
			method: 'POST', headers: { origin: 'http://localhost:8888' },
		}), vi.fn().mockRejectedValue(new Error('disk error')));
		expect(response?.status).toBe(500);
		expect((await response?.json()).error).toContain('Online gespeichert');
	});

	it('verwendet ohne explizite Aktivierung den bestehenden lokalen Store', async () => {
		vi.stubEnv('LOCAL_NETLIFY_ONLINE_DATA', 'false');
		expect(await proxyOnlineDevRequest(new Request('http://localhost:8888/api/modules'))).toBeNull();
	});
});
