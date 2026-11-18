import { readFile } from 'node:fs/promises';
import { getStore } from '@netlify/blobs';
import { isQuizSettings, normalizeLegacyDatabase, type ModulesDatabase } from '../src/lib/module-schema.ts';
import { validateModuleInput, validateQuestionInput } from '../src/lib/module-store.ts';

const snapshotDirectory = new URL('../data/blob-snapshot/', import.meta.url);

async function readSnapshot(fileName: string): Promise<unknown> {
	const contents = await readFile(new URL(fileName, snapshotDirectory), 'utf8');
	return JSON.parse(contents);
}

function parseContributions(value: unknown): unknown[] {
	if (!Array.isArray(value)) {
		throw new Error('Der Beitrags-Snapshot muss ein JSON-Array enthalten.');
	}
	return value;
}

function parseModules(value: unknown): ModulesDatabase {
	if (
		typeof value !== 'object' || value === null || Array.isArray(value) ||
		!('modules' in value) || !Array.isArray(value.modules) ||
		!('questions' in value) || !Array.isArray(value.questions)
	) {
		throw new Error('Der Modul-Snapshot hat ein ungültiges Format.');
	}
	if ('quizSettings' in value && value.quizSettings !== undefined && !isQuizSettings(value.quizSettings)) {
		throw new Error('Die Quiz-Einstellungen im Modul-Snapshot sind ungültig.');
	}

	const database = normalizeLegacyDatabase(value as ModulesDatabase);
	for (const module of database.modules) {
		const validation = validateModuleInput(module);
		if (!validation.valid) throw new Error(validation.errors.join(' '));
	}
	for (const question of database.questions) {
		const validation = validateQuestionInput(question, database.modules);
		if (!validation.valid) throw new Error(validation.errors.join(' '));
	}
	return database;
}

const deployContexts = new Set(['production', 'deploy-preview', 'branch-deploy']);
if (process.env.NETLIFY !== 'true' || !deployContexts.has(process.env.CONTEXT ?? '')) {
	throw new Error('Der Blob-Snapshot darf nur in Netlify-Production-, Deploy-Preview- und Branch-Deploy-Builds synchronisiert werden.');
}

const siteID = process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID) {
	throw new Error('NETLIFY_SITE_ID (oder SITE_ID) fehlt in der Netlify-Build-Umgebung.');
}
if (!token) {
	throw new Error('NETLIFY_AUTH_TOKEN fehlt. Lege es als Netlify-Umgebungsvariable für alle Deploy-Kontexte an.');
}

const contributionSnapshot = parseContributions(await readSnapshot('contributions.json'));
const moduleSnapshot = parseModules(await readSnapshot('modules.json'));

const store = getStore('mymusic-hub-data', { siteID, token });
await store.setJSON('contributions', contributionSnapshot);
await store.setJSON('modules', moduleSnapshot);

console.log(
	`Netlify-Blob-Snapshot synchronisiert: ${contributionSnapshot.length} Beiträge, ${moduleSnapshot.modules.length} Module und ${moduleSnapshot.questions.length} Aufgaben.`,
);
