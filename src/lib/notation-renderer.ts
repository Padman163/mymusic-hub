import { articulationPlacement, articulationSymbols, articulationY, renderArticulation, type Articulation } from '../components/music/articulation.ts';
import { renderBarLine, renderRepeatEndAtBoundary, renderRepeatStart } from '../components/music/barline.ts';
import { renderCurve, validateCurves, type MusicCurve } from '../components/music/curve.ts';
import { collectBeamGroups, durationLabels, flagGlyph, renderBeam, renderDot, renderStem, type Duration } from '../components/music/rhythm.ts';
import { escapeXml, glyphText } from '../components/music/svg.ts';
import { renderTempoMark, validateTempoChanges } from '../components/music/tempo.ts';
import { renderTimeSignature, timeSignatureWidth, validateTimeSignature, type TimeSignature } from '../components/music/time-signature.ts';

export type NotationDuration = Duration;
export type NotationArticulation = Articulation;
export type NotationClef = 'treble' | 'bass';
export type NotationAccidental = { type: 'sharp' | 'natural' | 'flat'; step: number };
export type NotationNote =
  | {
      type: 'filled' | 'empty';
      step: number;
      stem?: boolean;
      articulation?: NotationArticulation;
      articulationPosition?: 'above' | 'below';
      accidental?: 'sharp' | 'natural' | 'flat';
      duration?: never;
      beamGroup?: never;
      dotted?: never;
    }
  | {
      duration: NotationDuration;
      step: number;
      beamGroup?: string;
      articulation?: NotationArticulation;
      articulationPosition?: 'above' | 'below';
      accidental?: 'sharp' | 'natural' | 'flat';
      dotted?: boolean;
      type?: never;
      stem?: never;
    };

export type NotationCurve = MusicCurve;

export interface NotationRenderOptions {
  clef?: NotationClef;
  notes?: NotationNote[];
  accidentals?: NotationAccidental[];
  timeSignature?: TimeSignature;
  noteStart?: number;
  firstNoteX?: number;
  showLeftBar?: boolean;
  showRightBar?: boolean;
  rightBarStyle?: 'single' | 'final';
  repeatStart?: boolean;
  repeatEnd?: boolean;
  curves?: NotationCurve[];
  ritAt?: number;
  aTempoAt?: number;
  label?: string;
}

export function assertNoClefChanges(clefs: readonly (NotationClef | false | undefined)[], pieceName: string): void {
  let activeClef: NotationClef | undefined;
  for (const clef of clefs) {
    if (!clef) continue;
    if (activeClef && clef !== activeClef) {
      throw new Error(`Ein Notenschlüsselwechsel von ${activeClef} zu ${clef} ist im Notationsstück "${pieceName}" nicht erlaubt.`);
    }
    activeClef = clef;
  }
}

const accidentalSymbols = {
  sharp: { glyph: '\uE262', label: 'Kreuz' },
  natural: { glyph: '\uE261', label: 'Auflösungszeichen' },
  flat: { glyph: '\uE260', label: 'b-Vorzeichen' }
} as const;

const noteHeadHalfWidth = 6.5;
const accidentalNoteGap = 4;

export function minimumFirstNoteX(options: Pick<NotationRenderOptions, 'clef' | 'timeSignature' | 'accidentals' | 'repeatStart' | 'notes' | 'noteStart'>): number {
  const { clef, timeSignature, accidentals = [], repeatStart = false, notes = [], noteStart = 0 } = options;
  if (timeSignature) validateTimeSignature(timeSignature);
  const prefixStart = (clef ? 36 : 6) + (repeatStart ? 24 : 0);
  const accidentalStart = timeSignature ? prefixStart + timeSignatureWidth(timeSignature) + 10 : prefixStart;
  const prefixEnd = Math.max(
    clef ? 36 : 0,
    repeatStart ? (clef ? 36 : 0) + 12 : 0,
    timeSignature ? accidentalStart : 0,
    accidentals.length ? accidentalStart + accidentals.length * 12 : 0,
    noteStart
  );
  return prefixEnd + 10 + (notes[0]?.accidental ? 16 : 0);
}

export function renderNotationSvg(options: NotationRenderOptions): string {
  const {
    clef,
    notes = [],
    accidentals = [],
    timeSignature,
    noteStart = 0,
    firstNoteX,
    showLeftBar = false,
    showRightBar = true,
    rightBarStyle = 'single',
    repeatStart = false,
    repeatEnd = false,
    curves = [],
    ritAt,
    aTempoAt,
    label
  } = options;

  if (timeSignature) validateTimeSignature(timeSignature);
  if (firstNoteX !== undefined && (!Number.isFinite(firstNoteX) || firstNoteX < minimumFirstNoteX(options))) {
    throw new Error(`Ungültige Position der ersten Note: ${firstNoteX}; der Abstand zum Taktanfang ist zu klein.`);
  }

  notes.forEach((note) => {
    if (!Number.isInteger(note.step) || note.step < -2 || note.step > 10) {
      throw new Error(`Ungültige Notenposition: ${note.step}.`);
    }
  });
  validateTempoChanges({ ritAt, aTempoAt }, notes.length);
  const groups = collectBeamGroups(notes);
  validateCurves(curves, notes.length);

  const clefGlyph = clef === 'treble' ? '\uE050' : clef === 'bass' ? '\uE062' : undefined;
  const clefY = clef === 'bass' ? 37 : 55;
  const repeatStartX = clef ? 36 : 0;
  const prefixStart = (clef ? 36 : 6) + (repeatStart ? 24 : 0);
  const timeWidth = timeSignature
    ? timeSignatureWidth(timeSignature)
    : 0;
  const timeStart = prefixStart;
  const accidentalStart = timeSignature ? timeStart + timeWidth + 10 : prefixStart;
  const noteInset = firstNoteX ?? Math.max(noteStart, timeSignature
    ? accidentalStart + accidentals.length * 12 + 10
    : accidentals.length
      ? accidentalStart + accidentals.length * 12 + 10
      : clef
        ? 36
        : 0);
  const repeatEndInset = repeatEnd ? 16 : 0;
  const notePosition = (index: number) => {
    const fraction = firstNoteX === undefined ? (index + 1) / (notes.length + 1) : index / notes.length;
    return {
      percent: `${fraction * 100}%`,
      fraction,
      offset: noteInset * (1 - fraction) - repeatEndInset * fraction
    };
  };
  const beamStemEnds = new Map<number, number>();
  const beamStemDirections = new Map<number, boolean>();
  groups.forEach((group) => {
    const steps = group.indices.map((index) => notes[index].step);
    const stemUp = steps.reduce((sum, step) => sum + step, 0) / steps.length < 4;
    const firstIndex = group.indices[0];
    const lastIndex = group.indices[group.indices.length - 1];
    const firstY = 64 - notes[firstIndex].step * 4.5 + (stemUp ? -31.5 : 31.5);
    const lastY = 64 - notes[lastIndex].step * 4.5 + (stemUp ? -31.5 : 31.5);
    group.indices.forEach((index) => {
      const progress = (index - firstIndex) / (lastIndex - firstIndex);
      beamStemEnds.set(index, firstY + (lastY - firstY) * progress);
      beamStemDirections.set(index, stemUp);
    });
  });
  const articulationPosition = (note: NotationNote, index: number): 'above' | 'below' => {
    const hasStem = note.duration ? note.duration !== 'whole' : note.stem === true;
    const stemUp = beamStemDirections.get(index) ?? note.step < 4;
    return articulationPlacement(hasStem, stemUp, note.articulationPosition);
  };

  const description: string[] = [];
  if (clef) description.push(clef === 'treble' ? 'Violinschlüssel' : 'Bassschlüssel');
  if (timeSignature) description.push(`Taktart ${timeSignature.numerator}/${timeSignature.denominator}`);
  if (accidentals.length) {
    description.push(`Vorzeichen: ${accidentals.map(({ type, step }) => `${accidentalSymbols[type].label} auf Position ${step}`).join(', ')}`);
  }
  if (ritAt !== undefined) description.push(`rit. bei Note ${ritAt + 1}`);
  if (aTempoAt !== undefined) description.push(`a tempo bei Note ${aTempoAt + 1}`);
  notes.forEach((note, index) => {
    const name = note.duration
      ? durationLabels[note.duration]
      : note.type === 'filled' ? 'gefüllter Notenkopf' : 'ungefüllter Notenkopf';
    const articulation = note.articulation
      ? ` mit ${articulationSymbols[note.articulation].label}${articulationPosition(note, index) === 'below' ? ' unterhalb' : ''}`
      : '';
    description.push(`${name} auf Position ${note.step}${articulation}`);
  });

  const parts = [
    `<svg class="notation-staff" height="92" role="img" aria-label="${escapeXml(label ?? `${notes.length || accidentals.length ? 'Notensystem' : 'Leeres Notensystem'} mit fünf Linien${description.length ? `; ${description.join('; ')}` : ''}`)}" xmlns="http://www.w3.org/2000/svg">`,
    ...[28, 37, 46, 55, 64].map((y) => `<line x1="0" y1="${y}" x2="100%" y2="${y}" />`)
  ];

  if (showLeftBar) parts.push(renderBarLine(0, 28, 64));
  if (showRightBar && rightBarStyle === 'single' && !repeatEnd) parts.push(renderBarLine('100%', 28, 64));
  if (repeatEnd) {
    parts.push(renderRepeatEndAtBoundary(28, 64));
  }
  if (clefGlyph) parts.push(glyphText(clefGlyph, 6, clefY, 'notation-clef'));
  if (repeatStart) {
    parts.push(renderRepeatStart(repeatStartX, 28, 64));
  }

  if (timeSignature) {
    const center = timeStart + timeWidth / 2;
    parts.push(renderTimeSignature(timeSignature, center, 37, 55, 'notation-time'));
  }

  accidentals.forEach(({ type, step }, index) => {
    parts.push(glyphText(accidentalSymbols[type].glyph, accidentalStart + index * 12, 64 - step * 4.5, 'notation-accidental'));
  });

  groups.forEach((group) => {
    const steps = group.indices.map((index) => notes[index].step);
    const stemUp = steps.reduce((sum, step) => sum + step, 0) / steps.length < 4;
    const first = notePosition(group.indices[0]);
    const last = notePosition(group.indices[group.indices.length - 1]);
    const stemOffset = stemUp ? 4.5 : -4.5;
    const firstNote = notes[group.indices[0]];
    const lastNote = notes[group.indices[group.indices.length - 1]];
    const firstBeamY = 64 - firstNote.step * 4.5 + (stemUp ? -31.5 : 31.5);
    const lastBeamY = 64 - lastNote.step * 4.5 + (stemUp ? -31.5 : 31.5);
    for (let beam = 0; beam < (group.duration === 'sixteenth' ? 2 : 1); beam += 1) {
      const beamOffset = beam * (stemUp ? 6 : -6);
      parts.push(renderBeam(`calc(${first.percent} + ${first.offset + stemOffset}px)`, firstBeamY + beamOffset, `calc(${last.percent} + ${last.offset + stemOffset}px)`, lastBeamY + beamOffset));
    }
  });

  curves.forEach(({ from, to, placement, type }) => {
    const start = notePosition(from);
    const end = notePosition(to);
    const startY = 64 - notes[from].step * 4.5;
    const endY = 64 - notes[to].step * 4.5;
    const archAbove = placement ? placement === 'above' : notes[from].step >= 4;
    const span = end.fraction - start.fraction;
    const startX = `calc(${start.percent} + ${start.offset + noteHeadHalfWidth}px)`;
    const curveWidth = `max(0px, calc(${span * 100}% - ${(noteInset + repeatEndInset) * span + noteHeadHalfWidth * 2}px))`;
    parts.push(renderCurve(type, startX, curveWidth, 92, startY, endY, archAbove, 'notation-curve'));
  });

  notes.forEach((note, index) => {
    const position = notePosition(index);
    const y = 64 - note.step * 4.5;
    const stemUp = beamStemDirections.get(index) ?? note.step < 4;
    const hasStem = note.duration ? note.duration !== 'whole' : note.stem === true;
    const stemY = beamStemEnds.get(index) ?? y + (stemUp ? -31.5 : 31.5);
    const x = position.percent;
    if (note.step === -2 || note.step === 10) {
      parts.push(`<rect x="${x}" y="${y - 0.5}" width="18" height="1" transform="translate(${position.offset - 9} 0)" fill="currentColor" stroke="none" />`);
    }
    if (hasStem) {
      const stemOffset = position.offset + (stemUp ? 4.5 : -4.5);
      parts.push(renderStem(x, y, stemY, stemOffset));
    }
    const noteGlyph = note.duration === 'whole' ? '\uE0A2' : note.duration === 'half' || note.type === 'empty' ? '\uE0A3' : '\uE0A4';
    parts.push(`<g transform="translate(${position.offset} 0)">`);
    if (hasStem && (note.duration === 'eighth' || note.duration === 'sixteenth') && !note.beamGroup) {
      const flag = flagGlyph(note.duration, stemUp);
      parts.push(`<g transform="translate(${stemUp ? 4.5 : -4.5} 0)">${glyphText(flag, x, stemY, 'notation-note')}</g>`);
    }
    parts.push(glyphText(noteGlyph, x, y, 'notation-note', 'middle'));
    if (note.dotted) parts.push(renderDot(x, y - 3, noteHeadHalfWidth + 3));
    if (note.accidental) {
      const accidentalOffset = noteHeadHalfWidth + accidentalNoteGap;
      parts.push(`<g transform="translate(${-accidentalOffset} 0)">${glyphText(accidentalSymbols[note.accidental].glyph, x, y, 'notation-accidental', 'end')}</g>`);
    }
    if (note.articulation) {
      const position = articulationPosition(note, index);
      const noteEdgeY = y + (position === 'below' ? 4.5 : -4.5);
      parts.push(renderArticulation(note.articulation, position, x, articulationY(noteEdgeY, position), 'notation-articulation'));
    }
    parts.push('</g>');
  });

  if (ritAt !== undefined) {
    const position = notePosition(ritAt);
    parts.push(renderTempoMark('rit.', position.percent, 18, position.offset, 'notation-tempo'));
  }
  if (aTempoAt !== undefined) {
    const position = notePosition(aTempoAt);
    parts.push(renderTempoMark('a tempo', position.percent, 18, position.offset, 'notation-tempo'));
  }

  parts.push('</svg>');
  return parts.join('');
}
