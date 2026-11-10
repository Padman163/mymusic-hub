import { afterEach, describe, expect, it } from 'vitest';
import { createChecklistEditor } from '../../src/lib/checklist-editor';
import { maxChecklistItems } from '../../src/lib/contribution-checklist';

describe('Checklisten-Editor', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('fügt einen bereinigten Punkt per Enter hinzu und liefert ihn zurück', () => {
    const editor = createChecklistEditor();
    document.body.append(editor.element);

    const next = editor.element.querySelector<HTMLInputElement>('.checklist-next');
    expect(next).not.toBeNull();
    if (!next) throw new Error('Eingabefeld für neue Punkte fehlt.');

    next.value = '  Tonart prüfen  ';
    next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(editor.items()).toEqual([{ text: 'Tonart prüfen', checked: false }]);
    expect(next.value).toBe('');
    expect(editor.element.querySelector('[aria-label="Checklistenpunkt"]')).not.toBeNull();
    expect(editor.element.querySelector<HTMLInputElement>('[type="checkbox"]')?.disabled).toBe(true);
  });

  it('entfernt Punkte und aktiviert danach die Eingabe wieder', () => {
    const editor = createChecklistEditor(
      Array.from({ length: maxChecklistItems }, (_, index) => ({
        text: `Punkt ${index + 1}`,
        checked: false,
      })),
    );
    document.body.append(editor.element);

    const next = editor.element.querySelector<HTMLInputElement>('.checklist-next');
    expect(next?.disabled).toBe(true);

    editor.element.querySelector<HTMLButtonElement>('.checklist-remove')?.click();

    expect(editor.items()).toHaveLength(maxChecklistItems - 1);
    expect(next?.disabled).toBe(false);
  });

  it('erhält vorhandene Häkchen im interaktiven Modus und leert den Editor', () => {
    const editor = createChecklistEditor([{ text: 'Abgeschlossen', checked: true }], true);
    document.body.append(editor.element);

    const checkbox = editor.element.querySelector<HTMLInputElement>('[type="checkbox"]');
    expect(checkbox?.checked).toBe(true);
    expect(checkbox?.disabled).toBe(false);

    editor.clear();

    expect(editor.items()).toEqual([]);
    expect(editor.element.querySelector('.checklist-row')).toBeNull();
  });
});
