import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../netlify/functions/admin-identity';

const identityMocks = vi.hoisted(() => ({
	getIdentityConfig: vi.fn(),
	getSettings: vi.fn(),
	getUser: vi.fn(),
	verifyRequestOrigin: vi.fn(),
}));

vi.mock('@netlify/identity', () => identityMocks);

describe('Admin-Identity-API', () => {
	beforeEach(() => {
		identityMocks.getIdentityConfig.mockReset().mockReturnValue({
			url: 'https://example.netlify.app/.netlify/identity',
			token: 'operator-token',
		});
		identityMocks.getSettings.mockReset().mockResolvedValue({
			autoconfirm: false,
			disableSignup: true,
			providers: { email: true },
		});
		identityMocks.getUser.mockReset().mockResolvedValue({
			id: 'admin-user',
			roles: ['admin'],
		});
		identityMocks.verifyRequestOrigin.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('verweigert unauthentifizierten Konten den Zugriff', async () => {
		identityMocks.getUser.mockResolvedValue(null);

		const response = await handler(new Request('https://example.netlify.app/api/admin/identity'));

		expect(response.status).toBe(401);
		expect(identityMocks.getSettings).not.toHaveBeenCalled();
	});

	it('verweigert eingeloggten Konten ohne Admin-Rolle den Zugriff', async () => {
		identityMocks.getUser.mockResolvedValue({ id: 'learner', roles: [] });

		const response = await handler(new Request('https://example.netlify.app/api/admin/identity'));

		expect(response.status).toBe(403);
		expect(identityMocks.getSettings).not.toHaveBeenCalled();
	});

	it('liefert den aktuellen Registrierungsmodus für Admins', async () => {
		const response = await handler(new Request('https://example.netlify.app/api/admin/identity'));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			registration: {
				signupEnabled: false,
				emailProviderEnabled: true,
			},
		});
	});

	it('versendet Einladungen nur nach erfolgreicher Origin-Prüfung', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const response = await handler(new Request('https://example.netlify.app/api/admin/identity', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Origin: 'https://example.netlify.app',
			},
			body: JSON.stringify({ email: ' New.User@Example.com ' }),
		}));

		expect(response.status).toBe(201);
		expect(identityMocks.verifyRequestOrigin).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.netlify.app/.netlify/identity/invite',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					Authorization: 'Bearer operator-token',
				}),
				body: JSON.stringify({ email: 'new.user@example.com' }),
			}),
		);
	});

	it('lehnt ungültige E-Mail-Adressen ab, ohne Identity aufzurufen', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const response = await handler(new Request('https://example.netlify.app/api/admin/identity', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Origin: 'https://example.netlify.app',
			},
			body: JSON.stringify({ email: 'invalid' }),
		}));

		expect(response.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
