export const contributionPriorities = ["Hoch", "Mittel", "Niedrig"] as const;
export type ContributionPriority = (typeof contributionPriorities)[number];
export const defaultContributionPriority: ContributionPriority = "Mittel";

export function isContributionPriority(
  value: unknown,
): value is ContributionPriority {
  return (
    typeof value === "string" &&
    contributionPriorities.some((priority) => priority === value)
  );
}
