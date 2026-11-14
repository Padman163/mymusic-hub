import {
  defaultFirstNoteX,
  type NotationClef,
  type NotationEvent,
  type NotationNote,
  type NotationRenderOptions,
  renderNotationSvg,
  SPATIUM,
  sp,
} from "./notation-renderer.ts";
import { type Duration, durationLabels } from "./rhythm.ts";
import { escapeXml } from "./svg.ts";

export const MIN_NOTATION_STEP = -2;
export const MAX_NOTATION_STEP = 10;
export const DEFAULT_NOTATION_STEP = 4;

export const BUILDER_STAFF_BOTTOM = 64;
export const BUILDER_SVG_HEIGHT = 92;
export const BUILDER_NOTE_WIDTH = sp(1.35);
export const BUILDER_NOTE_HEIGHT = sp(1.0);
const CURSOR_PAD = 2;
export const BUILDER_LEDGER_OVERHANG = sp(0.5);

export const DEFAULT_BUILDER_DURATIONS: Duration[] = [
  "whole",
  "half",
  "quarter",
  "eighth",
  "sixteenth",
];

export const DURATION_GLYPHS: Record<Duration, string> = {
  whole: "\uE1D2",
  half: "\uE1D3",
  quarter: "\uE1D5",
  eighth: "\uE1D7",
  sixteenth: "\uE1D9",
};

export const DURATION_SHORT_NAMES: Record<Duration, string> = {
  whole: "Ganze",
  half: "Halbe",
  quarter: "Viertel",
  eighth: "Achtel",
  sixteenth: "16tel",
};

export interface DurationSvgDefinition {
  d: string;
  viewBox: string;
}

export const DURATION_SVG_DATA: Record<Duration, DurationSvgDefinition> = {
  whole: {
    d: "M0 1c0 74 90 135 235 135c101 0 224 -58 224 -135c0 -76 -57 -138 -235 -138c-162 0 -224 65 -224 138zM117 41c0 -70 69 -153 141 -153c49 0 83 22 83 77c0 66 -60 146 -134 146c-51 0 -90 -14 -90 -70z",
    viewBox: "0 -875 460 1020",
  },
  half: {
    d: "M112 -145c-63 0 -112 35 -112 96c0 60 54 194 227 194c35 0 64 -10 84 -27v757h30v-827c0 -39 -39 -193 -229 -193zM34 -51c0 -28 26 -49 53 -49c25 0 61 12 113 47c81 53 105 81 105 104c0 26 -24 46 -49 46c-55 0 -222 -91 -222 -148z",
    viewBox: "0 -875 255 1020",
  },
  quarter: {
    d: "M109 -141c-61 0 -109 35 -109 94c0 97 99 188 222 188c33 0 61 -9 80 -26v760h30v-828c0 -95 -123 -188 -223 -188z",
    viewBox: "0 -875 250 1020",
  },
  eighth: {
    d: "M0 -44c0 97 99 188 222 188c33 0 61 -9 80 -26v746c1 7 5 9 10 9c19 0 27 -6 30 -22c16 -96 58 -178 109 -257c63 -100 115 -218 115 -343c0 -78 -26 -173 -26 -173c-5 -17 -17 -21 -26 -20l-2 1c-6 4 -16 13 -16 29c0 4 1 9 3 15c17 45 24 92 24 137c0 59 -9 116 -24 150c-31 73 -105 183 -167 221v-561c0 -95 -123 -188 -223 -188c-61 0 -109 35 -109 94z",
    viewBox: "0 -875 455 1020",
  },
  sixteenth: {
    d: "M109 -138c-61 0 -109 35 -109 94c0 97 99 188 222 188c33 0 61 -9 80 -26v754s11 1 17 1s18 -2 20 -13c17 -106 73 -122 127 -180c72 -78 98 -106 108 -174c2 -12 3 -23 3 -36c0 -61 -22 -121 -25 -127c-1 -3 -1 -5 -1 -7c0 -4 1 -6 1 -9c18 -37 29 -78 29 -120v-22c0 -48 -3 -105 -7 -110c-6 -13 -13 -17 -20 -17c-14 0 -22 13 -22 26c0 3 0 5 1 9c5 30 8 60 8 89c0 52 -9 101 -32 149c-60 122 -122 139 -177 143v-424c0 -95 -123 -188 -223 -188zM342 644c0 -1 0 -2 1 -3c21 -82 67 -106 114 -160c21 -24 38 -44 54 -69c2 -3 4 -4 7 -4c5 0 12 3 13 6c5 8 5 18 7 26c1 7 1 13 1 20c0 32 -9 63 -27 89c-33 49 -87 105 -148 105h-8c-8 0 -14 -6 -14 -10z",
    viewBox: "0 -875 470 1020",
  },
};

export const TREBLE_STEP_PITCHES: Record<number, string> = {
  [-2]: "C4",
  [-1]: "D4",
  0: "E4",
  1: "F4",
  2: "G4",
  3: "A4",
  4: "B4",
  5: "C5",
  6: "D5",
  7: "E5",
  8: "F5",
  9: "G5",
  10: "A5",
};

export const BASS_STEP_PITCHES: Record<number, string> = {
  [-2]: "E2",
  [-1]: "F2",
  0: "G2",
  1: "A2",
  2: "B2",
  3: "C3",
  4: "D3",
  5: "E3",
  6: "F3",
  7: "G3",
  8: "A3",
  9: "B3",
  10: "C4",
};

export interface NotationBuilderConfig
  extends Omit<NotationRenderOptions, "clef" | "notes"> {
  clef?: NotationClef | false;
  notes?: NotationEvent[];
  initialStep?: number;
  initialDuration?: Duration;
  allowedDurations?: Duration[];
  showDurationPicker?: boolean;
  /** Beschriftung (Note / Aktion) direkt am markierten Bereich. */
  showLabel?: boolean;
  /** Kompakter Darstellungsmodus ("tight" / true = ultraschmal wie im Builder, "wide" = lockere Taktbreite). */
  compact?: boolean | "tight" | "wide";
  /** Maximale Anzahl an Noten / Slots im Takt (Standard: 1). */
  maxNotes?: number;
  /** Fester Notenwert (z.B. "quarter" oder true). Blockiert das Ändern des Notenwerts via Num 1 / Toolbar. */
  lockDuration?: Duration | boolean;
}

export interface NotationBuilderStateSummary {
  cursorStep: number;
  currentNote: string;
  placedStep: number | null;
  placedNoteName: string | null;
  placedDuration: Duration | null;
  activeDuration: Duration;
  isOnPlacedNote: boolean;
  canCreate: boolean;
  canDelete: boolean;
  badgeText: string;
  statusText: string;
  activeSlot?: number;
  maxNotes?: number;
  placedNotes?: (NotationNote | null)[];
  placedSteps?: (number | null)[];
  placedNoteNames?: (string | null)[];
  isComplete?: boolean;
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return DEFAULT_NOTATION_STEP;
  return Math.max(
    MIN_NOTATION_STEP,
    Math.min(MAX_NOTATION_STEP, Math.round(step)),
  );
}

export function moveStep(step: number, delta: number): number {
  return clampStep(clampStep(step) + delta);
}

export function stepToY(step: number): number {
  return BUILDER_STAFF_BOTTOM - clampStep(step) * sp(0.5);
}

export function yToStep(y: number): number {
  return clampStep(Math.round((BUILDER_STAFF_BOTTOM - y) / sp(0.5)));
}

export function stepToPitchName(
  step: number,
  clef: NotationClef | false | undefined = "treble",
): string {
  const clamped = clampStep(step);
  const table = clef === "bass" ? BASS_STEP_PITCHES : TREBLE_STEP_PITCHES;
  return table[clamped];
}

export function pitchNameToStep(
  pitch: string,
  clef: NotationClef | false | undefined = "treble",
): number | undefined {
  const normalized = pitch.trim().toUpperCase();
  const table = clef === "bass" ? BASS_STEP_PITCHES : TREBLE_STEP_PITCHES;
  for (const [stepKey, name] of Object.entries(table)) {
    if (name.toUpperCase() === normalized) {
      return Number(stepKey);
    }
  }
  return undefined;
}

export function computeBuilderFirstNoteX(
  options: Omit<NotationBuilderConfig, "initialStep">,
): number {
  if (options.firstNoteX !== undefined) return options.firstNoteX;
  const clef = options.clef || undefined;
  const base = defaultFirstNoteX({
    ...options,
    clef,
    notes: [{ duration: "quarter", step: MAX_NOTATION_STEP }],
  });
  const withCurrent =
    options.notes && options.notes.length > 0
      ? defaultFirstNoteX({
          ...options,
          clef,
          notes: options.notes,
        })
      : base;
  return Math.max(base, withCurrent);
}

export function computeSlotXs(options: {
  maxNotes: number;
  width: number;
  noteInset: number;
  endInset?: number;
}): number[] {
  const { maxNotes, width, noteInset, endInset = 0 } = options;
  if (maxNotes <= 1) return [noteInset];
  const availableWidth = width - noteInset - endInset;
  return Array.from({ length: maxNotes }, (_, i) => {
    const fraction = i / maxNotes;
    return Math.round(noteInset + fraction * availableWidth);
  });
}

export function describeBuilderState(options: {
  cursorStep: number;
  placedNote?: NotationNote | null;
  placedNotes?: (NotationNote | null)[];
  activeSlot?: number;
  maxNotes?: number;
  clef?: NotationClef | false;
  activeDuration?: Duration;
}): NotationBuilderStateSummary {
  const maxNotes = Math.max(
    1,
    options.maxNotes ?? (options.placedNotes ? options.placedNotes.length : 1),
  );
  const activeSlot = Math.max(
    0,
    Math.min(maxNotes - 1, options.activeSlot ?? 0),
  );
  const placedNotes =
    options.placedNotes ??
    (options.placedNote !== undefined
      ? [options.placedNote]
      : Array.from({ length: maxNotes }, () => null));
  const currentPlaced = placedNotes[activeSlot] ?? options.placedNote ?? null;

  const cursorStep = clampStep(options.cursorStep);
  const currentNote = stepToPitchName(cursorStep, options.clef);
  const placedStep = currentPlaced ? clampStep(currentPlaced.step) : null;
  const placedNoteName =
    placedStep !== null ? stepToPitchName(placedStep, options.clef) : null;
  const isOnPlacedNote = placedStep !== null && placedStep === cursorStep;
  const canDelete = placedStep !== null;
  const canCreate = !isOnPlacedNote;

  const activeDuration =
    options.activeDuration ?? currentPlaced?.duration ?? "quarter";
  const durationLabel = durationLabels[activeDuration] ?? "Viertelnote";
  const placedDurationLabel = currentPlaced?.duration
    ? (durationLabels[currentPlaced.duration] ?? "Note")
    : durationLabel;

  const placedSteps = placedNotes.map((pn) => (pn ? clampStep(pn.step) : null));
  const placedNoteNames = placedNotes.map((pn) =>
    pn ? stepToPitchName(pn.step, options.clef) : null,
  );
  const isComplete =
    placedNotes.length === maxNotes && placedNotes.every((pn) => pn !== null);

  let badgeText: string;
  let statusText: string;

  const slotPrefix = maxNotes > 1 ? `Pos. ${activeSlot + 1}/${maxNotes}: ` : "";

  if (isOnPlacedNote) {
    badgeText = `${slotPrefix}${currentNote} · Löschen (Entf)`;
    statusText = `${slotPrefix}Note ${currentNote} (Step ${cursorStep}) – ${placedDurationLabel} ${currentNote} löschen (Entf)`;
  } else if (placedNoteName !== null) {
    badgeText = `${slotPrefix}${currentNote} · Setzen (Leertaste) | ${placedNoteName} löschen (Entf)`;
    statusText = `${slotPrefix}Note ${currentNote} (Step ${cursorStep}) – ${durationLabel} ${currentNote} setzen (Leertaste) oder ${placedDurationLabel} ${placedNoteName} löschen (Entf)`;
  } else {
    badgeText = `${slotPrefix}${currentNote} · ${durationLabel} setzen (Leertaste)`;
    statusText = `${slotPrefix}Note ${currentNote} (Step ${cursorStep}) – ${durationLabel} ${currentNote} setzen (Leertaste)`;
  }

  return {
    cursorStep,
    currentNote,
    placedStep,
    placedNoteName,
    placedDuration: currentPlaced?.duration ?? null,
    activeDuration,
    isOnPlacedNote,
    canCreate,
    canDelete,
    badgeText,
    statusText,
    activeSlot,
    maxNotes,
    placedNotes,
    placedSteps,
    placedNoteNames,
    isComplete,
  };
}

export function renderNotationBuilderSvg(options: {
  config: NotationBuilderConfig;
  cursorStep: number;
  placedNote?: NotationNote | null;
  placedNotes?: (NotationNote | null)[];
  activeSlot?: number;
}): string {
  const { config } = options;
  const maxNotes = Math.max(
    1,
    config.maxNotes ?? (options.placedNotes ? options.placedNotes.length : 1),
  );
  const activeSlot = Math.max(
    0,
    Math.min(maxNotes - 1, options.activeSlot ?? 0),
  );
  const placedNotes: (NotationNote | null)[] =
    options.placedNotes ??
    (options.placedNote !== undefined
      ? [options.placedNote]
      : Array.from({ length: maxNotes }, () => null));

  const currentPlacedNote =
    placedNotes[activeSlot] ?? options.placedNote ?? null;
  const cursorStep = clampStep(options.cursorStep);
  const clef = config.clef === false ? undefined : (config.clef ?? "treble");

  let notes: NotationEvent[];
  if (maxNotes <= 1) {
    notes = currentPlacedNote ? [currentPlacedNote] : [];
  } else {
    const slotDuration: Duration =
      typeof config.lockDuration === "string"
        ? config.lockDuration
        : (config.initialDuration ?? "quarter");
    notes = Array.from({ length: maxNotes }, (_, i) => {
      const pn = placedNotes[i];
      return pn ? pn : { type: "rest", duration: slotDuration, hidden: true };
    });
  }

  const firstNoteX = computeBuilderFirstNoteX({
    ...config,
    notes,
  });

  const baseSvg = renderNotationSvg({
    ...config,
    clef,
    notes,
    firstNoteX,
    showLeftBar: config.showLeftBar ?? false,
    showRightBar: config.showRightBar ?? false,
    rightBarStyle: config.rightBarStyle ?? "single",
  });

  const state = describeBuilderState({
    cursorStep,
    placedNotes,
    activeSlot,
    maxNotes,
    clef: config.clef ?? "treble",
  });

  let svg = baseSvg;
  const isCompactTight = config.compact === true || config.compact === "tight";
  const isCompactWide = config.compact === "wide";
  const showLabel = config.showLabel ?? false;
  const labelWidth = Math.max(120, state.badgeText.length * 6.4 + 16);
  const labelOffsetX = BUILDER_NOTE_WIDTH / 2 + 10;

  const minWidthMatch = baseSvg.match(/min-width:([\d.]+)px/);
  const existingMinWidth = minWidthMatch ? Number(minWidthMatch[1]) : 0;
  let finalWidth = existingMinWidth;

  if (isCompactTight) {
    const compactWidth = Math.max(
      150,
      Math.ceil(firstNoteX + BUILDER_NOTE_WIDTH / 2 + sp(1.5)),
    );
    finalWidth = compactWidth;
    svg = svg
      .replace(
        /min-width:[\d.]+px/,
        `min-width:${compactWidth}px;width:${compactWidth}px`,
      )
      .replace(
        /<svg class="notation-staff"/,
        `<svg class="notation-staff" width="${compactWidth}"`,
      );
  } else if (isCompactWide) {
    const compactWidth = Math.max(300, existingMinWidth);
    finalWidth = compactWidth;
    svg = svg
      .replace(
        /min-width:[\d.]+px/,
        `min-width:${compactWidth}px;width:${compactWidth}px`,
      )
      .replace(
        /<svg class="notation-staff"/,
        `<svg class="notation-staff" width="${compactWidth}"`,
      );
  } else if (showLabel) {
    const requiredMinWidth = Math.max(
      existingMinWidth,
      Math.ceil(firstNoteX + labelOffsetX + labelWidth + SPATIUM),
    );
    finalWidth = requiredMinWidth;
    svg = svg.replace(/min-width:[\d.]+px/, `min-width:${requiredMinWidth}px`);
  }

  const repeatEndInset = config.repeatEnd ? 16 : 0;
  const endingMarkInset = config.repeatEnd
    ? repeatEndInset
    : config.showRightBar && config.rightBarStyle === "final"
      ? 8
      : 0;

  const slotXs = computeSlotXs({
    maxNotes,
    width: finalWidth || 300,
    noteInset: firstNoteX,
    endInset: endingMarkInset,
  });

  const cursorX = slotXs[activeSlot] ?? firstNoteX;
  const cursorY = stepToY(cursorStep);
  const needsCursorLedger =
    (cursorStep === MIN_NOTATION_STEP || cursorStep === MAX_NOTATION_STEP) &&
    !state.isOnPlacedNote;
  const ledgerHtml = needsCursorLedger
    ? `<line class="notation-builder-cursor-ledger" x1="${-(BUILDER_NOTE_WIDTH / 2 + BUILDER_LEDGER_OVERHANG)}" y1="0" x2="${BUILDER_NOTE_WIDTH / 2 + BUILDER_LEDGER_OVERHANG}" y2="0" />`
    : "";

  const overlay = [
    `<g class="notation-builder-overlay">`,
    `<g class="notation-builder-cursor" data-cursor-step="${cursorStep}" data-cursor-note="${escapeXml(state.currentNote)}" data-on-note="${state.isOnPlacedNote}" data-active-slot="${activeSlot}" data-max-notes="${maxNotes}" transform="translate(${cursorX} ${cursorY})">`,
    ledgerHtml,
    `<rect class="notation-builder-cursor-head" x="${-BUILDER_NOTE_WIDTH / 2 - CURSOR_PAD}" y="${-BUILDER_NOTE_HEIGHT / 2 - CURSOR_PAD}" width="${BUILDER_NOTE_WIDTH + 2 * CURSOR_PAD}" height="${BUILDER_NOTE_HEIGHT + 2 * CURSOR_PAD}" rx="4" ry="4" />`,
    showLabel
      ? [
          `<g class="notation-builder-cursor-label" transform="translate(${labelOffsetX} 0)">`,
          `<rect class="notation-builder-cursor-pill" x="0" y="-10" width="${labelWidth}" height="20" rx="4" />`,
          `<text class="notation-builder-cursor-text" x="8" y="0" dominant-baseline="central">${escapeXml(state.badgeText)}</text>`,
          `</g>`,
        ].join("")
      : "",
    `</g>`,
    `</g>`,
  ].join("");

  return svg.replace("</svg>", `${overlay}</svg>`);
}

function extractInitialPlacedNote(
  notes: readonly NotationEvent[] | undefined,
): NotationNote | null {
  if (!notes || notes.length === 0) return null;
  const first = notes[0];
  if (first.type === "rest") return null;
  return first;
}

export function attachNotationBuilder(root: HTMLElement): void {
  if (root.dataset.builderInitialized === "true") return;
  root.dataset.builderInitialized = "true";

  const rawConfig = root.dataset.builderConfig;
  if (!rawConfig) return;
  const config = JSON.parse(rawConfig) as NotationBuilderConfig;
  const stage = root.querySelector<HTMLElement>(".notation-builder-stage");
  const statusNote = root.querySelector<HTMLElement>(
    ".notation-builder-status-note",
  );
  const statusAction = root.querySelector<HTMLElement>(
    ".notation-builder-status-action",
  );
  if (!stage) return;

  const maxNotes = Math.max(1, config.maxNotes ?? 1);
  const lockedDuration: Duration | undefined =
    typeof config.lockDuration === "string"
      ? config.lockDuration
      : config.lockDuration === true
        ? (config.initialDuration ?? "quarter")
        : undefined;

  let activeSlot = 0;
  let cursorStep = clampStep(config.initialStep ?? DEFAULT_NOTATION_STEP);
  let placedNotes: (NotationNote | null)[] = Array.from(
    { length: maxNotes },
    (_, i) => {
      const ev = config.notes?.[i];
      return ev && ev.type !== "rest" ? ev : null;
    },
  );
  if (maxNotes === 1 && config.notes && config.notes.length > 0) {
    placedNotes[0] = extractInitialPlacedNote(config.notes);
  }

  let activeDuration: Duration =
    lockedDuration ??
    config.initialDuration ??
    (placedNotes[0]?.duration ?? "quarter");

  const syncDom = (emitChange = false) => {
    const state = describeBuilderState({
      cursorStep,
      placedNotes,
      activeSlot,
      maxNotes,
      clef: config.clef ?? "treble",
      activeDuration,
    });

    stage.innerHTML = renderNotationBuilderSvg({
      config,
      cursorStep,
      placedNotes,
      activeSlot,
    });

    root.dataset.cursorStep = String(state.cursorStep);
    root.dataset.cursorNote = state.currentNote;
    root.dataset.canCreate = String(state.canCreate);
    root.dataset.canDelete = String(state.canDelete);
    root.dataset.activeDuration = activeDuration;
    root.dataset.activeSlot = String(activeSlot);
    root.dataset.maxNotes = String(maxNotes);
    root.dataset.placedCount = String(placedNotes.filter(Boolean).length);
    root.dataset.placedSteps = JSON.stringify(
      placedNotes.map((n) => (n ? n.step : null)),
    );
    root.dataset.placedNotes = JSON.stringify(
      placedNotes.map((n) =>
        n ? stepToPitchName(n.step, config.clef ?? "treble") : null,
      ),
    );

    const currentPlaced = placedNotes[activeSlot];
    if (currentPlaced && state.placedStep !== null && state.placedNoteName) {
      root.dataset.placedStep = String(state.placedStep);
      root.dataset.placedNote = state.placedNoteName;
      root.dataset.placedDuration = currentPlaced.duration ?? activeDuration;
    } else {
      delete root.dataset.placedStep;
      delete root.dataset.placedNote;
      delete root.dataset.placedDuration;
    }

    const currentDuration = currentPlaced?.duration ?? activeDuration;
    root
      .querySelectorAll<HTMLButtonElement>(".notation-builder-duration-btn")
      .forEach((btn) => {
        const isSelected = btn.dataset.duration === currentDuration;
        btn.classList.toggle("is-active", isSelected);
        btn.setAttribute("aria-pressed", String(isSelected));
      });

    if (statusNote) {
      const posText =
        maxNotes > 1 ? ` (Position ${activeSlot + 1}/${maxNotes})` : "";
      statusNote.textContent = `Aktuelle Note: ${state.currentNote}${posText}`;
    }
    if (statusAction) {
      const durationName = durationLabels[activeDuration] ?? "Viertelnote";
      const placedDurName = currentPlaced?.duration
        ? (durationLabels[currentPlaced.duration] ?? durationName)
        : durationName;
      statusAction.textContent = state.isOnPlacedNote
        ? `${placedDurName} ${state.currentNote} löschen (Entf)`
        : state.placedNoteName
          ? `${durationName} ${state.currentNote} erstellen (Leertaste) · ${placedDurName} ${state.placedNoteName} löschen (Entf)`
          : `${durationName} ${state.currentNote} erstellen (Leertaste)`;
    }

    if (emitChange) {
      root.dispatchEvent(
        new CustomEvent("notationbuilder:change", {
          bubbles: true,
          detail: state,
        }),
      );
    }
  };

  root
    .querySelectorAll<HTMLButtonElement>(".notation-builder-duration-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (root.dataset.locked === "true") return;
        if (lockedDuration || config.lockDuration) return;
        root.focus({ preventScroll: true });
        const dur = btn.dataset.duration as Duration | undefined;
        if (!dur) return;
        activeDuration = dur;
        if (placedNotes[activeSlot] !== null) {
          const current = placedNotes[activeSlot]!;
          placedNotes[activeSlot] = {
            step: current.step,
            duration: dur,
            ...(current.accidental ? { accidental: current.accidental } : {}),
          };
        } else {
          placedNotes[activeSlot] = { duration: dur, step: cursorStep };
        }
        syncDom(true);
      });
    });

  const resolveTargetFromEvent = (
    event: MouseEvent,
  ): { step: number; slot: number } | undefined => {
    const svg = stage.querySelector<SVGSVGElement>("svg.notation-staff");
    if (!svg) return undefined;
    const rect = svg.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) return undefined;
    const svgY =
      ((event.clientY - rect.top) / rect.height) * BUILDER_SVG_HEIGHT;
    const step = yToStep(svgY);

    if (maxNotes <= 1) {
      return { step, slot: 0 };
    }

    const firstNoteX = computeBuilderFirstNoteX({ ...config, notes: [] });
    const repeatEndInset = config.repeatEnd ? 16 : 0;
    const endingMarkInset = config.repeatEnd
      ? repeatEndInset
      : config.showRightBar && config.rightBarStyle === "final"
        ? 8
        : 0;
    const isCompactWide = config.compact === "wide";
    const minWidthMatch = svg
      .getAttribute("style")
      ?.match(/min-width:([\d.]+)px/);
    const existingMinWidth = minWidthMatch ? Number(minWidthMatch[1]) : 0;
    const effectiveWidth = isCompactWide
      ? Math.max(300, existingMinWidth)
      : (rect.width || 300);

    const slotXs = computeSlotXs({
      maxNotes,
      width: effectiveWidth,
      noteInset: firstNoteX,
      endInset: endingMarkInset,
    });

    const svgX = ((event.clientX - rect.left) / rect.width) * effectiveWidth;
    let closestSlot = 0;
    let minDiff = Infinity;
    slotXs.forEach((sx, idx) => {
      const diff = Math.abs(svgX - sx);
      if (diff < minDiff) {
        minDiff = diff;
        closestSlot = idx;
      }
    });

    return { step, slot: closestSlot };
  };

  stage.addEventListener("click", (event) => {
    if (root.dataset.locked === "true") return;
    root.focus({ preventScroll: true });
    const target = resolveTargetFromEvent(event);
    if (target !== undefined) {
      cursorStep = target.step;
      if (maxNotes > 1) {
        activeSlot = target.slot;
        if (placedNotes[activeSlot]) {
          cursorStep = placedNotes[activeSlot]!.step;
        }
      }
      syncDom(true);
    }
  });

  root.addEventListener("keydown", (event) => {
    if (root.dataset.locked === "true") return;
    if (event.key === "ArrowLeft") {
      if (maxNotes > 1) {
        event.preventDefault();
        if (activeSlot > 0) {
          activeSlot -= 1;
          if (placedNotes[activeSlot]) {
            cursorStep = placedNotes[activeSlot]!.step;
          }
          syncDom(true);
        }
      }
      return;
    }
    if (event.key === "ArrowRight") {
      if (maxNotes > 1) {
        event.preventDefault();
        if (activeSlot < maxNotes - 1) {
          activeSlot += 1;
          if (placedNotes[activeSlot]) {
            cursorStep = placedNotes[activeSlot]!.step;
          }
          syncDom(true);
        }
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      cursorStep = moveStep(cursorStep, 1);
      syncDom(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      cursorStep = moveStep(cursorStep, -1);
      syncDom(true);
      return;
    }
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      placedNotes[activeSlot] = { duration: activeDuration, step: cursorStep };
      if (maxNotes > 1 && activeSlot < maxNotes - 1) {
        activeSlot += 1;
        if (placedNotes[activeSlot]) {
          cursorStep = placedNotes[activeSlot]!.step;
        }
      }
      syncDom(true);
      return;
    }
    if (event.code === "Numpad1" || event.key === "1") {
      event.preventDefault();
      if (lockedDuration || config.lockDuration) return;
      const durations = config.allowedDurations ?? DEFAULT_BUILDER_DURATIONS;
      if (durations.length > 0) {
        const currentDur = placedNotes[activeSlot]?.duration ?? activeDuration;
        const currentIndex = durations.indexOf(currentDur);
        const nextIndex =
          currentIndex >= 0 ? (currentIndex + 1) % durations.length : 0;
        activeDuration = durations[nextIndex];
        if (placedNotes[activeSlot] !== null) {
          const current = placedNotes[activeSlot]!;
          placedNotes[activeSlot] = {
            step: current.step,
            duration: activeDuration,
            ...(current.accidental ? { accidental: current.accidental } : {}),
          };
        }
        syncDom(true);
      }
      return;
    }
    if (
      event.key === "Delete" ||
      event.code === "Delete" ||
      event.key === "Backspace"
    ) {
      event.preventDefault();
      if (placedNotes[activeSlot] !== null) {
        placedNotes[activeSlot] = null;
        syncDom(true);
      }
      return;
    }
    if (
      event.key === "Enter" ||
      event.code === "Enter" ||
      event.code === "NumpadEnter"
    ) {
      event.preventDefault();
      event.stopPropagation();
      root.dispatchEvent(
        new CustomEvent("notationbuilder:submit", {
          bubbles: true,
          detail: {
            steps: placedNotes.map((n) => n?.step ?? null),
            notes: placedNotes.map((n) =>
              n ? stepToPitchName(n.step, config.clef ?? "treble") : null,
            ),
            durations: placedNotes.map((n) => n?.duration ?? null),
          },
        }),
      );
      return;
    }
  });

  root.addEventListener("notationbuilder:reset", (event) => {
    delete root.dataset.locked;
    const detail =
      event instanceof CustomEvent ? event.detail : undefined;
    const stepVal =
      typeof detail?.step === "number"
        ? detail.step
        : typeof detail === "number"
          ? detail
          : (config.initialStep ?? DEFAULT_NOTATION_STEP);
    cursorStep = clampStep(stepVal);
    activeSlot = 0;
    placedNotes = Array.from({ length: maxNotes }, () => null);
    if (lockedDuration) {
      activeDuration = lockedDuration;
    } else if (detail?.duration) {
      activeDuration = detail.duration;
    } else if (config.initialDuration) {
      activeDuration = config.initialDuration;
    }
    syncDom(false);
  });

  root.addEventListener("notationbuilder:set-duration", (event) => {
    if (lockedDuration || config.lockDuration) return;
    if (event instanceof CustomEvent && event.detail?.duration) {
      activeDuration = event.detail.duration as Duration;
      if (placedNotes[activeSlot] !== null) {
        const current = placedNotes[activeSlot]!;
        placedNotes[activeSlot] = {
          step: current.step,
          duration: activeDuration,
          ...(current.accidental ? { accidental: current.accidental } : {}),
        };
      }
      syncDom(true);
    }
  });

  syncDom(false);
}

export function setupNotationBuilders(): void {
  document
    .querySelectorAll<HTMLElement>("[data-notation-builder]")
    .forEach(attachNotationBuilder);
}
