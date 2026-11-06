import { defaultContributionStatus, type ContributionStatus } from '../../../src/lib/contribution-status';
import type { ContributionArea } from '../../../src/lib/contribution-area';

export interface Contribution {
	id: string;
	type: 'Bug' | 'Feature' | 'Decision';
	title: string;
	description: string;
	createdAt: string;
	status?: ContributionStatus;
	area?: ContributionArea;
}

export type ContributionFields = Pick<Contribution, 'type' | 'title' | 'description' | 'status' | 'area'>;

export class ContributionNotFoundError extends Error {}
export class ContributionConflictError extends Error {}

function githubFileConfig() {
	const token = process.env.GITHUB_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;

	if (!token || !repository) {
		throw new Error('GITHUB_TOKEN und GITHUB_REPOSITORY müssen konfiguriert sein.');
	}

	const [owner, repo, ...extra] = repository.split('/');
	if (!owner || !repo || extra.length > 0) {
		throw new Error('GITHUB_REPOSITORY muss das Format owner/repository haben.');
	}

	const branch = process.env.GITHUB_BRANCH || 'main';
	const path = process.env.GITHUB_DATA_PATH || 'data/contributions.json';
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
	const headers = {
		Accept: 'application/vnd.github+json',
		Authorization: `Bearer ${token}`,
		'X-GitHub-Api-Version': '2022-11-28',
	};

	return { url, headers, branch };
}

async function readFile(
	config: ReturnType<typeof githubFileConfig>,
	allowMissing = false,
): Promise<{ contributions: unknown[]; sha: string | undefined }> {
	const readResponse = await fetch(`${config.url}?ref=${encodeURIComponent(config.branch)}`, {
		headers: config.headers,
	});

	if (readResponse.status === 404 && allowMissing) {
		return { contributions: [], sha: undefined };
	}

	if (!readResponse.ok) {
		throw new Error(`GitHub konnte die Beitragsdatei nicht lesen (HTTP ${readResponse.status}).`);
	}

	const file: unknown = await readResponse.json();
	if (
		typeof file !== 'object' ||
		file === null ||
		!('content' in file) ||
		typeof file.content !== 'string' ||
		!('sha' in file) ||
		typeof file.sha !== 'string'
	) {
		throw new Error('Die Beitragsdatei auf GitHub hat ein ungültiges Format.');
	}

	const parsedContent: unknown = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
	if (!Array.isArray(parsedContent)) {
		throw new Error('Die Beitragsdatei auf GitHub muss ein JSON-Array enthalten.');
	}

	return { contributions: parsedContent, sha: file.sha };
}

export async function listContributions(): Promise<unknown[]> {
	const { contributions } = await readFile(githubFileConfig());
	return contributions;
}

async function changeContributions(
	message: string,
	allowMissing: boolean,
	change: (contributions: unknown[]) => void,
): Promise<void> {
	const config = githubFileConfig();

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const { contributions, sha } = await readFile(config, allowMissing);

		change(contributions);
		const writeResponse = await fetch(config.url, {
			method: 'PUT',
			headers: { ...config.headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message,
				content: Buffer.from(JSON.stringify(contributions, null, 2), 'utf8').toString('base64'),
				branch: config.branch,
				...(sha ? { sha } : {}),
			}),
		});

		if (writeResponse.ok) {
			return;
		}
		if (writeResponse.status !== 409 || attempt === 2) {
			throw new Error(`GitHub konnte den Beitrag nicht speichern (HTTP ${writeResponse.status}).`);
		}
	}

}

export async function saveContribution(contribution: Contribution): Promise<void> {
	await changeContributions('Add project contribution', true, (contributions) => {
		contributions.push(contribution);
	});
}

export async function modifyContribution(
	expected: Contribution,
	fields: ContributionFields | null,
): Promise<void> {
	await changeContributions(
		fields ? 'Update project contribution' : 'Delete project contribution',
		false,
		(contributions) => {
			const matches = contributions
				.map((item, index) => ({ item, index }))
				.filter(({ item }) => typeof item === 'object' && item !== null && 'id' in item && item.id === expected.id);

			if (matches.length === 0) throw new ContributionNotFoundError();
			if (matches.length !== 1) throw new ContributionConflictError();

			const { item, index } = matches[0];
			if (
				typeof item !== 'object' || item === null ||
				!('type' in item) || item.type !== expected.type ||
				!('title' in item) || item.title !== expected.title ||
				!('description' in item) || item.description !== expected.description ||
				!('createdAt' in item) || item.createdAt !== expected.createdAt ||
				('area' in item ? item.area : undefined) !== expected.area ||
				(('status' in item ? item.status : defaultContributionStatus) !== (expected.status ?? defaultContributionStatus))
			) {
				throw new ContributionConflictError();
			}

			if (fields) {
				contributions[index] = { ...item, ...fields };
			} else {
				contributions.splice(index, 1);
			}
		},
	);
}
