import { defaultContributionStatus, type ContributionStatus } from '../../../src/lib/contribution-status';
import type { ContributionArea } from '../../../src/lib/contribution-area';
import { checklistsEqual, type ChecklistItem } from '../../../src/lib/contribution-checklist';
import { defaultContributionPriority, type ContributionPriority } from '../../../src/lib/contribution-priority';
import { BlobStoreConflictError, readBlobJSON, updateBlobJSON } from './blob-store';

export interface Contribution {
	id: string;
	type: 'Bug' | 'Feature' | 'Decision';
	title: string;
	description: string;
	createdAt: string;
	status?: ContributionStatus;
	area?: ContributionArea;
	priority?: ContributionPriority;
	checklist?: ChecklistItem[];
}

export type ContributionFields = Pick<Contribution, 'type' | 'title' | 'description' | 'status' | 'area' | 'priority' | 'checklist'>;

export class ContributionNotFoundError extends Error {}
export class ContributionConflictError extends Error {}

export async function listContributions(): Promise<unknown[]> {
	return readBlobJSON('contributions');
}

async function changeContributions(
	change: (contributions: unknown[]) => void,
): Promise<void> {
	try {
		await updateBlobJSON('contributions', (contributions) => {
			change(contributions);
			return contributions;
		});
	} catch (error) {
		if (error instanceof BlobStoreConflictError) throw new ContributionConflictError();
		throw error;
	}
}

export async function saveContribution(contribution: Contribution): Promise<void> {
	await changeContributions((contributions) => {
		contributions.push(contribution);
	});
}

export async function modifyContribution(
	expected: Contribution,
	fields: ContributionFields | null,
): Promise<void> {
	await changeContributions(
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
				('priority' in item ? item.priority : defaultContributionPriority) !== (expected.priority ?? defaultContributionPriority) ||
				!checklistsEqual('checklist' in item ? item.checklist : undefined, expected.checklist) ||
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
