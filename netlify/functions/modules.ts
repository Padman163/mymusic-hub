import type { Config } from '@netlify/functions';
import type { LearningModule, ModulesDatabase } from '../../src/lib/module-schema';
import {
	createEmptyModulesDatabase,
	deleteModule,
	deleteQuestion,
	type UpsertModuleInput,
	type UpsertQuestionInput,
	upsertModule,
	upsertQuestion,
	validateModuleInput,
	validateQuestionInput,
} from '../../src/lib/module-store';

const maxRequestBytes = 500_000;
const maxConflictRetries = 3;

class ModuleValidationError extends Error {}
class ModuleNotFoundError extends Error {}
class ModuleConflictError extends Error {}

export const config: Config = {
	path: '/api/modules',
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
}

function githubModulesFileConfig() {
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
	const path = process.env.GITHUB_MODULES_PATH || 'data/modules.json';
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
	const headers = {
		Accept: 'application/vnd.github+json',
		Authorization: `Bearer ${token}`,
		'X-GitHub-Api-Version': '2022-11-28',
	};

	return { url, headers, branch };
}

function parseModulesDatabase(value: unknown): ModulesDatabase {
	if (
		!isRecord(value) ||
		!Array.isArray(value.modules) ||
		!Array.isArray(value.questions)
	) {
		throw new Error('Die Moduldatei auf GitHub hat ein ungültiges Format.');
	}
	return {
		modules: value.modules as ModulesDatabase['modules'],
		questions: value.questions as ModulesDatabase['questions'],
	};
}

async function readModulesFile(
	fileConfig: ReturnType<typeof githubModulesFileConfig>,
	allowMissing = false,
): Promise<{ database: ModulesDatabase; sha: string | undefined }> {
	const readResponse = await fetch(
		`${fileConfig.url}?ref=${encodeURIComponent(fileConfig.branch)}`,
		{ headers: fileConfig.headers },
	);

	if (readResponse.status === 404) {
		if (allowMissing) {
			return { database: createEmptyModulesDatabase(), sha: undefined };
		}
		throw new ModuleNotFoundError('Die Moduldatei wurde nicht gefunden.');
	}

	if (!readResponse.ok) {
		throw new Error(
			`GitHub konnte die Moduldatei nicht lesen (HTTP ${readResponse.status}).`,
		);
	}

	const file: unknown = await readResponse.json();
	if (
		!isRecord(file) ||
		typeof file.content !== 'string' ||
		typeof file.sha !== 'string'
	) {
		throw new Error('Die Moduldatei auf GitHub hat ein ungültiges Format.');
	}

	const parsedContent: unknown = JSON.parse(
		Buffer.from(file.content, 'base64').toString('utf8'),
	);

	return {
		database: parseModulesDatabase(parsedContent),
		sha: file.sha,
	};
}

async function changeModulesDatabase(
	message: string,
	allowMissing: boolean,
	change: (db: ModulesDatabase) => ModulesDatabase,
): Promise<ModulesDatabase> {
	const fileConfig = githubModulesFileConfig();

	for (let attempt = 0; attempt < maxConflictRetries; attempt += 1) {
		const { database, sha } = await readModulesFile(fileConfig, allowMissing);
		const nextDatabase = change(database);

		const writeResponse = await fetch(fileConfig.url, {
			method: 'PUT',
			headers: { ...fileConfig.headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message,
				content: Buffer.from(
					JSON.stringify(nextDatabase, null, 2),
					'utf8',
				).toString('base64'),
				branch: fileConfig.branch,
				...(sha ? { sha } : {}),
			}),
		});

		if (writeResponse.ok) {
			return nextDatabase;
		}
		if (writeResponse.status !== 409) {
			throw new Error(
				`GitHub konnte die Moduldaten nicht speichern (HTTP ${writeResponse.status}).`,
			);
		}
		if (attempt === maxConflictRetries - 1) {
			throw new ModuleConflictError(
				'Die Moduldaten wurden zwischenzeitlich geändert. Bitte lade die Seite neu.',
			);
		}
	}

	throw new ModuleConflictError(
		'Die Moduldaten wurden zwischenzeitlich geändert. Bitte lade die Seite neu.',
	);
}

function isQuestionPayload(body: Record<string, unknown>): boolean {
	if (body.entity === 'question') return true;
	if (body.entity === 'module') return false;
	return (
		isRecord(body.question) || 'moduleId' in body || 'questionType' in body
	);
}

function extractDeleteTarget(
	request: Request,
	body: Record<string, unknown> | null,
): { entity: 'module' | 'question'; id: string } | null {
	const url = new URL(request.url);
	const entityParam = body?.entity ?? url.searchParams.get('entity');
	const questionId =
		typeof body?.questionId === 'string'
			? body.questionId
			: url.searchParams.get('questionId');
	const moduleId =
		typeof body?.moduleId === 'string'
			? body.moduleId
			: url.searchParams.get('moduleId');
	const genericId =
		typeof body?.id === 'string' ? body.id : url.searchParams.get('id');

	if (entityParam !== undefined && entityParam !== null && entityParam !== 'module' && entityParam !== 'question') {
		return null;
	}

	if (entityParam === 'question' || (entityParam !== 'module' && questionId)) {
		const id = (questionId || genericId || '').trim();
		return id ? { entity: 'question', id } : null;
	}

	const id = (moduleId || genericId || '').trim();
	return id ? { entity: 'module', id } : null;
}

async function handleWriteRequest(
	request: Request,
	body: Record<string, unknown>,
): Promise<Response> {
	const isPost = request.method === 'POST';

	if (
		body.entity !== undefined &&
		body.entity !== 'module' &&
		body.entity !== 'question'
	) {
		return jsonResponse(400, { error: 'Ungültiger Entity-Typ.' });
	}

	if (isQuestionPayload(body)) {
		const rawQuestion = isRecord(body.question) ? body.question : body;
		if (
			rawQuestion.id !== undefined &&
			(typeof rawQuestion.id !== 'string' || !rawQuestion.id.trim())
		) {
			return jsonResponse(400, { error: 'Aufgaben-ID darf nicht leer sein.' });
		}

		const questionPayload: Record<string, unknown> =
			isPost && rawQuestion.id === undefined
				? { ...rawQuestion, id: crypto.randomUUID() }
				: rawQuestion;

		if (
			typeof questionPayload.id !== 'string' ||
			!questionPayload.id.trim()
		) {
			return jsonResponse(400, { error: 'Aufgaben-ID ist erforderlich.' });
		}

		if (
			typeof questionPayload.moduleId === 'string' &&
			questionPayload.moduleId.trim().length > 0
		) {
			const preflight = validateQuestionInput(questionPayload, [
				{ id: questionPayload.moduleId.trim() } as LearningModule,
			]);
			if (!preflight.valid) {
				return jsonResponse(400, { error: preflight.errors.join(' ') });
			}
		} else {
			return jsonResponse(400, { error: 'moduleId ist erforderlich.' });
		}

		const nextDb = await changeModulesDatabase(
			isPost ? 'Add learning question' : 'Update learning question',
			true,
			(db) => {
				const validation = validateQuestionInput(questionPayload, db.modules);
				if (!validation.valid) {
					throw new ModuleValidationError(validation.errors.join(' '));
				}
				return upsertQuestion(db, questionPayload as UpsertQuestionInput);
			},
		);

		const savedQuestion = nextDb.questions.find(
			(item) => item.id === String(questionPayload.id).trim(),
		);
		return jsonResponse(isPost ? 201 : 200, {
			message: isPost ? 'Aufgabe wurde gespeichert.' : 'Aufgabe wurde aktualisiert.',
			question: savedQuestion,
		});
	}

	const rawModule = isRecord(body.module) ? body.module : body;
	const validation = validateModuleInput(rawModule);
	if (!validation.valid) {
		return jsonResponse(400, { error: validation.errors.join(' ') });
	}

	const nextDb = await changeModulesDatabase(
		isPost ? 'Add learning module' : 'Update learning module',
		true,
		(db) => upsertModule(db, rawModule as UpsertModuleInput),
	);

	const savedModule = nextDb.modules.find(
		(item) => item.id === String(rawModule.id).trim(),
	);
	return jsonResponse(isPost ? 201 : 200, {
		message: isPost ? 'Modul wurde gespeichert.' : 'Modul wurde aktualisiert.',
		module: savedModule,
	});
}

export default async (request: Request): Promise<Response> => {
	if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
		return jsonResponse(503, { error: 'Der Modul-Builder ist noch nicht konfiguriert.' });
	}

	if (request.method === 'GET') {
		try {
			const { database } = await readModulesFile(githubModulesFileConfig(), true);
			return jsonResponse(200, database);
		} catch (error) {
			console.error('Die Moduldaten konnten nicht von GitHub geladen werden.', error);
			return jsonResponse(502, {
				error: 'Die Moduldaten konnten derzeit nicht geladen werden.',
			});
		}
	}

	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
		return jsonResponse(413, { error: 'Die Anfrage ist zu groß.' });
	}

	let parsedBody: Record<string, unknown> | null = null;
	if (bodyText.trim().length > 0) {
		let raw: unknown;
		try {
			raw = JSON.parse(bodyText);
		} catch {
			return jsonResponse(400, { error: 'Die Anfrage enthält kein gültiges JSON.' });
		}
		if (!isRecord(raw)) {
			return jsonResponse(400, { error: 'Die Moduldaten sind ungültig.' });
		}
		parsedBody = raw;
	} else if (request.method !== 'DELETE') {
		return jsonResponse(400, { error: 'Die Anfrage enthält kein gültiges JSON.' });
	}

	try {
		if (request.method === 'DELETE') {
			const target = extractDeleteTarget(request, parsedBody);
			if (!target) {
				return jsonResponse(400, { error: 'Ungültige Lösch-Anfrage: ID fehlt.' });
			}

			await changeModulesDatabase(
				target.entity === 'question'
					? 'Delete learning question'
					: 'Delete learning module',
				false,
				(db) => {
					if (target.entity === 'question') {
						if (!db.questions.some((q) => q.id === target.id)) {
							throw new ModuleNotFoundError('Die Aufgabe wurde nicht gefunden.');
						}
						return deleteQuestion(db, target.id);
					}
					if (!db.modules.some((m) => m.id === target.id)) {
						throw new ModuleNotFoundError('Das Modul wurde nicht gefunden.');
					}
					return deleteModule(db, target.id);
				},
			);

			return jsonResponse(200, {
				message:
					target.entity === 'question'
						? 'Aufgabe wurde gelöscht.'
						: 'Modul und zugehörige Aufgaben wurden gelöscht.',
			});
		}

		return await handleWriteRequest(request, parsedBody ?? {});
	} catch (error) {
		if (error instanceof ModuleValidationError) {
			return jsonResponse(400, { error: error.message });
		}
		if (error instanceof ModuleNotFoundError) {
			return jsonResponse(404, { error: error.message });
		}
		if (error instanceof ModuleConflictError) {
			return jsonResponse(409, { error: error.message });
		}
		console.error('Die Moduldaten konnten nicht aktualisiert werden.', error);
		return jsonResponse(502, {
			error: 'Die Moduldaten konnten derzeit nicht gespeichert werden.',
		});
	}
};
