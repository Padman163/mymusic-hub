export const contributionAreas = ["Theorie", "Praxis", "Komponente"] as const;
export type ContributionArea = (typeof contributionAreas)[number];

export function isContributionArea(value: unknown): value is ContributionArea {
  return (
    typeof value === "string" &&
    contributionAreas.some((area) => area === value)
  );
}
