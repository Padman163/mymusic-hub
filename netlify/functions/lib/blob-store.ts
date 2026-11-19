import { getStore, type Store } from '@netlify/blobs';
import {
	isLearningConfiguration,
	isQuizSettings,
	normalizeLegacyDatabase,
	type ModulesDatabase,
} from '../../../src/lib/module-schema';
import { createEmptyModulesDatabase } from '../../../src/lib/module-store';
import { readLocalBlobSnapshot, writeLocalBlobSnapshot } from './local-blob-snapshot';

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
		const learningConfig = 'learningConfig' in value ? value.learningConfig : undefined;
		if (quizSettings !== undefined && !isQuizSettings(quizSettings)) {
			throw new Error('Die Moduldaten haben ein ungültiges Format.');
		}
		if (learningConfig !== undefined && !isLearningConfiguration(learningConfig)) {
			throw new Error('Die Moduldaten haben ein ungültiges Format.');
		}
		return normalizeLegacyDatabase({
			modules,
			questions,
			...(quizSettings !== undefined ? { quizSettings } : {}),
			...(learningConfig !== undefined ? { learningConfig } : {}),
		});
	},
};

const emptyData: { [K in Key]: () => Data[K] } = {
	contributions: () => [],
	modules: createEmptyModulesDatabase,
};

export class BlobStoreConflictError extends Error {}
export class LocalBlobSnapshotError extends Error {
	constructor(readonly originalError: unknown) {
		super('Die lokalen Daten wurden gespeichert, aber der versionierte Blob-Snapshot konnte nicht aktualisiert werden.');
		this.name = 'LocalBlobSnapshotError';
	}
}

export function isBlobStoreUnavailable(error: unknown): boolean {
	return error instanceof Error && error.name === 'MissingBlobsEnvironmentError';
}

export function isReadOnlyCloudContext(): boolean {
	const context = process.env.CONTEXT;
	return (
		process.env.NETLIFY_DEV !== 'true' &&
		(context === 'production' ||
			context === 'deploy-preview' ||
			context === 'branch-deploy')
	);
}

async function initializeKey<K extends Key>(store: Store, key: K): Promise<void> {
	// Another request may have initialized (and already updated) this key.
	const snapshotValue = process.env.NETLIFY_DEV === 'true'
		? await readLocalBlobSnapshot(key)
		: undefined;
	const initialValue = snapshotValue === undefined
		? emptyData[key]()
		: parseBlobJSONValue(key, snapshotValue);
	await store.setJSON(key, initialValue, { onlyIfNew: true });
}

const jsonOptions = { type: 'json', consistency: 'strong' } as const;

function parseBlobJSONValue<K extends Key>(key: K, value: unknown): Data[K] {
	return parse[key](value);
}

export async function readBlobJSON<K extends Key>(key: K): Promise<Data[K]> {
	const store = getStore('mymusic-hub-data');
	let value: unknown = await store.get(key, jsonOptions);
	if (value === null) {
		await initializeKey(store, key);
		value = await store.get(key, jsonOptions);
	}
	return parseBlobJSONValue(key, value);
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

		const next = change(parseBlobJSONValue(key, entry.data));
		const { modified } = await store.setJSON(key, next, { onlyIfMatch: entry.etag });
		if (modified) {
			if (process.env.NETLIFY_DEV === 'true') {
				try {
					await writeLocalBlobSnapshot(key, next);
				} catch (error) {
					throw new LocalBlobSnapshotError(error);
				}
			}
			return next;
		}
	}
	throw new BlobStoreConflictError();
}
