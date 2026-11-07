export type NotationDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type NotationArticulation = 'staccato' | 'tenuto' | 'accent' | 'marcato';
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

export interface NotationCurve {
  from: number;
  to: number;
  type: 'tie' | 'slur';
  placement?: 'above' | 'below';
}

export interface NotationRenderOptions {
  clef?: 'treble' | 'bass';
  notes?: NotationNote[];
  accidentals?: NotationAccidental[];
  timeSignature?: { numerator: number; denominator: number };
  noteStart?: number;
  showLeftBar?: boolean;
  showRightBar?: boolean;
  rightBarStyle?: 'single' | 'final';
  repeatStart?: boolean;
  repeatEnd?: boolean;
  curves?: NotationCurve[];
  label?: string;
}

const durationLabels: Record<NotationDuration, string> = {
  whole: 'Ganze Note',
  half: 'Halbe Note',
  quarter: 'Viertelnote',
  eighth: 'Achtelnote',
  sixteenth: 'Sechzehntelnote'
};

const articulationSymbols: Record<NotationArticulation, {
  above: string;
  below: string;
  belowOffset: number;
  label: string;
}> = {
  staccato: { above: '\uE4A2', below: '\uE4A3', belowOffset: 12, label: 'Staccato' },
  tenuto: { above: '\uE4A4', below: '\uE4A5', belowOffset: 12, label: 'Tenuto' },
  accent: { above: '\uE4A0', below: '\uE4A1', belowOffset: 14, label: 'Akzent' },
  marcato: { above: '\uE4AC', below: '\uE4AD', belowOffset: 14, label: 'Marcato' }
};

const accidentalSymbols = {
  sharp: { glyph: '\uE262', label: 'Kreuz' },
  natural: { glyph: '\uE261', label: 'Auflösungszeichen' },
  flat: { glyph: '\uE260', label: 'b-Vorzeichen' }
} as const;

const noteHeadHalfWidth = 6.5;
const accidentalNoteGap = 4;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character] as string);
}

function glyphText(glyph: string, x: string | number, y: string | number, className: string, anchor?: string): string {
  return `<text class="${className}" x="${x}" y="${y}"${anchor ? ` text-anchor="${anchor}"` : ''}>${escapeXml(glyph)}</text>`;
}

export function renderNotationSvg(options: NotationRenderOptions): string {
  const {
    clef,
    notes = [],
    accidentals = [],
    timeSignature,
    noteStart = 0,
    showLeftBar = false,
    showRightBar = true,
    rightBarStyle = 'single',
    repeatStart = false,
    repeatEnd = false,
    curves = [],
    label
  } = options;

  if (timeSignature && (!Number.isSafeInteger(timeSignature.numerator) || timeSignature.numerator <= 0 ||
      !Number.isSafeInteger(timeSignature.denominator) || timeSignature.denominator <= 0 ||
      !Number.isInteger(Math.log2(timeSignature.denominator)))) {
    throw new Error('Ungültige Taktart: Der Zähler muss eine positive ganze Zahl und der Nenner eine positive Zweierpotenz sein.');
  }

  notes.forEach((note) => {
    if (!Number.isInteger(note.step) || note.step < -2 || note.step > 10) {
      throw new Error(`Ungültige Notenposition: ${note.step}.`);
    }
  });

  const groups = new Map<string, { indices: number[]; duration: 'eighth' | 'sixteenth' }>();
  notes.forEach((note, index) => {
    if (note.beamGroup === undefined) return;
    if (!note.beamGroup || (note.duration !== 'eighth' && note.duration !== 'sixteenth')) {
      throw new Error('Balkengruppen benötigen einen Namen und dürfen nur Achtel- oder Sechzehntelnoten enthalten.');
    }
    const group = groups.get(note.beamGroup);
    if (group && (group.duration !== note.duration || group.indices[group.indices.length - 1] !== index - 1)) {
      throw new Error(`Balkengruppe "${note.beamGroup}" muss zusammenhängende Noten desselben Werts enthalten.`);
    }
    if (group) group.indices.push(index);
    else groups.set(note.beamGroup, { indices: [index], duration: note.duration });
  });
  for (const [name, group] of groups) {
    if (group.indices.length < 2) throw new Error(`Balkengruppe "${name}" benötigt mindestens zwei Noten.`);
  }

  curves.forEach(({ from, to }) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to >= notes.length || from >= to) {
      throw new Error(`Ungültiger Bogen zwischen Noten ${from} und ${to}.`);
    }
  });

  const clefGlyph = clef === 'treble' ? '\uE050' : clef === 'bass' ? '\uE062' : undefined;
  const clefY = clef === 'bass' ? 37 : 55;
  const accidentalStart = clef ? 36 : 6;
  const timeWidth = timeSignature
    ? Math.max(String(timeSignature.numerator).length, String(timeSignature.denominator).length) * 17
    : 0;
  const timeStart = accidentalStart + accidentals.length * 12;
  const noteInset = Math.max(noteStart, timeSignature
    ? timeStart + timeWidth + 10
    : accidentals.length
      ? timeStart + 10
      : clef
        ? 36
        : 0);
  const notePosition = (index: number) => ({
    percent: `${((index + 1) / (notes.length + 1)) * 100}%`,
    fraction: (index + 1) / (notes.length + 1),
    offset: noteInset * (1 - (index + 1) / (notes.length + 1))
  });
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
    if (hasStem && !stemUp) return 'above';
    return note.articulationPosition ?? 'above';
  };

  const description: string[] = [];
  if (clef) description.push(clef === 'treble' ? 'Violinschlüssel' : 'Bassschlüssel');
  if (timeSignature) description.push(`Taktart ${timeSignature.numerator}/${timeSignature.denominator}`);
  if (accidentals.length) {
    description.push(`Vorzeichen: ${accidentals.map(({ type, step }) => `${accidentalSymbols[type].label} auf Position ${step}`).join(', ')}`);
  }
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

  if (showLeftBar) parts.push('<line x1="0" y1="28" x2="0" y2="64" />');
  if (showRightBar && rightBarStyle === 'single') parts.push('<line x1="100%" y1="28" x2="100%" y2="64" />');
  if (repeatStart) {
    parts.push('<line x1="0" y1="28" x2="0" y2="64" stroke-width="4" />',
      '<line x1="4" y1="28" x2="4" y2="64" />',
      '<circle cx="8" cy="41" r="1.5" fill="currentColor" stroke="none" />',
      '<circle cx="8" cy="51" r="1.5" fill="currentColor" stroke="none" />');
  }
  if (repeatEnd) {
    parts.push('<circle cx="90%" cy="41" r="1.5" fill="currentColor" stroke="none" />',
      '<circle cx="90%" cy="51" r="1.5" fill="currentColor" stroke="none" />',
      '<line x1="94%" y1="28" x2="94%" y2="64" />',
      '<line x1="98%" y1="28" x2="98%" y2="64" stroke-width="4" />');
  }
  if (clefGlyph) parts.push(glyphText(clefGlyph, 6, clefY, 'notation-clef'));

  accidentals.forEach(({ type, step }, index) => {
    parts.push(glyphText(accidentalSymbols[type].glyph, accidentalStart + index * 12, 64 - step * 4.5, 'notation-accidental'));
  });

  if (timeSignature) {
    const center = timeStart + timeWidth / 2;
    const glyphs = (value: number) => [...String(value)].map((digit) => String.fromCodePoint(0xE080 + Number(digit))).join('');
    parts.push(glyphText(glyphs(timeSignature.numerator), center, 37, 'notation-time', 'middle'));
    parts.push(glyphText(glyphs(timeSignature.denominator), center, 55, 'notation-time', 'middle'));
  }

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
      parts.push(`<line x1="calc(${first.percent} + ${first.offset + stemOffset}px)" y1="${firstBeamY + beamOffset}" x2="calc(${last.percent} + ${last.offset + stemOffset}px)" y2="${lastBeamY + beamOffset}" stroke-width="4" />`);
    }
  });

  curves.forEach(({ from, to, placement, type }) => {
    const start = notePosition(from);
    const end = notePosition(to);
    const startY = 64 - notes[from].step * 4.5;
    const endY = 64 - notes[to].step * 4.5;
    const archAbove = placement ? placement === 'above' : notes[from].step >= 4;
    const span = end.fraction - start.fraction;
    const arch = 18;
    const outerControlY = (startY + endY) / 2 + (archAbove ? -arch : arch);
    const thickness = type === 'tie' ? 3 : 5;
    const innerControlY = outerControlY + (archAbove ? thickness : -thickness);
    const startX = `calc(${start.percent} + ${start.offset + noteHeadHalfWidth}px)`;
    const curveWidth = `max(0px, calc(${span * 100}% - ${noteInset * span + noteHeadHalfWidth * 2}px))`;
    parts.push(`<svg class="notation-curve ${type}" x="${startX}" y="0" width="${curveWidth}" height="92" viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 ${startY} Q 50 ${outerControlY} 100 ${endY} Q 50 ${innerControlY} 0 ${startY} Z" /></svg>`);
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
      parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${stemY}" transform="translate(${stemOffset} 0)" />`);
    }
    const noteGlyph = note.duration === 'whole' ? '\uE0A2' : note.duration === 'half' || note.type === 'empty' ? '\uE0A3' : '\uE0A4';
    parts.push(`<g transform="translate(${position.offset} 0)">`);
    if (hasStem && (note.duration === 'eighth' || note.duration === 'sixteenth') && !note.beamGroup) {
      const flag = note.duration === 'eighth' ? (stemUp ? '\uE240' : '\uE241') : (stemUp ? '\uE242' : '\uE243');
      parts.push(`<g transform="translate(${stemUp ? 4.5 : -4.5} 0)">${glyphText(flag, x, stemY, 'notation-note')}</g>`);
    }
    parts.push(glyphText(noteGlyph, x, y, 'notation-note', 'middle'));
    if (note.dotted) parts.push(`<circle cx="${x}" cy="${y - 3}" r="1.25" fill="currentColor" stroke="none" />`);
    if (note.accidental) {
      const accidentalOffset = noteHeadHalfWidth + accidentalNoteGap;
      parts.push(`<g transform="translate(${-accidentalOffset} 0)">${glyphText(accidentalSymbols[note.accidental].glyph, x, y, 'notation-accidental', 'end')}</g>`);
    }
    if (note.articulation) {
      const symbol = articulationSymbols[note.articulation];
      const position = articulationPosition(note, index);
      const articulationY = y + (position === 'below' ? symbol.belowOffset : -12);
      parts.push(glyphText(position === 'below' ? symbol.below : symbol.above, x, articulationY, 'notation-articulation', 'middle'));
    }
    parts.push('</g>');
  });

  parts.push('</svg>');
  return parts.join('');
}
