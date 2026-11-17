import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobStoreConflictError, readBlobJSON, updateBlobJSON } from '../netlify/functions/lib/blob-store';
import { mockBlobStore } from './fixtures/blob-store';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
const getStoreMock = vi.hoisted(() => vi.fn<(name: string) => ReturnType<typeof mockBlobStore>>());
vi.mock('@netlify/blobs', () => ({ getStore: getStoreMock }));

describe('Blob-Store und Initial-Seed', () => {
	let store: ReturnType<typeof mockBlobStore>;
	beforeEach(() => {
		store = mockBlobStore();
		getStoreMock.mockReset().mockReturnValue(store);
		vi.mocked(readFile).mockReset();
	});

	it('übernimmt den Modul-Seed mit Quiz-Einstellungen nur beim ersten Zugriff', async () => {
		const seed = { modules: [], questions: [], quizSettings: { quizEasyMinScore: 0.7, fastlaneMinScore: 0.85, revision: 1 } };
		vi.mocked(readFile).mockResolvedValue(JSON.stringify(seed));
		expect(await readBlobJSON('modules')).toEqual(seed);
		expect(await readBlobJSON('modules')).toEqual(seed);
		expect(getStoreMock).toHaveBeenCalledWith('mymusic-hub-data');
		expect(readFile).toHaveBeenCalledExactlyOnceWith('data/modules.json', 'utf8');
		expect(store.setJSON).toHaveBeenCalledExactlyOnceWith('modules', seed, { onlyIfNew: true });
	});

	it('verwendet bei fehlender Seed-Datei leere Standardwerte', async () => {
		vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('Datei fehlt'), { code: 'ENOENT' }));
		expect(await readBlobJSON('contributions')).toEqual([]);
		expect(await readBlobJSON('modules')).toEqual({ modules: [], questions: [] });
	});

	it('erhält vorhandene Daten, wenn ein anderer Request beim Seed schneller war', async () => {
		vi.mocked(readFile).mockResolvedValue('[{"id":"seed"}]');
		store.setJSON.mockImplementationOnce(async () => {
			store.put('contributions', [{ id: 'concurrent' }]);
			return { modified: false };
		});
		expect(await updateBlobJSON('contributions', (entries) => [...entries, { id: 'new' }]))
			.toEqual([{ id: 'concurrent' }, { id: 'new' }]);
	});

	it('überschreibt bei ungültigem Seed keine Daten', async () => {
		vi.mocked(readFile).mockResolvedValue('{"modules":[]}');
		await expect(readBlobJSON('modules')).rejects.toThrow('ungültiges Format');
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
