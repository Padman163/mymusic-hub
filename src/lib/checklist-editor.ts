import { maxChecklistItemLength, maxChecklistItems, type ChecklistItem } from './contribution-checklist';

export function createChecklistEditor(initial: ChecklistItem[] = [], allowChecking = false) {
	const fieldset = document.createElement('fieldset');
	fieldset.className = 'checklist-editor';
	const legend = document.createElement('legend');
	legend.textContent = 'Checkliste';
	const rows = document.createElement('div');
	rows.className = 'checklist-rows';
	const next = document.createElement('input');
	next.type = 'text';
	next.className = 'checklist-next';
	next.maxLength = maxChecklistItemLength;
	next.placeholder = 'Neuer Checklistenpunkt';
	next.setAttribute('aria-label', 'Neuer Checklistenpunkt – mit Enter hinzufügen');

	function updateLimit() {
		next.disabled = rows.childElementCount >= maxChecklistItems;
		next.placeholder = next.disabled ? `Maximal ${maxChecklistItems} Checklistenpunkte` : 'Neuer Checklistenpunkt';
	}

	function addRow(item: ChecklistItem) {
		const row = document.createElement('div');
		row.className = 'checklist-row';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = item.checked;
		checkbox.disabled = !allowChecking;
		checkbox.setAttribute('aria-label', 'Checklistenpunkt erledigt');
		if (!allowChecking) checkbox.title = 'Abhaken im Bearbeitungsmodus';
		const text = document.createElement('input');
		text.type = 'text';
		text.value = item.text;
		text.maxLength = maxChecklistItemLength;
		text.required = true;
		text.placeholder = 'Checklistenpunkt';
		text.setAttribute('aria-label', 'Checklistenpunkt');
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'checklist-remove';
		remove.textContent = '×';
		remove.title = 'Punkt entfernen';
		remove.setAttribute('aria-label', 'Checklistenpunkt entfernen');
		remove.addEventListener('click', () => {
			row.remove();
			updateLimit();
			next.focus();
		});
		row.append(checkbox, text, remove);
		rows.append(row);
		updateLimit();
	}

	next.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		const text = next.value.trim();
		if (!text) return;
		addRow({ text, checked: false });
		next.value = '';
		if (!next.disabled) next.focus();
	});
	rows.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'text' && !event.isComposing) {
			event.preventDefault();
			if (!next.disabled) next.focus();
		}
	});
	for (const item of initial) addRow(item);
	fieldset.append(legend, rows, next);
	updateLimit();

	return {
		element: fieldset,
		items(): ChecklistItem[] | null {
			const result: ChecklistItem[] = [];
			for (const row of rows.querySelectorAll<HTMLDivElement>('.checklist-row')) {
				const text = row.querySelector<HTMLInputElement>('input[type="text"]');
				if (!text) throw new Error('Das Checklistenfeld wurde nicht gefunden.');
				if (!text.value.trim()) {
					text.setCustomValidity('Bitte gib einen Checklistenpunkt ein oder entferne ihn.');
					text.reportValidity();
					text.setCustomValidity('');
					return null;
				}
				result.push({ text: text.value.trim(), checked: row.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked ?? false });
			}
			const pending = next.value.trim();
			if (pending) result.push({ text: pending, checked: false });
			return result;
		},
		clear() {
			rows.replaceChildren();
			next.value = '';
			updateLimit();
		},
	};
}
