import type { Config } from '@netlify/functions';
import { saveContribution, type Contribution } from './lib/github-contribution-store';

const allowedTypes = ['Bug', 'Feature', 'Decision'] as const;
const maxRequestBytes = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isContributionType(value: unknown): value is Contribution['type'] {
	return typeof value === 'string' && allowedTypes.some((allowedType) => allowedType === value);
}

export const config: Config = {
	path: '/api/contributions',
};

function jsonResponse(status: number, body: Record<string, string>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}

export default async (request: Request): Promise<Response> => {
	if (request.method !== 'POST') {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
		return jsonResponse(503, { error: 'Das Speichern ist noch nicht konfiguriert.' });
	}

	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
		return jsonResponse(413, { error: 'Der Beitrag ist zu groß.' });
	}

	let body: unknown;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return jsonResponse(400, { error: 'Die Anfrage enthält kein gültiges JSON.' });
	}

	if (!isRecord(body)) {
		return jsonResponse(400, { error: 'Die Beitragsdaten sind ungültig.' });
	}

	const { type, title, description } = body;
	if (!isContributionType(type)) {
		return jsonResponse(400, { error: 'Bitte wähle einen gültigen Typ.' });
	}
	if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
		return jsonResponse(400, { error: 'Der Titel muss zwischen 1 und 120 Zeichen lang sein.' });
	}
	if (typeof description !== 'string' || !description.trim() || description.trim().length > 10_000) {
		return jsonResponse(400, { error: 'Die Beschreibung muss zwischen 1 und 10000 Zeichen lang sein.' });
	}

	const contribution: Contribution = {
		id: crypto.randomUUID(),
		type,
		title: title.trim(),
		description: description.trim(),
		createdAt: new Date().toISOString(),
	};

	try {
		await saveContribution(contribution);
		return jsonResponse(201, { message: 'Beitrag wurde gespeichert.' });
	} catch (error) {
		console.error('Der Beitrag konnte nicht auf GitHub gespeichert werden.', error);
		return jsonResponse(502, { error: 'Der Beitrag konnte derzeit nicht gespeichert werden.' });
	}
};
