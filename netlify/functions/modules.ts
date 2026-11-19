import type { Config } from '@netlify/functions';
import { DEFAULT_QUIZ_SETTINGS, isQuizSettings, type LearningModule, type ModulesDatabase } from '../../src/lib/module-schema';
import { ModuleArchiveSyncError, syncModuleArchivesAfterSave } from '../../src/lib/module-archive';
import {
	deleteModule,
	deleteQuestion,
	moveModule,
	type UpsertModuleInput,
	type UpsertQuestionInput,
	ModuleExerciseSaveError,
	upsertModuleWithExercises,
	upsertQuestion,
	updateQuizSettings,
	validateModuleInput,
	validateQuestionInput,
} from '../../src/lib/module-store';
import {
	BlobStoreConflictError,
	isBlobStoreUnavailable,
	isReadOnlyCloudContext,
	LocalBlobSnapshotError,
	readBlobJSON,
	updateBlobJSON,
} from './lib/blob-store';

const maxRequestBytes = 500_000;

class ModuleValidationError extends Error {}
class ModuleNotFoundError extends Error {}
class ModuleConflictError extends Error {}

async function updateModules(change: (db: ModulesDatabase) => ModulesDatabase): Promise<ModulesDatabase> {
	const next = await updateBlobJSON('modules', change);
	if (process.env.NETLIFY_DEV === 'true') await syncModuleArchivesAfterSave(next);
	return next;
}

export const config: Config = {
	path: ['/api/modules', '/.netlify/functions/modules'],
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

function isQuestionPayload(body: Record<string, unknown>): boolean {
	if (body.entity === 'question') return true;
	if (body.entity === 'module') return false;
	return (
		isRecord(body.question) || 'moduleIds' in body || 'questionType' in body
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

	if (body.entity === 'quiz-settings') {
		if (request.method !== 'PUT' || !isQuizSettings(body.settings)) {
			return jsonResponse(400, { error: 'Ungültige Quiz-Einstellungen.' });
		}
		const settings = body.settings;
		const nextDb = await updateModules((db) => {
			if ((db.quizSettings ?? DEFAULT_QUIZ_SETTINGS).revision !== settings.revision) {
				throw new ModuleConflictError('Die Einstellungen wurden zwischenzeitlich geändert. Bitte lade sie neu.');
			}
			return updateQuizSettings(db, settings);
		});
		return jsonResponse(200, nextDb);
	}

	if (body.entity === 'module-order') {
		if (
			request.method !== 'PUT' ||
			typeof body.id !== 'string' || !body.id.trim() ||
			typeof body.neighborId !== 'string' || !body.neighborId.trim() ||
			(body.direction !== 'up' && body.direction !== 'down')
		) {
			return jsonResponse(400, { error: 'Ungültige Modulverschiebung.' });
		}
		const id = body.id.trim();
		const neighborId = body.neighborId.trim();
		const direction = body.direction;
		const nextDb = await updateModules((db) => {
			const reordered = moveModule(db, id, neighborId, direction);
			if (!reordered) throw new ModuleConflictError('Die Modulreihenfolge wurde geändert. Bitte lade die Übersicht neu.');
			return reordered;
		});
		return jsonResponse(200, nextDb);
	}

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
			!Array.isArray(questionPayload.moduleIds) ||
			!questionPayload.moduleIds.every(
				(id) => typeof id === 'string' && id.trim().length > 0,
			)
		) {
			return jsonResponse(400, {
				error: 'moduleIds muss ein Array aus nicht-leeren Strings sein.',
			});
		}
		const preflight = validateQuestionInput(
			questionPayload,
			(questionPayload.moduleIds as string[]).map(
				(id) => ({ id: id.trim() }) as LearningModule,
			),
		);
		if (!preflight.valid) {
			return jsonResponse(400, { error: preflight.errors.join(' ') });
		}

		const nextDb = await updateModules(
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

	const nextDb = await updateModules(
		(db) => upsertModuleWithExercises(db, rawModule as UpsertModuleInput, body.exercises, body.exerciseRoleChanges),
	);

	const savedModule = nextDb.modules.find(
		(item) => item.id === String(rawModule.id).trim(),
	);
	return jsonResponse(isPost ? 201 : 200, {
		message: isPost ? 'Modul wurde gespeichert.' : 'Modul wurde aktualisiert.',
		module: savedModule,
		...(body.exercises !== undefined || body.exerciseRoleChanges !== undefined ? { questions: nextDb.questions } : {}),
	});
}

export default async (request: Request): Promise<Response> => {
	if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	if (request.method === 'GET') {
		try {
			return jsonResponse(200, await readBlobJSON('modules'));
		} catch (error) {
			if (isBlobStoreUnavailable(error)) {
				return jsonResponse(503, { error: 'Der Modul-Builder ist noch nicht konfiguriert.' });
			}
			console.error('Die Moduldaten konnten nicht aus Netlify Blobs geladen werden.', error);
			return jsonResponse(502, {
				error: 'Die Moduldaten konnten derzeit nicht geladen werden.',
			});
		}
	}

	if (isReadOnlyCloudContext()) {
		return jsonResponse(405, {
			error: 'Dieser Deploy zeigt den aktuellen Cloud-Stand. Änderungen sind in dieser Vorschau nicht erlaubt.',
		});
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

			await updateModules(
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
		if (error instanceof LocalBlobSnapshotError) {
			console.error('Die Moduldaten wurden gespeichert, aber der lokale Blob-Snapshot konnte nicht aktualisiert werden.', error.originalError);
			return jsonResponse(500, { error: error.message });
		}
		if (error instanceof ModuleArchiveSyncError) {
			console.error('Die lokalen MDX-Kopien konnten nicht aktualisiert werden.', error);
			return jsonResponse(500, { error: error.message });
		}
		if (isBlobStoreUnavailable(error)) {
			return jsonResponse(503, { error: 'Der Modul-Builder ist noch nicht konfiguriert.' });
		}
		if (error instanceof ModuleValidationError || error instanceof ModuleExerciseSaveError) {
			return jsonResponse(400, { error: error.message });
		}
		if (error instanceof ModuleNotFoundError) {
			return jsonResponse(404, { error: error.message });
		}
		if (error instanceof ModuleConflictError) {
			return jsonResponse(409, { error: error.message });
		}
		if (error instanceof BlobStoreConflictError) {
			return jsonResponse(409, {
				error: 'Die Moduldaten wurden zwischenzeitlich geändert. Bitte lade die Seite neu.',
			});
		}
		console.error('Die Moduldaten konnten nicht aktualisiert werden.', error);
		return jsonResponse(502, {
			error: 'Die Moduldaten konnten derzeit nicht gespeichert werden.',
		});
	}
};
