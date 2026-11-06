import type { Config } from '@netlify/functions';
import { defaultContributionStatus, isContributionStatus } from '../../src/lib/contribution-status';
import { isContributionArea } from '../../src/lib/contribution-area';
import { isChecklist } from '../../src/lib/contribution-checklist';
import { defaultContributionPriority, isContributionPriority } from '../../src/lib/contribution-priority';
import {
	ContributionConflictError,
	ContributionNotFoundError,
	listContributions,
	modifyContribution,
	saveContribution,
	type Contribution,
	type ContributionFields,
} from './lib/github-contribution-store';

const allowedTypes = ['Bug', 'Feature', 'Decision'] as const;
const maxRequestBytes = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isContributionType(value: unknown): value is Contribution['type'] {
	return typeof value === 'string' && allowedTypes.some((allowedType) => allowedType === value);
}

function contributionFields(value: unknown): ContributionFields | null {
	if (!isRecord(value)) return null;
	const { type, title, description, status, area, priority, checklist } = value;
	if (
		!isContributionType(type) ||
		typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
		(description !== undefined && (typeof description !== 'string' || description.trim().length > 10_000)) ||
		(status !== undefined && !isContributionStatus(status)) ||
		(area !== undefined && !isContributionArea(area)) ||
		(priority !== undefined && !isContributionPriority(priority)) ||
		(checklist !== undefined && !isChecklist(checklist))
	) return null;
	return { type, title: title.trim(), description: description?.trim() ?? '', ...(status === undefined ? {} : { status }), ...(area === undefined ? {} : { area }), ...(priority === undefined ? {} : { priority }), ...(checklist === undefined ? {} : { checklist: checklist.map((item) => ({ text: item.text.trim(), checked: item.checked })) }) };
}

function isContribution(value: unknown): value is Contribution {
	return isRecord(value) &&
		typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100 &&
		isContributionType(value.type) &&
		typeof value.title === 'string' && value.title.length <= 120 &&
		typeof value.description === 'string' && value.description.length <= 10_000 &&
		typeof value.createdAt === 'string' && value.createdAt.length <= 100 &&
		(value.status === undefined || isContributionStatus(value.status)) &&
		(value.area === undefined || isContributionArea(value.area)) &&
		(value.priority === undefined || isContributionPriority(value.priority)) &&
		(value.checklist === undefined || isChecklist(value.checklist));
}

export const config: Config = {
	path: '/api/contributions',
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

export default async (request: Request): Promise<Response> => {
	if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
		return jsonResponse(405, { error: 'Diese Methode wird nicht unterstützt.' });
	}

	if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
		return jsonResponse(503, { error: 'Der IssueTracker ist noch nicht konfiguriert.' });
	}

	if (request.method === 'GET') {
		try {
			return jsonResponse(200, { contributions: await listContributions() });
		} catch (error) {
			console.error('Die Beiträge konnten nicht von GitHub geladen werden.', error);
			return jsonResponse(502, { error: 'Die Beiträge konnten derzeit nicht geladen werden.' });
		}
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

	if (request.method === 'PATCH' || request.method === 'DELETE') {
		if (!isContribution(body.expected)) {
			return jsonResponse(400, { error: 'Der ursprüngliche Beitrag ist ungültig.' });
		}
		const fields = request.method === 'PATCH' ? contributionFields(body.fields) : null;
		if (request.method === 'PATCH' && !fields) {
			return jsonResponse(400, { error: 'Bitte überprüfe Typ, Bereich, Priorität, Titel, Beschreibung und Checkliste.' });
		}
		try {
			await modifyContribution(body.expected, fields);
			return jsonResponse(200, { message: fields ? 'Beitrag wurde aktualisiert.' : 'Beitrag wurde gelöscht.' });
		} catch (error) {
			if (error instanceof ContributionNotFoundError) {
				return jsonResponse(404, { error: 'Der Beitrag wurde bereits gelöscht. Bitte lade die Seite neu.' });
			}
			if (error instanceof ContributionConflictError) {
				return jsonResponse(409, { error: 'Der Beitrag wurde zwischenzeitlich geändert. Bitte lade die Seite neu.' });
			}
			console.error('Der Beitrag konnte nicht geändert werden.', error);
			return jsonResponse(502, { error: 'Der Beitrag konnte derzeit nicht geändert werden.' });
		}
	}

	const fields = contributionFields(body);
	if (!fields || !fields.area) {
		return jsonResponse(400, { error: 'Bitte überprüfe Typ, Bereich, Priorität, Titel, Beschreibung und Checkliste.' });
	}

	const contribution: Contribution = { id: crypto.randomUUID(), ...fields, priority: fields.priority ?? defaultContributionPriority, status: fields.status ?? defaultContributionStatus, createdAt: new Date().toISOString() };

	try {
		await saveContribution(contribution);
		return jsonResponse(201, { message: 'Beitrag wurde gespeichert.', contribution });
	} catch (error) {
		console.error('Der Beitrag konnte nicht auf GitHub gespeichert werden.', error);
		return jsonResponse(502, { error: 'Der Beitrag konnte derzeit nicht gespeichert werden.' });
	}
};
