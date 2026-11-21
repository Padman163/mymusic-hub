import { verifyRequestOrigin } from '@netlify/identity';

type AfterWrite = (data: unknown) => Promise<void>;

function localProxyEnabled(): boolean {
	return process.env.NETLIFY_DEV === 'true' && process.env.LOCAL_NETLIFY_ONLINE_DATA === 'true';
}

function onlineOrigin(): string {
	const value = process.env.LOCAL_NETLIFY_IDENTITY_ORIGIN;
	if (!value) throw new Error('LOCAL_NETLIFY_IDENTITY_ORIGIN fehlt.');
	const url = new URL(value);
	if (url.protocol !== 'https:' || url.username || url.password ||
		url.pathname !== '/' || url.search || url.hash) {
		throw new Error('LOCAL_NETLIFY_IDENTITY_ORIGIN muss eine HTTPS-Site-Adresse ohne Pfad oder Zugangsdaten sein.');
	}
	return url.origin;
}

function forwardedHeaders(request: Request, origin: string): Headers {
	const headers = new Headers();
	for (const name of ['content-type', 'x-learning-account', 'x-learning-version']) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	const cookies = (request.headers.get('cookie') ?? '').split(';')
		.map((cookie) => cookie.trim())
		.filter((cookie) => /^nf_jwt=/.test(cookie));
	if (cookies.length) headers.set('cookie', cookies.join('; '));
	if (request.method !== 'GET') headers.set('origin', origin);
	return headers;
}

async function forward(request: Request, origin: string): Promise<Response> {
	const localUrl = new URL(request.url);
	const target = new URL(localUrl.pathname + localUrl.search, origin);
	return fetch(target, {
		method: request.method,
		headers: forwardedHeaders(request, origin),
		...(request.method === 'GET' ? {} : { body: await request.arrayBuffer() }),
		redirect: 'manual',
	});
}

export async function proxyOnlineDevRequest(
	request: Request,
	afterWrite?: AfterWrite,
): Promise<Response | null> {
	if (!localProxyEnabled()) return null;
	if (request.method !== 'GET') {
		try {
			verifyRequestOrigin(request);
		} catch {
			return Response.json({ error: 'Die Anfrage stammt nicht von dieser Website.' }, { status: 403 });
		}
	}

	let origin: string;
	let response: Response;
	try {
		origin = onlineOrigin();
		response = await forward(request, origin);
	} catch (error) {
		console.error('Der Online-Datenbestand ist lokal nicht erreichbar.', error);
		return Response.json({ error: 'Der Online-Datenbestand ist nicht erreichbar. Prüfe die lokale Netlify-Konfiguration.' }, { status: 502 });
	}
	if (response.status >= 300 && response.status < 400) {
		return Response.json({ error: 'Der Online-Datenendpunkt hat unerwartet weitergeleitet.' }, { status: 502 });
	}
	if (response.ok && request.method !== 'GET' && afterWrite) {
		try {
			const current = await forward(new Request(request.url, { headers: request.headers }), origin);
			if (!current.ok) throw new Error(`Online-Daten konnten nicht erneut geladen werden (HTTP ${current.status}).`);
			await afterWrite(await current.json());
		} catch (error) {
			console.error('Online gespeichert, aber lokale Kopien konnten nicht aktualisiert werden.', error);
			return Response.json({
				error: 'Online gespeichert, aber die lokalen Kopien konnten nicht aktualisiert werden. Bitte den lokalen Datenabgleich prüfen.',
			}, { status: 500 });
		}
	}
	const headers = new Headers({ 'Cache-Control': 'no-store' });
	const contentType = response.headers.get('content-type');
	if (contentType) headers.set('Content-Type', contentType);
	return new Response(response.body, { status: response.status, headers });
}
