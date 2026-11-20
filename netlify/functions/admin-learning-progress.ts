import { admin, AuthError, getUser, verifyRequestOrigin, type User } from '@netlify/identity';
import type { Config, Context } from '@netlify/functions';
import { getAvailableXp, restartModuleProgress, sanitizeStoredProgress } from '../../src/lib/learning-progress';
import { canManageOnlineData } from './lib/admin-data-access';
import { readBlobJSON } from './lib/blob-store';
import { progressKey, progressReadOptions, progressStore } from './lib/learning-progress-store';
import { proxyOnlineDevRequest } from './lib/online-dev-proxy';

export const config: Config = { path: '/api/admin/learning-progress' };
const pageSize = 25;

function json(body: unknown, status = 200) {
	return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function account({ id, name, email }: User) {
	return { id, name, email };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasProgress(entry: ReturnType<typeof restartModuleProgress>) {
	return entry.status === 'completed' || entry.completedVia !== undefined ||
		entry.solvedQuestionIds.length > 0 || entry.completedTheoryBlockIds.length > 0 ||
		entry.completedPracticeBlockIds.length > 0 || entry.bestQuizEasyScore !== undefined ||
		entry.bestFastlaneScore !== undefined || Object.values(entry.steps).includes('completed');
}

export default async (request: Request, context: Context): Promise<Response> => {
	const writable = canManageOnlineData(context);
	const query = new URL(request.url).searchParams;
	const id = query.get('id');
	const writing = request.method === 'POST';
	if (!writing && request.method !== 'GET') return json({ error: 'Diese Methode wird nicht unterstützt.' }, 405);
	if (writing && !writable) return json({ error: 'Hier ist nur die Ansicht verfügbar.' }, 403);
	if ((id !== null || writing) && (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id))) {
		return json({ error: 'Ungültige Konto-ID.' }, 400);
	}

	try {
		if (process.env.NETLIFY_DEV === 'true') {
			const proxied = await proxyOnlineDevRequest(request);
			if (!proxied) return json({ error: 'Die Online-Übersicht benötigt LOCAL_NETLIFY_ONLINE_DATA=true.' }, 409);
			return proxied.ok ? json({ ...await proxied.json(), writable: false }) : proxied;
		}

		const user = await getUser();
		if (!user) return json({ error: 'Bitte melde dich mit einem Admin-Konto an.' }, 401);
		if (!user.roles?.includes('admin')) return json({ error: 'Für den Zugriff ist die Rolle „admin“ erforderlich.' }, 403);
		if (writing) {
			try {
				verifyRequestOrigin(request);
			} catch {
				return json({ error: 'Die Anfrage stammt nicht von dieser Website.' }, 403);
			}
		}

		if (id === null) {
			const page = Number(query.get('page') ?? '1');
			if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
				return json({ error: 'Ungültige Seitennummer.' }, 400);
			}
			const users = await admin.listUsers({ page, perPage: pageSize });
			return json({ users: users.map(account), hasMore: users.length === pageSize, writable });
		}

		let reset: { moduleId: string; version: string } | undefined;
		if (writing) {
			if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
				return json({ error: 'Die Anfrage muss JSON enthalten.' }, 415);
			}
			const body = await request.text();
			if (body.length > 2048) return json({ error: 'Die Anfrage ist zu groß.' }, 413);
			let value: unknown;
			try {
				value = JSON.parse(body);
			} catch {
				return json({ error: 'Die Anfrage enthält kein gültiges JSON.' }, 400);
			}
			if (!isRecord(value) || typeof value.moduleId !== 'string' || typeof value.version !== 'string' ||
				value.confirmation !== 'ZURÜCKSETZEN') return json({ error: 'Ungültige Anfrage oder fehlende Bestätigung.' }, 400);
			reset = { moduleId: value.moduleId, version: value.version };
		}

		const target = await admin.getUser(id);
		const store = progressStore();
		const key = progressKey(target.id);
		const entry = await store.getWithMetadata(key, progressReadOptions);
		if (!entry) {
			return reset ? json({ error: 'Das Konto hat keinen gespeicherten Lernstand.' }, 409)
				: json({ user: account(target), progress: null, writable });
		}
		const { modules } = await readBlobJSON('modules');
		const raw: unknown = entry.data;
		const state = sanitizeStoredProgress(raw, modules);
		if (!state || !isRecord(raw) || !isRecord(raw.modules) || !entry.etag) {
			console.error('Der gespeicherte Lernstand hat kein gültiges Format oder keine Version.');
			return json({ error: 'Der gespeicherte Lernstand ist ungültig.' }, 502);
		}
		if (reset) {
			const conflict = 'Der Lernstand hat sich geändert. Lade das Konto erneut.';
			if (reset.version !== entry.etag) return json({ error: conflict }, 409);
			const module = modules.find(({ id: moduleId }) => moduleId === reset.moduleId);
			const before = module && Object.hasOwn(state.modules, module.id) ? state.modules[module.id] : undefined;
			if (!before || !hasProgress(before)) return json({ error: 'Für diesen Lehrgang gibt es keinen zurücksetzbaren Fortschritt.' }, 409);
			const after = { ...raw, modules: { ...raw.modules, [before.moduleId]: restartModuleProgress(before) }, updatedAt: new Date().toISOString() };
			const result = await store.setJSON(key, after, { onlyIfMatch: entry.etag });
			return result.modified ? json({ saved: true }) : json({ error: conflict }, 409);
		}
		return json({
			user: account(target), writable, version: entry.etag,
			progress: {
				totalXp: state.totalXp, spentXp: state.spentXp, availableXp: getAvailableXp(state),
				inventory: state.inventory.map(({ id: itemId, title, unlockedAt }) => ({ id: itemId, title, unlockedAt })),
				modules: modules.map(({ id: moduleId, title, archived }) => {
					const entry = state.modules[moduleId];
					return {
						id: moduleId, title, archived, status: entry.status, steps: entry.steps,
						completedVia: entry.completedVia, solved: entry.solvedQuestionIds.length,
						resettable: hasProgress(entry),
					};
				}),
			},
		});
	} catch (error) {
		if (error instanceof AuthError && error.status === 404) return json({ error: 'Das Konto wurde nicht gefunden.' }, 404);
		console.error('Die Admin-Lernstandsanfrage ist fehlgeschlagen.', { writing });
		return json({ error: writing ? 'Der Reset wurde nicht bestätigt. Lade den Lernstand neu, bevor du es erneut versuchst.' :
			'Die Konten oder der Online-Lernstand konnten nicht geladen werden.' }, 502);
	}
};
