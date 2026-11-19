import {
	getIdentityConfig,
	getSettings,
	getUser,
	verifyRequestOrigin,
} from '@netlify/identity';
import type { Config } from '@netlify/functions';

const maxRequestBytes = 2_000;

export const config: Config = {
	path: '/api/admin/identity',
};

function jsonResponse(
	status: number,
	body: unknown,
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidEmail(value: string): boolean {
	return value.length <= 254 &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async (request: Request): Promise<Response> => {
	if (!['GET', 'POST'].includes(request.method)) {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	const user = await getUser();
	if (!user) {
		return jsonResponse(401, { error: 'Bitte melde dich mit einem Admin-Konto an.' });
	}
	if (!user.roles?.includes('admin')) {
		return jsonResponse(403, { error: 'Für diese Funktion ist die Netlify-Identity-Rolle „admin“ erforderlich.' });
	}

	if (request.method === 'GET') {
		try {
			const settings = await getSettings();
			return jsonResponse(200, {
				registration: {
					signupEnabled: !settings.disableSignup,
					emailProviderEnabled: settings.providers.email,
				},
			});
		} catch (error) {
			console.error('Die Identity-Einstellungen konnten nicht gelesen werden.', error);
			return jsonResponse(503, { error: 'Die Registrierungsoptionen konnten nicht geladen werden.' });
		}
	}

	try {
		verifyRequestOrigin(request);
	} catch {
		return jsonResponse(403, { error: 'Die Anfrage stammt nicht von dieser Website.' });
	}

	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
		return jsonResponse(413, { error: 'Die Anfrage ist zu groß.' });
	}

	let body: unknown;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return jsonResponse(400, { error: 'Die Anfrage enthält kein gültiges JSON.' });
	}
	if (!isRecord(body) || typeof body.email !== 'string') {
		return jsonResponse(400, { error: 'Gib eine gültige E-Mail-Adresse ein.' });
	}

	const email = body.email.trim().toLowerCase();
	if (!isValidEmail(email)) {
		return jsonResponse(400, { error: 'Gib eine gültige E-Mail-Adresse ein.' });
	}

	const identity = getIdentityConfig();
	if (!identity?.token) {
		return jsonResponse(503, { error: 'Die serverseitige Identity-Verwaltung ist nicht verfügbar.' });
	}

	try {
		const response = await fetch(`${identity.url.replace(/\/+$/, '')}/invite`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${identity.token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email }),
		});
		if (!response.ok) {
			console.error('Netlify Identity hat die Einladung abgelehnt.', {
				status: response.status,
			});
			if (response.status === 422) {
				return jsonResponse(409, {
					error: 'Für diese E-Mail-Adresse besteht möglicherweise bereits ein Konto oder eine Einladung.',
				});
			}
			if (response.status === 429) {
				return jsonResponse(429, {
					error: 'Es wurden zu viele Einladungen angefordert. Bitte versuche es später erneut.',
				});
			}
			return jsonResponse(502, { error: 'Netlify Identity konnte die Einladung nicht versenden.' });
		}
		return jsonResponse(201, { message: 'Die Einladung wurde versendet.' });
	} catch (error) {
		console.error('Netlify Identity ist beim Versenden der Einladung nicht erreichbar.', error);
		return jsonResponse(502, { error: 'Netlify Identity konnte die Einladung nicht versenden.' });
	}
};
