// @vitest-environment node
import type { Context } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handle from '../netlify/functions/admin-backups';
import { mockBlobStore } from './fixtures/blob-store';

const mocks = vi.hoisted(() => ({ getStore: vi.fn(), getUser: vi.fn(), verifyRequestOrigin: vi.fn() }));
vi.mock('@netlify/blobs', () => ({ getStore: mocks.getStore }));
vi.mock('@netlify/identity', () => ({
	getUser: mocks.getUser,
	verifyRequestOrigin: mocks.verifyRequestOrigin,
}));

const production = {
	deploy: { id: 'published', context: 'production', published: true },
	site: { url: 'https://live.example' },
} as Context;
const endpoint = 'https://live.example/api/admin/backups';
const old = [{ id: 'old', title: 'Älterer Beitrag' }, { id: 'edit', title: 'Alter Titel' }];
const current = [{ id: 'new', title: 'Neuer Beitrag' }, { id: 'edit', title: 'Neuer Titel' }];
const modules = { modules: [], questions: [] };
const changedModules = { modules: [{ id: 'learn', title: 'Lehrgang' }], questions: [] };

function mockArchiveStore() {
	const store = mockBlobStore();
	const metadata = new Map<string, Record<string, unknown>>();
	const write = store.setJSON.getMockImplementation();
	return {
		...store,
		list: vi.fn(async () => ({ blobs: [...metadata.keys()].map((key) => ({ key })) })),
		getMetadata: vi.fn(async (key: string) => ({ metadata: metadata.get(key) })),
		setJSON: vi.fn(async (key: string, value: unknown, options: { onlyIfNew: boolean; metadata: Record<string, unknown> }) => {
			const result = await write?.(key, value, options);
			if (result?.modified) metadata.set(key, options.metadata);
			return result;
		}),
	};
}

function request(action?: Record<string, unknown>, context = production) {
	const options = action ? {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: 'https://live.example' },
		body: JSON.stringify(action),
	} : undefined;
	return handle(new Request(endpoint, options), context);
}

async function create() {
	const result = await request({ action: 'create', note: 'Vor Umbau' });
	expect(result.status).toBe(201);
	return (await result.json()).backup.id as string;
}

function preview(id: string) {
	return handle(new Request(`${endpoint}?action=preview&id=${id}`), production);
}

function restore(id: string, revision: string) {
	return request({ action: 'restore', id, revision, confirmation: 'WIEDERHERSTELLEN' });
}

describe('Admin-Backups', () => {
	let live: ReturnType<typeof mockBlobStore>;
	let archive: ReturnType<typeof mockArchiveStore>;

	beforeEach(() => {
		vi.stubEnv('NETLIFY_DEV', '');
		live = mockBlobStore();
		archive = mockArchiveStore();
		live.put('contributions', old);
		live.put('modules', modules);
		mocks.getStore.mockReset().mockImplementation((name: string) =>
			name === 'mymusic-hub-data' ? live : archive);
		mocks.getUser.mockReset().mockResolvedValue({ roles: ['admin'] });
		mocks.verifyRequestOrigin.mockReset();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it.each([
		{ context: 'branch-deploy', published: true },
		{ context: 'production', published: false },
	])('sperrt Backup-Aktionen bei $context (published: $published)', async (deploy) => {
		const context = { ...production, deploy: { ...production.deploy, ...deploy } };
		const result = await request(undefined, context);
		expect(result.headers.get('Cache-Control')).toBe('no-store');
		expect(await result.json()).toMatchObject({ site: 'live.example', writable: false, contributions: old });
		expect((await request({ action: 'create', note: '' }, context)).status).toBe(403);
		expect(live.setJSON).not.toHaveBeenCalled();
		expect(archive.setJSON).not.toHaveBeenCalled();
	});

	it('erstellt und restauriert im unveröffentlichten Deploy Preview für Admins im selben Origin', async () => {
		const context = {
			...production,
			deploy: { ...production.deploy, context: 'deploy-preview', published: false },
		};
		const origin = 'https://deploy-preview-42--live.example';
		const send = (query = '', body?: Record<string, unknown>, requestOrigin = origin) =>
			handle(new Request(`${origin}/api/admin/backups${query}`, body && {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
				body: JSON.stringify(body),
			}), context);
		mocks.verifyRequestOrigin.mockImplementation((req: Request) => {
			if (req.headers.get('Origin') !== new URL(req.url).origin) throw new Error('falscher Origin');
		});
		expect(await (await send()).json()).toMatchObject({ site: 'live.example', writable: true });

		const created = await send('', { action: 'create', note: 'Aus dem Preview' });
		expect(created.status).toBe(201);
		const { backup } = await created.json();
		expect(await (await request()).json()).toMatchObject({ backups: [backup] });
		expect((await send(`?action=download&id=${backup.id}`)).headers.get('Content-Disposition')).toContain('attachment;');
		live.put('contributions', current);
		const planned = await send(`?action=preview&id=${backup.id}`);
		expect(planned.status).toBe(200);
		const { revision } = await planned.json();
		const body = { action: 'restore', id: backup.id, revision, confirmation: 'WIEDERHERSTELLEN' };
		mocks.getUser.mockResolvedValueOnce({ roles: [] });
		expect((await send('', body)).status).toBe(403);
		expect((await send('', body, 'https://live.example')).status).toBe(403);
		expect(live.setJSON).not.toHaveBeenCalled();
		const restored = await send('', body);
		expect(restored.status).toBe(200);
		expect((await restored.json()).safety.kind).toBe('safety');
		expect(live.value('contributions')).toEqual(old);
	});

	it('erzwingt Admin-Rolle und Origin; lokal wird nur die Übersicht weitergeleitet', async () => {
		mocks.getUser.mockResolvedValueOnce({ roles: [] });
		expect((await request()).status).toBe(403);
		mocks.verifyRequestOrigin.mockImplementationOnce(() => { throw new Error('falscher Origin'); });
		expect((await request({ action: 'create', note: '' })).status).toBe(403);
		vi.stubEnv('NETLIFY_DEV', 'true');
		vi.stubEnv('LOCAL_NETLIFY_ONLINE_DATA', 'true');
		vi.stubEnv('LOCAL_NETLIFY_IDENTITY_ORIGIN', 'https://live.example');
		const fetch = vi.fn().mockResolvedValue(Response.json({ site: 'live.example', writable: true }));
		vi.stubGlobal('fetch', fetch);
		expect((await request({ action: 'create', note: '' })).status).toBe(403);
		expect(await (await request()).json()).toMatchObject({ site: 'live.example', writable: false });
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(mocks.getStore).not.toHaveBeenCalled();
	});

	it('lädt ein unverändertes Backup herunter und stellt beide Keys nach Vorschau und Sicherung wieder her', async () => {
		const id = await create();
		const download = await handle(new Request(`${endpoint}?action=download&id=${id}`), production);
		expect(download.headers.get('Content-Disposition')).toContain('attachment;');
		expect((await download.json()).data).toEqual({ contributions: old, modules });
		live.put('contributions', current);
		live.put('modules', changedModules);
		const planned = await (await preview(id)).json();
		expect(planned.contributions).toEqual({
			added: ['Älterer Beitrag'], replaced: ['Neuer Titel → Alter Titel'], removed: ['Neuer Beitrag'],
		});
		const result = await restore(id, planned.revision);
		expect(result.status).toBe(200);
		const { safety } = await result.json();
		expect(archive.value(`backup/${safety.id}`)).toMatchObject({
			kind: 'safety', data: { contributions: current, modules: changedModules },
		});
		expect(await (await request()).json()).toMatchObject({
			backups: expect.arrayContaining([expect.objectContaining({ id, note: 'Vor Umbau' }), safety]),
		});
		expect(live.value('contributions')).toEqual(old);
		expect(live.value('modules')).toEqual(modules);
	});

	it('bricht bei veralteter Vorschau oder fehlgeschlagenem Sicherheitsbackup vor dem ersten Live-Write ab', async () => {
		const id = await create();
		const { revision } = await (await preview(id)).json();
		expect((await request({ action: 'restore', id, revision })).status).toBe(400);
		live.put('contributions', current);
		expect((await restore(id, revision)).status).toBe(409);
		expect(archive.setJSON).toHaveBeenCalledTimes(1);
		const fresh = await (await preview(id)).json();
		archive.setJSON.mockResolvedValueOnce({ modified: false });
		expect((await restore(id, fresh.revision)).status).toBe(503);
		expect(live.setJSON).not.toHaveBeenCalled();
	});

	it('nimmt beim Konflikt am zweiten Key nur den eigenen ersten Restore-Schreibzugriff zurück', async () => {
		const id = await create();
		live.put('contributions', current);
		const { revision } = await (await preview(id)).json();
		const write = live.setJSON.getMockImplementation();
		live.setJSON.mockImplementation(async (key, value, options) => {
			if (key === 'modules') live.put(key, changedModules);
			if (!write) throw new Error('Test-Store fehlt');
			return write(key, value, options);
		});
		const result = await restore(id, revision);
		expect(result.status).toBe(409);
		expect((await result.json()).error).toContain('Sicherheitsbackup:');
		expect(live.value('contributions')).toEqual(current);
		expect(live.value('modules')).toEqual(changedModules);
	});
});
