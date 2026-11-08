import {
  type Articulation,
  articulationPlacement,
  articulationSymbols,
  articulationY,
  renderArticulation,
} from "../components/music/articulation.ts";
import {
  renderBarLine,
  renderRepeatEndAtBoundary,
  renderRepeatStart,
} from "../components/music/barline.ts";
import {
  type MusicCurve,
  renderCurve,
  validateCurves,
} from "../components/music/curve.ts";
import { renderRest, restSymbols } from "../components/music/rest.ts";
import {
  collectBeamGroups,
  type Duration,
  durationLabels,
  flagGlyph,
  renderBeam,
  renderDot,
  renderStem,
  rhythmicPositions,
} from "../components/music/rhythm.ts";
import { escapeXml, glyphText } from "../components/music/svg.ts";
import {
  renderTempoMark,
  validateTempoChanges,
} from "../components/music/tempo.ts";
import {
  renderTimeSignature,
  type TimeSignature,
  timeSignatureWidth,
  validateTimeSignature,
} from "../components/music/time-signature.ts";

export type NotationDuration = Duration;
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
  noteStart?: number;
  firstNoteX?: number;
  spacing?: "rhythmic" | "equal";
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

const noteHeadHalfWidth = 6.5;
const accidentalNoteGap = 4;

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
    spacing = "rhythmic",
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
  const clefY = clef === "bass" ? 37 : 55;
  const { accidentalStart, timeStart, repeatStartX, prefixEnd } =
    prefixGeometry(clef, accidentals, timeSignature, repeatStart);
  const timeWidth = timeSignature ? timeSignatureWidth(timeSignature) : 0;
  const noteInset =
    firstNoteX ??
    Math.max(
      noteStart,
      prefixEnd + (timeSignature || accidentals.length ? 10 : 0),
    );
  const repeatEndInset = repeatEnd ? 16 : 0;
  const rhythmic =
    spacing === "rhythmic" ? rhythmicPositions(notes) : undefined;
  const notePosition = (index: number) => {
    const wholeMeasureRest =
      notes.length === 1 &&
      notes[0].type === "rest" &&
      notes[0].duration === "whole" &&
      !notes[0].dotted;
    const centered =
      wholeMeasureRest || (firstNoteX === undefined && notes.length === 1);
    const start = firstNoteX === undefined ? 1 / (notes.length + 1) : 0;
    const fraction = centered
      ? 0.5
      : rhythmic
        ? start + (1 - start) * rhythmic[index]
        : firstNoteX === undefined
          ? (index + 1) / (notes.length + 1)
          : index / notes.length;
    return {
      percent: `${fraction * 100}%`,
      fraction,
      offset: noteInset * (1 - fraction) - repeatEndInset * fraction,
    };
  };
  const beamStemEnds = new Map<number, number>();
  const beamStemDirections = new Map<number, boolean>();
  groups.forEach((group) => {
    const steps = group.indices.map((index) => pitchedNote(index).step);
    const stemUp =
      steps.reduce((sum, step) => sum + step, 0) / steps.length < 4;
    const firstIndex = group.indices[0];
    const lastIndex = group.indices[group.indices.length - 1];
    const firstY =
      64 - pitchedNote(firstIndex).step * 4.5 + (stemUp ? -31.5 : 31.5);
    const lastY =
      64 - pitchedNote(lastIndex).step * 4.5 + (stemUp ? -31.5 : 31.5);
    const firstFraction = notePosition(firstIndex).fraction;
    const lastFraction = notePosition(lastIndex).fraction;
    group.indices.forEach((index) => {
      const progress =
        (notePosition(index).fraction - firstFraction) /
        (lastFraction - firstFraction);
      beamStemEnds.set(index, firstY + (lastY - firstY) * progress);
      beamStemDirections.set(index, stemUp);
    });
  });
  const articulationPosition = (
    note: NotationNote,
    index: number,
  ): "above" | "below" => {
    const hasStem = note.duration
      ? note.duration !== "whole"
      : note.stem === true;
    const stemUp = beamStemDirections.get(index) ?? note.step < 4;
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
  notes.forEach((note, index) => {
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
      ? ` mit ${articulationSymbols[note.articulation].label}${articulationPosition(note, index) === "below" ? " unterhalb" : ""}`
      : "";
    description.push(`${name} auf Position ${note.step}${articulation}`);
  });

  const parts = [
    `<svg class="notation-staff" height="92" role="img" aria-label="${escapeXml(label ?? `${notes.length || accidentals.length ? "Notensystem" : "Leeres Notensystem"} mit fünf Linien${description.length ? `; ${description.join("; ")}` : ""}`)}" xmlns="http://www.w3.org/2000/svg">`,
    ...[28, 37, 46, 55, 64].map(
      (y) => `<line x1="0" y1="${y}" x2="100%" y2="${y}" />`,
    ),
  ];

  if (showLeftBar) parts.push(renderBarLine(0, 28, 64));
  if (showRightBar && rightBarStyle === "single" && !repeatEnd)
    parts.push(renderBarLine("100%", 28, 64));
  if (repeatEnd) {
    parts.push(renderRepeatEndAtBoundary(28, 64));
  }
  if (clefGlyph) parts.push(glyphText(clefGlyph, 6, clefY, "notation-clef"));
  if (repeatStart) {
    parts.push(renderRepeatStart(repeatStartX, 28, 64));
  }

  if (timeSignature) {
    const center = timeStart + timeWidth / 2;
    parts.push(
      renderTimeSignature(timeSignature, center, 37, 55, "notation-time"),
    );
  }

  accidentals.forEach(({ type, step }, index) => {
    parts.push(
      glyphText(
        accidentalSymbols[type].glyph,
        accidentalStart + index * 12,
        64 - step * 4.5,
        "notation-accidental",
      ),
    );
  });

  groups.forEach((group) => {
    const steps = group.indices.map((index) => pitchedNote(index).step);
    const stemUp =
      steps.reduce((sum, step) => sum + step, 0) / steps.length < 4;
    const first = notePosition(group.indices[0]);
    const last = notePosition(group.indices[group.indices.length - 1]);
    const stemOffset = stemUp ? 4.5 : -4.5;
    const firstNote = pitchedNote(group.indices[0]);
    const lastNote = pitchedNote(group.indices[group.indices.length - 1]);
    const firstBeamY = 64 - firstNote.step * 4.5 + (stemUp ? -31.5 : 31.5);
    const lastBeamY = 64 - lastNote.step * 4.5 + (stemUp ? -31.5 : 31.5);
    for (
      let beam = 0;
      beam < (group.duration === "sixteenth" ? 2 : 1);
      beam += 1
    ) {
      const beamOffset = beam * (stemUp ? 6 : -6);
      parts.push(
        renderBeam(
          `calc(${first.percent} + ${first.offset + stemOffset}px)`,
          firstBeamY + beamOffset,
          `calc(${last.percent} + ${last.offset + stemOffset}px)`,
          lastBeamY + beamOffset,
        ),
      );
    }
  });

  curves.forEach(({ from, to, placement, type }) => {
    const start = notePosition(from);
    const end = notePosition(to);
    const startNote = pitchedNote(from);
    const endNote = pitchedNote(to);
    const startY = 64 - startNote.step * 4.5;
    const endY = 64 - endNote.step * 4.5;
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
        `<g transform="translate(${position.offset} 0)">${renderRest(note.duration, position.percent, 46, note.dotted)}</g>`,
      );
      return;
    }
    const y = 64 - note.step * 4.5;
    const stemUp = beamStemDirections.get(index) ?? note.step < 4;
    const hasStem = note.duration
      ? note.duration !== "whole"
      : note.stem === true;
    const stemY = beamStemEnds.get(index) ?? y + (stemUp ? -31.5 : 31.5);
    const x = position.percent;
    if (note.step === -2 || note.step === 10) {
      parts.push(
        `<rect x="${x}" y="${y - 0.5}" width="18" height="1" transform="translate(${position.offset - 9} 0)" fill="currentColor" stroke="none" />`,
      );
    }
    if (hasStem) {
      const stemOffset = position.offset + (stemUp ? 4.5 : -4.5);
      parts.push(renderStem(x, y, stemY, stemOffset));
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
        `<g transform="translate(${stemUp ? 4.5 : -4.5} 0)">${glyphText(flag, x, stemY, "notation-note")}</g>`,
      );
    }
    parts.push(glyphText(noteGlyph, x, y, "notation-note", "middle"));
    if (note.dotted) parts.push(renderDot(x, y - 3, noteHeadHalfWidth + 3));
    if (note.accidental) {
      const accidentalOffset = noteHeadHalfWidth + accidentalNoteGap;
      parts.push(
        `<g transform="translate(${-accidentalOffset} 0)">${glyphText(accidentalSymbols[note.accidental].glyph, x, y, "notation-accidental", "end")}</g>`,
      );
    }
    if (note.articulation) {
      const position = articulationPosition(note, index);
      const noteEdgeY = y + (position === "below" ? 4.5 : -4.5);
      parts.push(
        renderArticulation(
          note.articulation,
          position,
          x,
          articulationY(noteEdgeY, position),
          "notation-articulation",
        ),
      );
    }
    parts.push("</g>");
  });

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
