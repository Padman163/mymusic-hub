import { getStore, type Store } from '@netlify/blobs';
import { isQuizSettings, type ModulesDatabase } from '../../../src/lib/module-schema';
import { createEmptyModulesDatabase } from '../../../src/lib/module-store';

type Data = {
	contributions: unknown[];
	modules: ModulesDatabase;
};

type Key = keyof Data;

const parse: { [K in Key]: (value: unknown) => Data[K] } = {
	contributions(value) {
		if (!Array.isArray(value)) {
			throw new Error('Die Beitragsdaten müssen ein JSON-Array enthalten.');
		}
		return value;
	},
	modules(value) {
		if (
			typeof value !== 'object' || value === null || Array.isArray(value) ||
			!('modules' in value) || !Array.isArray(value.modules) ||
			!('questions' in value) || !Array.isArray(value.questions)
		) {
			throw new Error('Die Moduldaten haben ein ungültiges Format.');
		}
		const { modules, questions } = value;
		const quizSettings = 'quizSettings' in value ? value.quizSettings : undefined;
		if (quizSettings === undefined) return { modules, questions };
		if (!isQuizSettings(quizSettings)) throw new Error('Die Moduldaten haben ein ungültiges Format.');
		return { modules, questions, quizSettings };
	},
};

const emptyData: { [K in Key]: () => Data[K] } = {
	contributions: () => [],
	modules: createEmptyModulesDatabase,
};

export class BlobStoreConflictError extends Error {}

export function isBlobStoreUnavailable(error: unknown): boolean {
	return error instanceof Error && error.name === 'MissingBlobsEnvironmentError';
}

async function initializeKey<K extends Key>(store: Store, key: K): Promise<void> {
	// Another request may have initialized (and already updated) this key.
	await store.setJSON(key, emptyData[key](), { onlyIfNew: true });
}

const jsonOptions = { type: 'json', consistency: 'strong' } as const;

export async function readBlobJSON<K extends Key>(key: K): Promise<Data[K]> {
	const store = getStore('mymusic-hub-data');
	let value: unknown = await store.get(key, jsonOptions);
	if (value === null) {
		await initializeKey(store, key);
		value = await store.get(key, jsonOptions);
	}
	return parse[key](value);
}

export async function updateBlobJSON<K extends Key>(
	key: K,
	change: (value: Data[K]) => Data[K],
): Promise<Data[K]> {
	const store = getStore('mymusic-hub-data');
	for (let attempt = 0; attempt < 3; attempt += 1) {
		let entry = await store.getWithMetadata(key, jsonOptions);
		if (entry === null) {
			await initializeKey(store, key);
			entry = await store.getWithMetadata(key, jsonOptions);
		}
		if (entry === null) continue;

		const next = change(parse[key](entry.data));
		const { modified } = await store.setJSON(key, next, { onlyIfMatch: entry.etag });
		if (modified) return next;
	}
	throw new BlobStoreConflictError();
}
