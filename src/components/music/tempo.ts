import { escapeXml } from './svg.ts';

export interface TempoChanges {
  ritAt?: number;
  aTempoAt?: number;
}

export function validateTempoChanges({ ritAt, aTempoAt }: TempoChanges, eventCount: number): void {
  for (const [tempo, index] of [['rit.', ritAt], ['a tempo', aTempoAt]] as const) {
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= eventCount)) {
      throw new Error(`Ungültige Notenposition für "${tempo}": ${index}.`);
    }
  }
  if (ritAt !== undefined && aTempoAt !== undefined && aTempoAt - ritAt < 2) {
    throw new Error('"a tempo" muss mindestens zwei Notenpositionen nach "rit." stehen.');
  }
}

export function renderTempoMark(text: string, x: string | number, y: number, offset: number, className: string): string {
  return `<text class="${className}" x="${x}" y="${y}" transform="translate(${offset} 0)" text-anchor="middle">${escapeXml(text)}</text>`;
}
