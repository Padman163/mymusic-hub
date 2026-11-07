import { assertNoClefChanges, minimumFirstNoteX, type NotationClef, type NotationRenderOptions } from '../../lib/notation-renderer.ts';

export function arrangeNotationSystems<T extends { clef?: NotationClef | false }>(
  measures: readonly T[],
  measuresPerSystem: number
): (Omit<T, 'clef'> & { clef: NotationClef | false; firstNoteX: number })[][] {
  if (!Number.isSafeInteger(measuresPerSystem) || measuresPerSystem < 1) {
    throw new Error('Ein Notensystem muss mindestens einen Takt enthalten.');
  }

  if (measures.length === 0) return [];
  assertNoClefChanges(measures.map(({ clef }) => clef), 'Notensystem');
  const clef = measures[0].clef;
  if (!clef) throw new Error('Für den Zeilenumbruch wird ein Anfangsschlüssel benötigt.');

  const systems: (Omit<T, 'clef'> & { clef: NotationClef | false })[][] = [];
  for (let index = 0; index < measures.length; index += measuresPerSystem) {
    systems.push(measures.slice(index, index + measuresPerSystem).map((measure, offset) => ({
      ...measure,
      clef: offset === 0 ? clef : false
    })));
  }
  return alignFirstNotesInSystems(systems);
}

export function alignFirstNotesInSystems<T extends Omit<NotationRenderOptions, 'clef'> & { clef: NotationClef | false }>(
  systems: readonly (readonly T[])[]
): (T & { firstNoteX: number })[][] {
  const columns: number[] = [];
  for (const system of systems) {
    system.forEach((measure, index) => {
      const minimum = minimumFirstNoteX({ ...measure, clef: measure.clef || undefined });
      columns[index] = Math.max(columns[index] ?? 0, minimum);
    });
  }
  return systems.map((system) => system.map((measure, index) => ({
    ...measure,
    firstNoteX: columns[index]
  })));
}
