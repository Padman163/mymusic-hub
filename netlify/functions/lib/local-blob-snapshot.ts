import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SnapshotKey = 'contributions' | 'modules';

export async function readLocalBlobSnapshot(key: SnapshotKey): Promise<unknown | undefined> {
	try {
		const contents = await readFile(
			path.resolve(process.cwd(), 'data', 'blob-snapshot', `${key}.json`),
			'utf8',
		);
		return JSON.parse(contents);
	} catch (error) {
		if (
			typeof error === 'object' && error !== null &&
			'code' in error && error.code === 'ENOENT'
		) {
			return undefined;
		}
		throw error;
	}
}

export async function writeLocalBlobSnapshot(key: SnapshotKey, value: unknown): Promise<void> {
	const directory = path.resolve(process.cwd(), 'data', 'blob-snapshot');
	await mkdir(directory, { recursive: true });
	await writeFile(
		path.join(directory, `${key}.json`),
		`${JSON.stringify(value, null, 2)}\n`,
		'utf8',
	);
}
