import {
  type Articulation,
  articulationPlacement,
  articulationSymbols,
  articulationY,
  renderArticulation,
} from "./articulation.ts";
import {
  renderBarLine,
  renderRepeatEndAtBoundary,
  renderRepeatStart,
} from "./barline.ts";
import { type MusicCurve, renderCurve, validateCurves } from "./curve.ts";
import { layoutNotationEvents } from "./notation-layout.ts";
import { renderRest, restSymbols } from "./rest.ts";
import {
  collectBeamGroups,
  type Duration,
  durationLabels,
  flagGlyph,
  renderBeam,
  renderDot,
  renderStem,
  rhythmicPositions,
} from "./rhythm.ts";
import { escapeXml, glyphText } from "./svg.ts";
import { renderTempoMark, validateTempoChanges } from "./tempo.ts";
import {
  renderTimeSignature,
  type TimeSignature,
  timeSignatureWidth,
  validateTimeSignature,
} from "./time-signature.ts";

export type NotationDuration = Duration;
export const SPATIUM = 10;
export const sp = (val: number) => val * SPATIUM;

const NOTE_WIDTH = sp(1.35);
const NOTE_HEIGHT = sp(1.0);
const STEM_WIDTH = sp(0.12);
const STEM_LEN = sp(3.5);
const MIN_STEM_LEN = sp(2.5);
const BEAM_WIDTH = sp(0.5);
const LEDGER_OVERHANG = sp(0.5);
const STAFF_BOTTOM = 64;
const STAFF_TOP = STAFF_BOTTOM - sp(4);
const STAFF_MIDDLE = STAFF_BOTTOM - sp(2);
const stepY = (step: number) => STAFF_BOTTOM - step * sp(0.5);

export type NotationArticulation = Articulation;
export type NotationClef = "treble" | "bass";
export type NotationAccidental = {
  type: "sharp" | "natural" | "flat";
  step: number;
};
export type NotationNote =
  | {
      type: "filled" | "empty";
      step: number;
      stem?: boolean;
      articulation?: NotationArticulation;
      articulationPosition?: "above" | "below";
      accidental?: "sharp" | "natural" | "flat";
      duration?: never;
      beamGroup?: never;
      dotted?: never;
    }
  | {
      duration: NotationDuration;
      step: number;
      beamGroup?: string;
      articulation?: NotationArticulation;
      articulationPosition?: "above" | "below";
      accidental?: "sharp" | "natural" | "flat";
      dotted?: boolean;
      type?: never;
      stem?: never;
    };

export type NotationRest = {
  type: "rest";
  duration: NotationDuration;
  dotted?: boolean;
  step?: never;
  stem?: never;
  beamGroup?: never;
  articulation?: never;
  articulationPosition?: never;
  accidental?: never;
};
export type NotationEvent = NotationNote | NotationRest;

export type NotationCurve = MusicCurve;

export interface NotationRenderOptions {
  clef?: NotationClef;
  notes?: NotationEvent[];
  accidentals?: NotationAccidental[];
  timeSignature?: TimeSignature;
  layoutTimeSignature?: TimeSignature;
  noteStart?: number;
  firstNoteX?: number;
  showLeftBar?: boolean;
  showRightBar?: boolean;
  rightBarStyle?: "single" | "final";
  repeatStart?: boolean;
  repeatEnd?: boolean;
  curves?: NotationCurve[];
  ritAt?: number;
  aTempoAt?: number;
  label?: string;
}

export function assertNoClefChanges(
  clefs: readonly (NotationClef | false | undefined)[],
  pieceName: string,
): void {
  let activeClef: NotationClef | undefined;
  for (const clef of clefs) {
    if (!clef) continue;
    if (activeClef && clef !== activeClef) {
      throw new Error(
        `Ein Notenschlüsselwechsel von ${activeClef} zu ${clef} ist im Notationsstück "${pieceName}" nicht erlaubt.`,
      );
    }
    activeClef = clef;
  }
}

const accidentalSymbols = {
  sharp: { glyph: "\uE262", label: "Kreuz" },
  natural: { glyph: "\uE261", label: "Auflösungszeichen" },
  flat: { glyph: "\uE260", label: "b-Vorzeichen" },
} as const;

const noteHeadHalfWidth = NOTE_WIDTH / 2;
const defaultNoteHeadGap = NOTE_WIDTH * 1.5;
const accidentalNoteGap = sp(0.6);
const dotRadius = 1.5;

function eventExtents(event: NotationEvent): { left: number; right: number } {
  if (event.type === "rest") {
    return {
      left: sp(0.85),
      right: (event.dotted ? sp(1) + dotRadius : sp(0.65)) + sp(0.2),
    };
  }
  const ledger = event.step === -2 || event.step === 10 ? LEDGER_OVERHANG : 0;
  const left =
    noteHeadHalfWidth +
    Math.max(ledger, event.accidental ? accidentalNoteGap + sp(1) : 0);
  const flagged =
    !event.beamGroup &&
    (event.duration === "eighth" || event.duration === "sixteenth") &&
    event.step < 4;
  const right = Math.max(
    noteHeadHalfWidth +
      Math.max(ledger, event.dotted ? sp(0.6) + 2 * dotRadius : 0),
    flagged ? noteHeadHalfWidth + sp(1.3) : 0,
  );
  return { left: left + sp(0.2), right: right + sp(0.2) };
}

function prefixGeometry(
  clef: NotationClef | undefined,
  accidentals: NotationAccidental[],
  timeSignature: TimeSignature | undefined,
  repeatStart: boolean,
) {
  const timeStart = clef ? 36 : 6;
  const timeEnd = timeSignature
    ? timeStart + timeSignatureWidth(timeSignature) + 10
    : timeStart;
  const accidentalStart = timeEnd;
  const accidentalEnd = accidentalStart + accidentals.length * 12;
  const repeatStartX = accidentals.length
    ? accidentalEnd + 6
    : timeSignature
      ? timeEnd
      : clef
        ? 36
        : 0;
  const prefixEnd = Math.max(
    clef ? 36 : 0,
    accidentals.length ? accidentalEnd : 0,
    timeSignature ? timeEnd : 0,
    repeatStart ? repeatStartX + 12 : 0,
  );
  return { accidentalStart, timeStart, repeatStartX, prefixEnd };
}

export function minimumFirstNoteX(
  options: Pick<
    NotationRenderOptions,
    | "clef"
    | "timeSignature"
    | "accidentals"
    | "repeatStart"
    | "notes"
    | "noteStart"
  >,
): number {
  const {
    clef,
    timeSignature,
    accidentals = [],
    repeatStart = false,
    notes = [],
    noteStart = 0,
  } = options;
  if (timeSignature) validateTimeSignature(timeSignature);
  const prefixEnd = Math.max(
    prefixGeometry(clef, accidentals, timeSignature, repeatStart).prefixEnd,
    noteStart,
  );
  if (clef || timeSignature || accidentals.length || repeatStart) {
    return (
      prefixEnd +
      sp(1.8) +
      (notes[0] ? eventExtents(notes[0]).left : noteHeadHalfWidth)
    );
  }
  return prefixEnd + 10 + (notes[0]?.accidental ? 16 : 0);
}

export function defaultFirstNoteX(
  options: Parameters<typeof minimumFirstNoteX>[0],
): number {
  const first = options.notes?.[0];
  const minimum = minimumFirstNoteX(options);
  if (!first || first.type === "rest") return minimum;
  const prefixEnd = Math.max(
    prefixGeometry(
      options.clef,
      options.accidentals ?? [],
      options.timeSignature,
      options.repeatStart ?? false,
    ).prefixEnd,
    options.noteStart ?? 0,
  );
  return Math.max(
    minimum,
    prefixEnd + defaultNoteHeadGap + eventExtents(first).left - sp(0.2),
  );
}

export function renderNotationSvg(options: NotationRenderOptions): string {
  const {
    clef,
    notes = [],
    accidentals = [],
    timeSignature,
    layoutTimeSignature,
    firstNoteX,
    showLeftBar = false,
    showRightBar = true,
    rightBarStyle = "single",
    repeatStart = false,
    repeatEnd = false,
    curves = [],
    ritAt,
    aTempoAt,
    label,
  } = options;

  if (timeSignature) validateTimeSignature(timeSignature);
  if (layoutTimeSignature) validateTimeSignature(layoutTimeSignature);
  if (
    firstNoteX !== undefined &&
    (!Number.isFinite(firstNoteX) || firstNoteX < minimumFirstNoteX(options))
  ) {
    throw new Error(
      `Ungültige Position der ersten Note: ${firstNoteX}; der Abstand zum Taktanfang ist zu klein.`,
    );
  }

  notes.forEach((note) => {
    if (note.type === "rest") {
      if (!restSymbols[note.duration])
        throw new Error(`Ungültiger Pausenwert: ${note.duration}.`);
      if (
        "step" in note ||
        "stem" in note ||
        "beamGroup" in note ||
        "articulation" in note ||
        "articulationPosition" in note ||
        "accidental" in note
      ) {
        throw new Error(
          "Pausen dürfen keine Notenhöhe, Hälse, Balkengruppen, Artikulationen oder Vorzeichen haben.",
        );
      }
      return;
    }
    if (!Number.isInteger(note.step) || note.step < -2 || note.step > 10) {
      throw new Error(`Ungültige Notenposition: ${note.step}.`);
    }
  });
  validateTempoChanges({ ritAt, aTempoAt }, notes.length);
  const groups = collectBeamGroups(notes);
  validateCurves(curves, notes.length);
  curves.forEach(({ from, to, type }) => {
    if (notes[from].type === "rest" || notes[to].type === "rest") {
      throw new Error(
        "Ein Bogen muss an Noten beginnen und enden, nicht an Pausen.",
      );
    }
    if (
      type === "tie" &&
      notes.slice(from + 1, to).some((event) => event.type === "rest")
    ) {
      throw new Error("Ein Haltebogen darf keine Pause überspannen.");
    }
  });

  const pitchedNote = (index: number): NotationNote => {
    const event = notes[index];
    if (event.type === "rest")
      throw new Error(
        "Für Balken und Bögen wird eine Note statt einer Pause benötigt.",
      );
    return event;
  };

  const clefGlyph =
    clef === "treble" ? "\uE050" : clef === "bass" ? "\uE062" : undefined;
  const clefY = clef === "bass" ? STAFF_TOP + sp(1) : STAFF_BOTTOM - sp(1);
  const { accidentalStart, timeStart, repeatStartX, prefixEnd } =
    prefixGeometry(clef, accidentals, timeSignature, repeatStart);
  const timeWidth = timeSignature ? timeSignatureWidth(timeSignature) : 0;
  const repeatEndInset = repeatEnd ? 16 : 0;
  const lastNote = notes[notes.length - 1];
  const wholeMeasureRest =
    notes.length === 1 &&
    lastNote.type === "rest" &&
    lastNote.duration === "whole" &&
    !lastNote.dotted;
  const noteInset =
    firstNoteX ??
    (wholeMeasureRest &&
    !clef &&
    !timeSignature &&
    !accidentals.length &&
    !repeatStart
      ? Math.max(options.noteStart ?? 0, prefixEnd)
      : defaultFirstNoteX(options));
  const endingMarkInset = repeatEnd
    ? repeatEndInset
    : showRightBar && rightBarStyle === "final"
      ? 8
      : 0;
  const rhythm = rhythmicPositions(notes, timeSignature ?? layoutTimeSignature);
  const endInset =
    wholeMeasureRest || !lastNote
      ? repeatEndInset
      : rhythm && !rhythm.overfull
        ? endingMarkInset
        : endingMarkInset +
          defaultNoteHeadGap +
          eventExtents(lastNote).right -
          sp(0.2);
  const positions = layoutNotationEvents(notes, {
    noteInset,
    endInset,
    rhythmicPositions: rhythm?.positions,
  });
  const notePosition = (index: number) => positions[index];
  let minimumWidth = notes.reduce((minimum, note, index) => {
    if (index === 0) return minimum;
    const distance =
      eventExtents(notes[index - 1]).right + sp(1) + eventExtents(note).left;
    const fraction = positions[index].fraction - positions[index - 1].fraction;
    return Math.max(minimum, noteInset + endInset + distance / fraction);
  }, noteInset + endInset);
  if (lastNote && positions[positions.length - 1].fraction < 1) {
    const last = positions[positions.length - 1];
    minimumWidth = Math.max(
      minimumWidth,
      (last.offset +
        eventExtents(lastNote).right +
        sp(wholeMeasureRest ? 1.5 : 1) +
        endingMarkInset) /
        (1 - last.fraction),
    );
  }
  const beamStemEnds = new Map<number, number>();
  groups.forEach((group) => {
    const steps = group.indices.map((index) => pitchedNote(index).step);
    const stemUp = steps[0] < 4;
    const mixedDirections = steps.some((step) => step < 4 !== stemUp);
    const firstIndex = group.indices[0];
    const lastIndex = group.indices[group.indices.length - 1];
    if (mixedDirections) {
      group.indices.forEach((index) => {
        const note = pitchedNote(index);
        const y = stepY(note.step);
        beamStemEnds.set(
          index,
          note.step < 4
            ? Math.min(y - STEM_LEN, STAFF_MIDDLE)
            : Math.max(y + STEM_LEN, STAFF_MIDDLE),
        );
      });
      return;
    }
    const firstY =
      stepY(pitchedNote(firstIndex).step) + (stemUp ? -STEM_LEN : STEM_LEN);
    const lastY =
      stepY(pitchedNote(lastIndex).step) + (stemUp ? -STEM_LEN : STEM_LEN);
    const firstFraction = notePosition(firstIndex).fraction;
    const lastFraction = notePosition(lastIndex).fraction;
    const stemEnds = group.indices.map((index) => {
      const progress =
        (notePosition(index).fraction - firstFraction) /
        (lastFraction - firstFraction);
      return firstY + (lastY - firstY) * progress;
    });
    const adjustment = Math.max(
      0,
      ...group.indices.map((index, i) => {
        const length =
          (stemEnds[i] - stepY(pitchedNote(index).step)) * (stemUp ? -1 : 1);
        const middleLength = stemUp
          ? stepY(pitchedNote(index).step) - STAFF_MIDDLE
          : STAFF_MIDDLE - stepY(pitchedNote(index).step);
        return Math.max(MIN_STEM_LEN, middleLength, length) - length;
      }),
    );
    group.indices.forEach((index, i) => {
      beamStemEnds.set(
        index,
        stemEnds[i] + (stemUp ? -adjustment : adjustment),
      );
    });
  });
  const articulationPosition = (note: NotationNote): "above" | "below" => {
    const hasStem = note.duration
      ? note.duration !== "whole"
      : note.stem === true;
    const stemUp = note.step < 4;
    return articulationPlacement(hasStem, stemUp, note.articulationPosition);
  };

  const description: string[] = [];
  if (clef)
    description.push(clef === "treble" ? "Violinschlüssel" : "Bassschlüssel");
  if (timeSignature)
    description.push(
      `Taktart ${timeSignature.numerator}/${timeSignature.denominator}`,
    );
  if (accidentals.length) {
    description.push(
      `Vorzeichen: ${accidentals.map(({ type, step }) => `${accidentalSymbols[type].label} auf Position ${step}`).join(", ")}`,
    );
  }
  if (ritAt !== undefined) description.push(`rit. bei Note ${ritAt + 1}`);
  if (aTempoAt !== undefined)
    description.push(`a tempo bei Note ${aTempoAt + 1}`);
  notes.forEach((note) => {
    if (note.type === "rest") {
      description.push(
        `${note.dotted ? "Punktierte " : ""}${restSymbols[note.duration].label}`,
      );
      return;
    }
    const name = note.duration
      ? durationLabels[note.duration]
      : note.type === "filled"
        ? "gefüllter Notenkopf"
        : "ungefüllter Notenkopf";
    const articulation = note.articulation
      ? ` mit ${articulationSymbols[note.articulation].label}${articulationPosition(note) === "below" ? " unterhalb" : ""}`
      : "";
    description.push(`${name} auf Position ${note.step}${articulation}`);
  });

  const parts = [
    `<svg class="notation-staff" height="92" style="--notation-spatium:${SPATIUM}px;min-width:${Math.ceil(minimumWidth)}px" role="img" aria-label="${escapeXml(label ?? `${notes.length || accidentals.length ? "Notensystem" : "Leeres Notensystem"} mit fünf Linien${description.length ? `; ${description.join("; ")}` : ""}`)}" xmlns="http://www.w3.org/2000/svg">`,
    ...Array.from({ length: 5 }, (_, i) => STAFF_TOP + i * sp(1)).map(
      (y) => `<line x1="0" y1="${y}" x2="100%" y2="${y}" />`,
    ),
  ];

  if (showLeftBar) parts.push(renderBarLine(0, STAFF_TOP, STAFF_BOTTOM));
  if (showRightBar && rightBarStyle === "single" && !repeatEnd)
    parts.push(renderBarLine("100%", STAFF_TOP, STAFF_BOTTOM));
  if (repeatEnd) {
    parts.push(renderRepeatEndAtBoundary(STAFF_TOP, STAFF_BOTTOM));
  }
  if (clefGlyph) parts.push(glyphText(clefGlyph, 6, clefY, "notation-clef"));
  if (repeatStart) {
    parts.push(renderRepeatStart(repeatStartX, STAFF_TOP, STAFF_BOTTOM));
  }

  if (timeSignature) {
    const center = timeStart + timeWidth / 2;
    parts.push(
      renderTimeSignature(
        timeSignature,
        center,
        STAFF_TOP + sp(1),
        STAFF_BOTTOM - sp(1),
        "notation-time",
      ),
    );
  }

  accidentals.forEach(({ type, step }, index) => {
    parts.push(
      glyphText(
        accidentalSymbols[type].glyph,
        accidentalStart + index * 12,
        stepY(step),
        "notation-accidental",
      ),
    );
  });

  const beams: string[] = [];
  groups.forEach((group) => {
    const steps = group.indices.map((index) => pitchedNote(index).step);
    const stemUp = steps[0] < 4;
    const mixedDirections = steps.some((step) => step < 4 !== stemUp);
    if (mixedDirections) {
      group.indices.slice(0, -1).forEach((index, i) => {
        const nextIndex = group.indices[i + 1];
        const start = notePosition(index);
        const end = notePosition(nextIndex);
        const startUp = pitchedNote(index).step < 4;
        const endUp = pitchedNote(nextIndex).step < 4;
        const startOffset =
          start.offset +
          (noteHeadHalfWidth - STEM_WIDTH / 2) * (startUp ? 1 : -1);
        const endOffset =
          end.offset + (noteHeadHalfWidth - STEM_WIDTH / 2) * (endUp ? 1 : -1);
        const startY = beamStemEnds.get(index) ?? STAFF_MIDDLE;
        const endY = beamStemEnds.get(nextIndex) ?? STAFF_MIDDLE;
        const startX = `calc(${start.percent} + ${startOffset - STEM_WIDTH / 2}px)`;
        const endX = `calc(${end.percent} + ${endOffset + STEM_WIDTH / 2}px)`;
        beams.push(renderBeam(startX, startY, endX, endY, BEAM_WIDTH));
        if (group.duration === "sixteenth") {
          if (startUp === endUp) {
            const offset = sp(0.75) * (startUp ? 1 : -1);
            beams.push(
              renderBeam(
                startX,
                startY + offset,
                endX,
                endY + offset,
                BEAM_WIDTH,
              ),
            );
          } else {
            const middleX = `calc(${(start.fraction + end.fraction) * 50}% + ${(startOffset + endOffset) / 2}px)`;
            const middleY = (startY + endY) / 2;
            const offset = sp(0.75) * (startUp ? 1 : -1);
            beams.push(
              renderBeam(
                startX,
                startY + offset,
                middleX,
                middleY + offset,
                BEAM_WIDTH,
              ),
            );
            beams.push(
              renderBeam(
                middleX,
                middleY - offset,
                endX,
                endY - offset,
                BEAM_WIDTH,
              ),
            );
          }
        }
      });
      return;
    }
    const first = notePosition(group.indices[0]);
    const last = notePosition(group.indices[group.indices.length - 1]);
    const stemOffset = (noteHeadHalfWidth - STEM_WIDTH / 2) * (stemUp ? 1 : -1);
    const firstBeamY = beamStemEnds.get(group.indices[0]) ?? STAFF_MIDDLE;
    const lastBeamY =
      beamStemEnds.get(group.indices[group.indices.length - 1]) ?? STAFF_MIDDLE;
    for (
      let beam = 0;
      beam < (group.duration === "sixteenth" ? 2 : 1);
      beam += 1
    ) {
      const beamOffset = beam * sp(0.75) * (stemUp ? 1 : -1);
      beams.push(
        renderBeam(
          `calc(${first.percent} + ${first.offset + stemOffset - STEM_WIDTH / 2}px)`,
          firstBeamY + beamOffset,
          `calc(${last.percent} + ${last.offset + stemOffset + STEM_WIDTH / 2}px)`,
          lastBeamY + beamOffset,
          BEAM_WIDTH,
        ),
      );
    }
  });

  curves.forEach(({ from, to, placement, type }) => {
    const start = notePosition(from);
    const end = notePosition(to);
    const startNote = pitchedNote(from);
    const endNote = pitchedNote(to);
    const startY = stepY(startNote.step);
    const endY = stepY(endNote.step);
    const archAbove = placement ? placement === "above" : startNote.step >= 4;
    const span = end.fraction - start.fraction;
    const startX = `calc(${start.percent} + ${start.offset + noteHeadHalfWidth}px)`;
    const curveWidth = `max(0px, calc(${span * 100}% - ${(noteInset + repeatEndInset) * span + noteHeadHalfWidth * 2}px))`;
    parts.push(
      renderCurve(
        type,
        startX,
        curveWidth,
        92,
        startY,
        endY,
        archAbove,
        "notation-curve",
      ),
    );
  });

  notes.forEach((note, index) => {
    const position = notePosition(index);
    if (note.type === "rest") {
      parts.push(
        `<g transform="translate(${position.offset} 0)">${renderRest(note.duration, position.percent, STAFF_MIDDLE, note.dotted, SPATIUM)}</g>`,
      );
      return;
    }
    const y = stepY(note.step);
    const stemUp = note.step < 4;
    const hasStem = note.duration
      ? note.duration !== "whole"
      : note.stem === true;
    const stemY =
      beamStemEnds.get(index) ??
      (stemUp
        ? Math.min(y - Math.max(MIN_STEM_LEN, STEM_LEN), STAFF_MIDDLE)
        : Math.max(y + Math.max(MIN_STEM_LEN, STEM_LEN), STAFF_MIDDLE));
    const x = position.percent;
    if (note.step === -2 || note.step === 10) {
      parts.push(
        `<rect x="${x}" y="${y - 0.5}" width="${NOTE_WIDTH + 2 * LEDGER_OVERHANG}" height="1" transform="translate(${position.offset - noteHeadHalfWidth - LEDGER_OVERHANG} 0)" fill="currentColor" stroke="none" />`,
      );
    }
    if (hasStem) {
      const stemOffset =
        position.offset +
        (noteHeadHalfWidth - STEM_WIDTH / 2) * (stemUp ? 1 : -1);
      parts.push(renderStem(x, y, stemY, stemOffset, STEM_WIDTH));
    }
    const noteGlyph =
      note.duration === "whole"
        ? "\uE0A2"
        : note.duration === "half" || note.type === "empty"
          ? "\uE0A3"
          : "\uE0A4";
    parts.push(`<g transform="translate(${position.offset} 0)">`);
    if (
      hasStem &&
      (note.duration === "eighth" || note.duration === "sixteenth") &&
      !note.beamGroup
    ) {
      const flag = flagGlyph(note.duration, stemUp);
      parts.push(
        `<g transform="translate(${(noteHeadHalfWidth - STEM_WIDTH / 2) * (stemUp ? 1 : -1)} 0)">${glyphText(flag, x, stemY, "notation-note")}</g>`,
      );
    }
    parts.push(
      glyphText(noteGlyph, x, y, "notation-note", "middle", NOTE_WIDTH),
    );
    if (note.dotted)
      parts.push(
        renderDot(
          x,
          y - (note.step % 2 === 0 ? sp(0.5) : 0),
          noteHeadHalfWidth + sp(0.6) + dotRadius,
        ),
      );
    if (note.accidental) {
      const accidentalOffset = noteHeadHalfWidth + accidentalNoteGap;
      parts.push(
        `<g transform="translate(${-accidentalOffset} 0)">${glyphText(accidentalSymbols[note.accidental].glyph, x, y, "notation-accidental", "end")}</g>`,
      );
    }
    if (note.articulation) {
      const position = articulationPosition(note);
      const noteEdgeY =
        hasStem && (position === "above") === stemUp
          ? stemY
          : y + (position === "below" ? NOTE_HEIGHT / 2 : -NOTE_HEIGHT / 2);
      parts.push(
        renderArticulation(
          note.articulation,
          position,
          x,
          articulationY(noteEdgeY, position, sp(0.75)),
          "notation-articulation",
        ),
      );
    }
    parts.push("</g>");
  });
  parts.push(...beams);

  if (ritAt !== undefined) {
    const position = notePosition(ritAt);
    parts.push(
      renderTempoMark(
        "rit.",
        position.percent,
        18,
        position.offset,
        "notation-tempo",
      ),
    );
  }
  if (aTempoAt !== undefined) {
    const position = notePosition(aTempoAt);
    parts.push(
      renderTempoMark(
        "a tempo",
        position.percent,
        18,
        position.offset,
        "notation-tempo",
      ),
    );
  }

  parts.push("</svg>");
  return parts.join("");
}
