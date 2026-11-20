import type { Config, Context } from '@netlify/functions';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { adminBackups, BackupError, isBackupId } from './lib/admin-backups';
import { proxyOnlineDevRequest } from './lib/online-dev-proxy';

export const config: Config = { path: '/api/admin/backups' };

const noStore = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200) {
	return Response.json(body, { status, headers: noStore });
}

async function readAction(request: Request): Promise<Record<string, unknown>> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
		throw new BackupError(415, 'Die Anfrage muss JSON enthalten.');
	}
	const reader = request.body?.getReader();
	if (!reader) throw new BackupError(400, 'Die Anfrage ist leer.');
	let body = '';
	let size = 0;
	const decoder = new TextDecoder();
	for (;;) {
		const next = await reader.read();
		if (next.done) break;
		size += next.value.byteLength;
		if (size > 2048) {
			await reader.cancel();
			throw new BackupError(413, 'Die Anfrage ist zu groß.');
		}
		body += decoder.decode(next.value, { stream: true });
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(body + decoder.decode());
	} catch {
		throw new BackupError(400, 'Die Anfrage enthält kein gültiges JSON.');
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new BackupError(400, 'Ungültige Backup-Anfrage.');
	}
	return Object.fromEntries(Object.entries(parsed));
}

export default async (request: Request, context: Context): Promise<Response> => {
	const url = new URL(request.url);
	const action = url.searchParams.get('action');
	const before = url.searchParams.get('before');
	const id = url.searchParams.get('id');
	const isOverview = request.method === 'GET' && action === null;
	if (request.method !== 'GET' && request.method !== 'POST') {
		return json({ error: 'Diese Methode wird nicht unterstützt.' }, 405);
	}
	if (before !== null && !isBackupId(before)) return json({ error: 'Ungültiger Seitenzeiger.' }, 400);

	const local = process.env.NETLIFY_DEV === 'true';
	const production = !local && context.deploy?.context === 'production' && context.deploy.published;
	if (!isOverview && !production) {
		return json({ error: 'Die Backup-Verwaltung ist nur auf der veröffentlichten Produktionsseite verfügbar.' }, 403);
	}
	try {
		if (local) {
			const proxied = await proxyOnlineDevRequest(request);
			if (!proxied) return json({ error: 'Die Online-Übersicht benötigt LOCAL_NETLIFY_ONLINE_DATA=true.' }, 409);
			if (!proxied.ok) return proxied;
			return json({ ...await proxied.json(), writable: false });
		}

		const user = await getUser();
		if (!user) return json({ error: 'Bitte melde dich mit einem Admin-Konto an.' }, 401);
		if (!user.roles?.includes('admin')) return json({ error: 'Für den Zugriff ist die Rolle „admin“ erforderlich.' }, 403);
		if (request.method === 'POST') {
			try {
				verifyRequestOrigin(request);
			} catch {
				return json({ error: 'Die Anfrage stammt nicht von dieser Website.' }, 403);
			}
		}

		const backups = adminBackups();
		if (isOverview) {
			const site = context.site.url ? new URL(context.site.url).host : (context.site.name ?? url.host);
			return json(await backups.overview(site, production, before));
		}
		if (request.method === 'GET') {
			if (!isBackupId(id)) throw new BackupError(400, 'Wähle ein gültiges Backup aus.');
			if (action === 'preview') return json(await backups.preview(id));
			if (action === 'download') {
				return Response.json(await backups.download(id), {
					headers: { ...noStore, 'Content-Disposition': `attachment; filename="mymusic-hub-${id}.json"` },
				});
			}
			throw new BackupError(400, 'Unbekannte Backup-Aktion.');
		}
		const payload = await readAction(request);
		if (payload.action === 'create' && typeof payload.note === 'string' && payload.note.length <= 160) {
			return json({ backup: await backups.create(payload.note.trim()) }, 201);
		}
		if (payload.action === 'restore' && isBackupId(payload.id) && payload.confirmation === 'WIEDERHERSTELLEN' &&
			typeof payload.revision === 'string' && /^[a-f0-9]{64}$/.test(payload.revision)) {
			return json({ safety: await backups.restore(payload.id, payload.revision) });
		}
		throw new BackupError(400, 'Ungültige Backup-Anfrage oder fehlende Bestätigung.');
	} catch (error) {
		if (error instanceof BackupError) return json({ error: error.message }, error.status);
		console.error('Die Backup-Anfrage ist fehlgeschlagen.', error);
		return json({ error: 'Der Online-Datenstand oder der Backup-Speicher ist momentan nicht verfügbar.' }, 503);
	}
};
