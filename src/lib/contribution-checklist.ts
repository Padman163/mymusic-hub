export interface ChecklistItem {
	text: string;
	checked: boolean;
}

export const maxChecklistItems = 100;
export const maxChecklistItemLength = 200;

export function isChecklist(value: unknown): value is ChecklistItem[] {
	return (
		Array.isArray(value) &&
		value.length <= maxChecklistItems &&
		value.every(
			(item: unknown) =>
				typeof item === "object" &&
				item !== null &&
				"text" in item &&
				typeof item.text === "string" &&
				item.text.trim().length > 0 &&
				item.text.length <= maxChecklistItemLength &&
				"checked" in item &&
				typeof item.checked === "boolean",
		)
	);
}

export function checklistsEqual(
	left: unknown,
	right: ChecklistItem[] | undefined,
): boolean {
	if (left === undefined) left = [];
	if (!isChecklist(left)) return false;
	const other = right ?? [];
	return (
		left.length === other.length &&
		left.every(
			(item, index) =>
				item.text === other[index].text &&
				item.checked === other[index].checked,
		)
	);
}
