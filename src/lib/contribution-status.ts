export const contributionStatuses = ['New', 'Active', 'Resolved'] as const;
export type ContributionStatus = (typeof contributionStatuses)[number];
export const defaultContributionStatus: ContributionStatus = 'New';

export function isContributionStatus(value: unknown): value is ContributionStatus {
	return contributionStatuses.some((status) => status === value);
}
