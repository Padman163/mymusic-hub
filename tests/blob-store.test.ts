import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobStoreConflictError, readBlobJSON, updateBlobJSON } from '../netlify/functions/lib/blob-store';
import { mockBlobStore } from './fixtures/blob-store';
import { createModulesTestDatabase } from './fixtures/modules';

const getStoreMock = vi.hoisted(() => vi.fn<(name: string) => ReturnType<typeof mockBlobStore>>());
vi.mock('@netlify/blobs', () => ({ getStore: getStoreMock }));

describe('Blob-Store und Initialisierung', () => {
	let store: ReturnType<typeof mockBlobStore>;
	beforeEach(() => {
		store = mockBlobStore();
		getStoreMock.mockReset().mockReturnValue(store);
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
});
