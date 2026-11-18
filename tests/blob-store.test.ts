import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobStoreConflictError, readBlobJSON, updateBlobJSON } from '../netlify/functions/lib/blob-store';
import { mockBlobStore } from './fixtures/blob-store';
import { createModulesTestDatabase } from './fixtures/modules';

const getStoreMock = vi.hoisted(() => vi.fn<(name: string) => ReturnType<typeof mockBlobStore>>());
const readSnapshotMock = vi.hoisted(() => vi.fn());
const writeSnapshotMock = vi.hoisted(() => vi.fn());
vi.mock('@netlify/blobs', () => ({ getStore: getStoreMock }));
vi.mock('../netlify/functions/lib/local-blob-snapshot', () => ({
	readLocalBlobSnapshot: readSnapshotMock,
	writeLocalBlobSnapshot: writeSnapshotMock,
}));

describe('Blob-Store und Initialisierung', () => {
	let store: ReturnType<typeof mockBlobStore>;
	beforeEach(() => {
		store = mockBlobStore();
		getStoreMock.mockReset().mockReturnValue(store);
		readSnapshotMock.mockReset().mockResolvedValue(undefined);
		writeSnapshotMock.mockReset().mockResolvedValue(undefined);
		vi.stubEnv('NETLIFY_DEV', '');
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('initialisiert fehlende Beiträge leer und liest danach gespeicherte Beiträge', async () => {
		expect(await readBlobJSON('contributions')).toEqual([]);
		const entries = [{ id: 'existing' }];
		store.put('contributions', entries);
		expect(await readBlobJSON('contributions')).toEqual(entries);
		expect(getStoreMock).toHaveBeenCalledWith('mymusic-hub-data');
		expect(store.setJSON).toHaveBeenCalledExactlyOnceWith('contributions', [], { onlyIfNew: true });
	});

	it('initialisiert Module leer und behält gespeicherte Quiz-Einstellungen', async () => {
		expect(await readBlobJSON('modules')).toEqual({ modules: [], questions: [] });

		const quizSettings = { quizEasyMinScore: 0.9, fastlaneMinScore: 0.95, revision: 1 };
		await updateBlobJSON('modules', (db) => ({ ...db, quizSettings }));
		expect(await readBlobJSON('modules')).toEqual({ modules: [], questions: [], quizSettings });
	});

	it('normalisiert bestehende Aufgaben beim Lesen und sichert die Werte erst beim Schreiben', async () => {
		const db = createModulesTestDatabase();
		db.questions[0].baseXp = 99;
		store.put('modules', db);
		const loaded = await readBlobJSON('modules');
		expect(loaded.questions[0]).toMatchObject({ baseXp: 10, difficulty: 'einfach' });
		expect(store.setJSON).not.toHaveBeenCalled();
		await updateBlobJSON('modules', (current) => current);
		expect(store.value('modules')).toEqual(loaded);
	});

	it('erhält vorhandene Daten, wenn ein anderer Request bei der Initialisierung schneller war', async () => {
		store.setJSON.mockImplementationOnce(async () => {
			store.put('contributions', [{ id: 'concurrent' }]);
			return { modified: false };
		});
		expect(await updateBlobJSON('contributions', (entries) => [...entries, { id: 'new' }]))
			.toEqual([{ id: 'concurrent' }, { id: 'new' }]);
	});

	it('überschreibt einen Blob mit ungültigem Beitragsformat nicht', async () => {
		store.put('contributions', { contributions: [] });
		await expect(readBlobJSON('contributions')).rejects.toThrow('JSON-Array');
		expect(store.setJSON).not.toHaveBeenCalled();
	});

	it('meldet einen anhaltenden Schreibkonflikt ohne unbedingten Write', async () => {
		store.put('contributions', [{ id: 'current' }]);
		store.setJSON.mockResolvedValue({ modified: false });
		await expect(updateBlobJSON('contributions', () => [])).rejects.toBeInstanceOf(BlobStoreConflictError);
		expect(store.setJSON).toHaveBeenCalledTimes(3);
		expect(store.value('contributions')).toEqual([{ id: 'current' }]);
	});

	it('aktualisiert den versionierten Snapshot nur bei lokalen Netlify-Dev-Schreibvorgängen', async () => {
		const next = [{ id: 'local' }];
		vi.stubEnv('NETLIFY_DEV', 'true');

		await updateBlobJSON('contributions', () => next);

		expect(writeSnapshotMock).toHaveBeenCalledExactlyOnceWith('contributions', next);
	});

	it('schreibt bei anderen Blob-Kontexten keinen lokalen Snapshot', async () => {
		await updateBlobJSON('contributions', () => [{ id: 'online' }]);

		expect(writeSnapshotMock).not.toHaveBeenCalled();
	});

	it('initialisiert einen leeren lokalen Store aus dem versionierten Snapshot', async () => {
		const snapshot = [{ id: 'versioned' }];
		readSnapshotMock.mockResolvedValue(snapshot);
		vi.stubEnv('NETLIFY_DEV', 'true');

		expect(await readBlobJSON('contributions')).toEqual(snapshot);
		expect(store.setJSON).toHaveBeenCalledExactlyOnceWith('contributions', snapshot, { onlyIfNew: true });
	});

	it('meldet einen Snapshot-Fehler, nachdem der lokale Blob gespeichert wurde', async () => {
		const snapshotError = new Error('Disk full');
		writeSnapshotMock.mockRejectedValue(snapshotError);
		vi.stubEnv('NETLIFY_DEV', 'true');

		await expect(updateBlobJSON('contributions', () => [{ id: 'saved' }]))
			.rejects.toMatchObject({ name: 'LocalBlobSnapshotError', originalError: snapshotError });
		expect(store.value('contributions')).toEqual([{ id: 'saved' }]);
	});
});
