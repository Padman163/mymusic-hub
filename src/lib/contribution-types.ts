export const contributionTypes = ['Bug', 'Feature', 'Decision'] as const;
export type ContributionType = (typeof contributionTypes)[number];

export function isContributionType(value: unknown): value is ContributionType {
	return typeof value === 'string' && contributionTypes.some((type) => type === value);
}

const typeIcons: Record<ContributionType, string[]> = {
	Bug: ['M8 7l-2-2', 'M16 7l2-2', 'M12 9v12', 'M4 13h3', 'M17 13h3', 'M5 18l3-1', 'M19 18l-3-1', 'M9 8a3 3 0 0 1 6 0', 'M7 12a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0Z'],
	Feature: ['M12 3v18', 'M3 12h18', 'M6 6l12 12', 'M18 6L6 18'],
	Decision: ['M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Z'],
};

export function addIcon(container: HTMLElement, paths: string[]) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	svg.setAttribute('aria-hidden', 'true');
	for (const d of paths) {
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', d);
		svg.append(path);
	}
	container.append(svg);
}

export function createTypeTag(type: ContributionType) {
	const tag = document.createElement('span');
	tag.className = 'contribution-tag';
	tag.dataset.tag = type;
	addIcon(tag, typeIcons[type]);
	tag.append(document.createTextNode(type));
	return tag;
}

export function createTagPicker<T extends string>(
	name: string,
	title: string,
	values: readonly T[],
	selected: T | undefined,
	createTag: (value: T) => HTMLElement,
) {
	const fieldset = document.createElement('fieldset');
	fieldset.className = 'contribution-type-picker';
	const legend = document.createElement('legend');
	legend.textContent = title;
	const choices = document.createElement('div');
	choices.className = 'contribution-type-choices';
	for (const value of values) {
		const label = document.createElement('label');
		const radio = document.createElement('input');
		radio.type = 'radio';
		radio.name = name;
		radio.value = value;
		radio.defaultChecked = value === selected;
		radio.required = true;
		label.append(radio, createTag(value));
		choices.append(label);
	}
	fieldset.append(legend, choices);
	return fieldset;
}

export function createTypePicker(selected: ContributionType) {
	return createTagPicker('type', 'Typ', contributionTypes, selected, createTypeTag);
}

export function createPlainTag(value: string, category: 'area' | 'priority') {
	const tag = document.createElement('span');
	tag.className = 'contribution-tag';
	tag.dataset[category] = value;
	tag.textContent = value;
	return tag;
}
