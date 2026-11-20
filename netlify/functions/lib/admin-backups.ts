import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { getStore } from '@netlify/blobs';
import { parseBlobJSONValue, sharedDataStore } from './blob-store';

const keys = ['contributions', 'modules'] as const;
type DataKey = typeof keys[number];
type Payload = Record<DataKey, unknown>;
type Entry = { data: unknown; etag?: string };
const readOptions = { type: 'json', consistency: 'strong' } as const;
const pageSize = 12;

export class BackupError extends Error {
	constructor(readonly status: number, message: string) {
		super(message);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function items(values: unknown[]) {
	const byId = new Map<string, { id: string; title: string; data: unknown }>();
	for (const value of values) {
		if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
			typeof value.title !== 'string' || byId.has(value.id)) {
			throw new BackupError(409, 'Der Datenbestand enthält ungültige Einträge oder doppelte IDs.');
		}
		byId.set(value.id, { id: value.id, title: value.title, data: value });
	}
	return byId;
}

function contributionItems(value: unknown) {
	return items(parseBlobJSONValue('contributions', value));
}

function moduleItems(value: unknown) {
	parseBlobJSONValue('modules', value);
	if (!isRecord(value) || !Array.isArray(value.modules)) {
		throw new BackupError(409, 'Die Lehrgangsdaten haben ein ungültiges Format.');
	}
	return items(value.modules);
}

function summarize<T extends { id: string; title: string }>(values: Map<string, T>) {
	return Array.from(values.values(), ({ id, title }) => ({ id, title }));
}

function diff(current: ReturnType<typeof items>, next: ReturnType<typeof items>) {
	const added: string[] = [];
	const replaced: string[] = [];
	const removed: string[] = [];
	for (const [id, entry] of next) {
		const previous = current.get(id);
		if (!previous) added.push(entry.title);
		else if (!isDeepStrictEqual(previous.data, entry.data)) {
			replaced.push(previous.title === entry.title ? entry.title : `${previous.title} → ${entry.title}`);
		}
	}
	for (const [id, entry] of current) {
		if (!next.has(id)) removed.push(entry.title);
	}
	return { added, replaced, removed };
}

export type BackupSummary = {
	id: string;
	createdAt: string;
	note: string;
	kind: 'manual' | 'safety';
	contributions: number;
	modules: number;
};

type Backup = BackupSummary & { version: 1; data: Payload };

export type BackupOverview = {
	site: string;
	writable: boolean;
	checkedAt: string;
	contributions: ReturnType<typeof summarize> | null;
	modules: ReturnType<typeof summarize> | null;
	backups: BackupSummary[];
	next: string | null;
};

export type RestorePreview = {
	backup: BackupSummary;
	revision: string;
	contributions: ReturnType<typeof diff>;
	modules: ReturnType<typeof diff>;
	settingsChanged: string[];
};

export function isBackupId(id: unknown): id is string {
	return typeof id === 'string' &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[a-f0-9-]{36}$/.test(id);
}

function summary(value: unknown, id: string): BackupSummary {
	if (!isRecord(value) || value.id !== id || value.createdAt !== id.split('_')[0] ||
		typeof value.note !== 'string' || (value.kind !== 'manual' && value.kind !== 'safety') ||
		typeof value.contributions !== 'number' || typeof value.modules !== 'number') {
		throw new BackupError(409, 'Das Backup hat ungültige Metadaten.');
	}
	const { createdAt, note, kind, contributions, modules } = value;
	return { id, createdAt, note, kind, contributions, modules };
}

export function adminBackups() {
	const live = getStore(sharedDataStore);
	const archive = getStore('mymusic-hub-backups');

	async function readLive() {
		const [contributions, modules] = await Promise.all(keys.map((key) => live.getWithMetadata(key, readOptions)));
		return { contributions, modules };
	}

	function requireRevision(entry: Entry | null) {
		if (!entry?.etag) {
			throw new BackupError(409, 'Nicht alle Datenbestände sind initialisiert. Öffne zuerst Beiträge und den Modul-Builder.');
		}
		return { data: entry.data, etag: entry.etag };
	}

	async function readCurrent() {
		const current = await readLive();
		const contributions = requireRevision(current.contributions);
		const modules = requireRevision(current.modules);
		return {
			etags: { contributions: contributions.etag, modules: modules.etag },
			data: { contributions: contributions.data, modules: modules.data },
		};
	}

	async function save(data: Payload, kind: BackupSummary['kind'], note: string) {
		const createdAt = new Date().toISOString();
		const id = `${createdAt}_${randomUUID()}`;
		const metadata: BackupSummary = {
			id, createdAt, kind, note,
			contributions: contributionItems(data.contributions).size,
			modules: moduleItems(data.modules).size,
		};
		const backup: Backup = { version: 1, ...metadata, data };
		const result = await archive.setJSON(`backup/${id}`, backup, { onlyIfNew: true, metadata });
		if (!result.modified) throw new BackupError(503, 'Das Backup konnte nicht gespeichert werden.');
		return metadata;
	}

	async function load(id: string) {
		const entry = await archive.getWithMetadata(`backup/${id}`, readOptions);
		if (!entry) throw new BackupError(404, 'Das Backup wurde nicht gefunden.');
		const value: unknown = entry.data;
		if (!isRecord(value) || value.version !== 1 || !isRecord(value.data) || !entry.etag) {
			throw new BackupError(409, 'Das Backup hat ein ungültiges oder nicht unterstütztes Format.');
		}
		const backup: Backup = {
			version: 1,
			...summary(value, id),
			data: { contributions: value.data.contributions, modules: value.data.modules },
		};
		contributionItems(backup.data.contributions);
		moduleItems(backup.data.modules);
		return { backup, etag: entry.etag };
	}

	async function overview(site: string, writable: boolean, before: string | null): Promise<BackupOverview> {
		const [current, listing] = await Promise.all([readLive(), archive.list({ prefix: 'backup/' })]);
		const ids = listing.blobs.map(({ key }) => key.slice('backup/'.length))
			.filter((id) => isBackupId(id) && (!before || id < before)).sort().reverse();
		const backups = await Promise.all(ids.slice(0, pageSize).map(async (id) => {
			const entry = await archive.getMetadata(`backup/${id}`, { consistency: 'strong' });
			return summary(entry?.metadata, id);
		}));
		return {
			site, writable, checkedAt: new Date().toISOString(),
			contributions: current.contributions ? summarize(contributionItems(current.contributions.data)) : null,
			modules: current.modules ? summarize(moduleItems(current.modules.data)) : null,
			backups,
			next: ids.length > pageSize ? ids[pageSize - 1] : null,
		};
	}

	async function prepare(id: string) {
		const [{ backup, etag }, current] = await Promise.all([load(id), readCurrent()]);
		const revision = createHash('sha256')
			.update(JSON.stringify([id, etag, current.etags.contributions, current.etags.modules])).digest('hex');
		return { backup, current, revision };
	}

	async function preview(id: string): Promise<RestorePreview> {
		const { backup, current, revision } = await prepare(id);
		const before = parseBlobJSONValue('modules', current.data.modules);
		const after = parseBlobJSONValue('modules', backup.data.modules);
		const settingsChanged = [];
		if (!isDeepStrictEqual(before.questions, after.questions)) settingsChanged.push('Aufgaben und Fragen');
		if (!isDeepStrictEqual(before.quizSettings, after.quizSettings)) settingsChanged.push('Quiz-Einstellungen');
		if (!isDeepStrictEqual(before.learningConfig, after.learningConfig)) settingsChanged.push('Gemeinsamer Shop-Katalog');
		return {
			backup: summary(backup, id), revision, settingsChanged,
			contributions: diff(contributionItems(current.data.contributions), contributionItems(backup.data.contributions)),
			modules: diff(moduleItems(current.data.modules), moduleItems(backup.data.modules)),
		};
	}

	async function restore(id: string, expected: string) {
		const { backup, current, revision } = await prepare(id);
		const changed = 'Der Online-Stand hat sich geändert. Lade eine neue Vorschau.';
		if (revision !== expected) throw new BackupError(409, changed);
		const safety = await save(current.data, 'safety', `Vor Wiederherstellung von ${backup.createdAt}`);
		try {
			const first = await live.setJSON('contributions', backup.data.contributions, {
				onlyIfMatch: current.etags.contributions,
			});
			if (!first.modified) throw new BackupError(409, changed);

			const second = await live.setJSON('modules', backup.data.modules, {
				onlyIfMatch: current.etags.modules,
			});
			if (second.modified) return safety;

			// Only undo our own write; another editor may already have changed it.
			if (first.etag) {
				const undo = await live.setJSON('contributions', current.data.contributions, { onlyIfMatch: first.etag });
				if (undo.modified) throw new BackupError(409, changed);
			}
			throw new Error('Der Restore konnte nicht vollständig zurückgenommen werden.');
		} catch (error) {
			if (error instanceof BackupError) {
				throw new BackupError(error.status, `${error.message} Sicherheitsbackup: ${safety.id}`);
			}
			console.error('Der Zustand nach der Wiederherstellung ist möglicherweise unvollständig.', { safetyId: safety.id, error });
			throw new BackupError(503, `Die Wiederherstellung wurde nicht bestätigt und kann teilweise erfolgt sein. Prüfe den Online-Stand und das Sicherheitsbackup ${safety.id}, bevor du es erneut versuchst.`);
		}
	}

	return {
		overview, preview, restore,
		create: async (note: string) => save((await readCurrent()).data, 'manual', note),
		download: async (id: string) => (await load(id)).backup,
	};
}
