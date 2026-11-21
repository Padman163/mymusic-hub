import { getUser, verifyRequestOrigin } from '@netlify/identity';
import type { Config } from '@netlify/functions';
import {
	sanitizeStoredProgress,
} from '../../src/lib/learning-progress';
import { readBlobJSON } from './lib/blob-store';
import { progressKey, progressReadOptions as jsonOptions, progressStore } from './lib/learning-progress-store';
import { proxyOnlineDevRequest } from './lib/online-dev-proxy';

const maxRequestBytes = 500_000;

export const config: Config = {
	path: '/api/learning-progress',
};

function jsonResponse(
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
			...headers,
		},
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default async (request: Request): Promise<Response> => {
	if (!['GET', 'PUT'].includes(request.method)) {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	const proxied = await proxyOnlineDevRequest(request);
	if (proxied) return proxied;

	const user = await getUser();
	if (!user) {
		return jsonResponse(401, { error: 'Bitte melde dich an, um den Lernstand zu synchronisieren.' });
	}
	if (request.headers.get('x-learning-account') !== user.id) {
		return jsonResponse(403, { error: 'Das angemeldete Konto stimmt nicht mit der Anfrage überein.' });
	}

	let store: ReturnType<typeof progressStore>;
	try {
		store = progressStore();
	} catch (error) {
		console.error('Der persönliche Blob-Store ist nicht verfügbar.', error);
		return jsonResponse(503, { error: 'Die Online-Speicherung ist derzeit nicht verfügbar.' });
	}
	const key = progressKey(user.id);

	if (request.method === 'GET') {
		try {
			const entry = await store.getWithMetadata(key, jsonOptions);
			if (!entry) return jsonResponse(200, { progress: null, version: null });
			const database = await readBlobJSON('modules');
			const progress = sanitizeStoredProgress(entry.data, database.modules);
			if (!progress) {
				console.error('Ein gespeicherter Lernstand hat ein ungültiges Format.');
				return jsonResponse(502, { error: 'Der gespeicherte Lernstand ist ungültig.' });
			}
			return jsonResponse(200, { progress, version: entry.etag });
		} catch (error) {
			console.error('Der persönliche Lernstand konnte nicht geladen werden.', error);
			return jsonResponse(502, { error: 'Der Lernstand konnte derzeit nicht geladen werden.' });
		}
	}

	try {
		verifyRequestOrigin(request);
	} catch {
		return jsonResponse(403, { error: 'Die Anfrage stammt nicht von dieser Website.' });
	}

	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
		return jsonResponse(413, { error: 'Der Lernstand ist zu groß.' });
	}

	let body: unknown;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return jsonResponse(400, { error: 'Die Anfrage enthält kein gültiges JSON.' });
	}
	if (!isRecord(body) || body.accountId !== user.id || !('progress' in body)) {
		return jsonResponse(400, { error: 'Der Lernstand ist ungültig.' });
	}

	try {
		const database = await readBlobJSON('modules');
		const progress = sanitizeStoredProgress(body.progress, database.modules);
		if (!progress) return jsonResponse(400, { error: 'Der Lernstand ist ungültig.' });

		const current = await store.getWithMetadata(key, jsonOptions);
		const expectedVersion = request.headers.get('x-learning-version');
		if (current && expectedVersion !== current.etag) {
			return jsonResponse(409, { error: 'Der Lernstand wurde auf einem anderen Gerät geändert. Bitte lade ihn neu.' });
		}
		if (!current && expectedVersion) {
			return jsonResponse(409, { error: 'Der Lernstand wurde zwischenzeitlich angelegt. Bitte lade ihn neu.' });
		}

		const result = await store.setJSON(
			key,
			progress,
			current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
		);
		if (!result.modified) {
			return jsonResponse(409, { error: 'Der Lernstand wurde zwischenzeitlich geändert. Bitte lade ihn neu.' });
		}
		const saved = await store.getWithMetadata(key, jsonOptions);
		if (!saved) throw new Error('Der gespeicherte Lernstand konnte nicht erneut geladen werden.');
		return jsonResponse(200, { progress: saved.data, version: saved.etag });
	} catch (error) {
		console.error('Der persönliche Lernstand konnte nicht gespeichert werden.', error);
		return jsonResponse(502, { error: 'Der Lernstand konnte derzeit nicht gespeichert werden.' });
	}
};
