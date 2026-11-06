export interface Contribution {
	id: string;
	type: 'Bug' | 'Feature' | 'Decision';
	title: string;
	description: string;
	createdAt: string;
}

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

export async function saveContribution(contribution: Contribution): Promise<void> {
	const config = githubFileConfig();

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const { contributions, sha } = await readFile(config, true);

		contributions.push(contribution);
		const writeResponse = await fetch(config.url, {
			method: 'PUT',
			headers: { ...config.headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: 'Add project contribution',
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
