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
  /** Beschriftung (Note / Aktion) direkt am markierten Bereich. */
  showLabel?: boolean;
  /** Kompakter Darstellungsmodus ("tight" / true = ultraschmal wie im Builder, "wide" = lockere Taktbreite). */
  compact?: boolean | "tight" | "wide";
}

export interface NotationBuilderStateSummary {
  cursorStep: number;
  currentNote: string;
  placedStep: number | null;
  placedNoteName: string | null;
  isOnPlacedNote: boolean;
  canCreate: boolean;
  canDelete: boolean;
  badgeText: string;
  statusText: string;
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

export function describeBuilderState(options: {
  cursorStep: number;
  placedNote: NotationNote | null;
  clef?: NotationClef | false;
}): NotationBuilderStateSummary {
  const cursorStep = clampStep(options.cursorStep);
  const currentNote = stepToPitchName(cursorStep, options.clef);
  const placedStep = options.placedNote
    ? clampStep(options.placedNote.step)
    : null;
  const placedNoteName =
    placedStep !== null ? stepToPitchName(placedStep, options.clef) : null;
  const isOnPlacedNote = placedStep !== null && placedStep === cursorStep;
  const canDelete = placedStep !== null;
  const canCreate = !isOnPlacedNote;

  let badgeText: string;
  let statusText: string;

  if (isOnPlacedNote) {
    badgeText = `${currentNote} · Löschen (Entf)`;
    statusText = `Aktuelle Note: ${currentNote} (Step ${cursorStep}) – Viertelnote ${currentNote} löschen (Entf)`;
  } else if (placedNoteName !== null) {
    badgeText = `${currentNote} · Erstellen (Num 1) | ${placedNoteName} löschen (Entf)`;
    statusText = `Aktuelle Note: ${currentNote} (Step ${cursorStep}) – Viertelnote ${currentNote} erstellen (Num 1) oder Viertelnote ${placedNoteName} löschen (Entf)`;
  } else {
    badgeText = `${currentNote} · Viertelnote erstellen (Num 1)`;
    statusText = `Aktuelle Note: ${currentNote} (Step ${cursorStep}) – Viertelnote ${currentNote} erstellen (Num 1)`;
  }

  return {
    cursorStep,
    currentNote,
    placedStep,
    placedNoteName,
    isOnPlacedNote,
    canCreate,
    canDelete,
    badgeText,
    statusText,
  };
}

export function renderNotationBuilderSvg(options: {
  config: NotationBuilderConfig;
  cursorStep: number;
  placedNote: NotationNote | null;
}): string {
  const { config, placedNote } = options;
  const cursorStep = clampStep(options.cursorStep);
  const clef = config.clef === false ? undefined : (config.clef ?? "treble");
  const notes: NotationEvent[] = placedNote ? [placedNote] : [];
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
    placedNote,
    clef: config.clef ?? "treble",
  });

  const cursorY = stepToY(cursorStep);
  const needsCursorLedger =
    (cursorStep === MIN_NOTATION_STEP || cursorStep === MAX_NOTATION_STEP) &&
    !state.isOnPlacedNote;
  const ledgerHtml = needsCursorLedger
    ? `<line class="notation-builder-cursor-ledger" x1="${-(BUILDER_NOTE_WIDTH / 2 + BUILDER_LEDGER_OVERHANG)}" y1="0" x2="${BUILDER_NOTE_WIDTH / 2 + BUILDER_LEDGER_OVERHANG}" y2="0" />`
    : "";

  const showLabel = config.showLabel ?? false;
  const labelWidth = Math.max(120, state.badgeText.length * 6.4 + 16);
  const labelOffsetX = BUILDER_NOTE_WIDTH / 2 + 10;

  const overlay = [
    `<g class="notation-builder-overlay">`,
    `<g class="notation-builder-cursor" data-cursor-step="${cursorStep}" data-cursor-note="${escapeXml(state.currentNote)}" data-on-note="${state.isOnPlacedNote}" transform="translate(${firstNoteX} ${cursorY})">`,
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

  let svg = baseSvg;
  const isCompactTight = config.compact === true || config.compact === "tight";
  const isCompactWide = config.compact === "wide";

  if (isCompactTight) {
    const compactWidth = Math.ceil(
      firstNoteX + BUILDER_NOTE_WIDTH / 2 + sp(1.5),
    );
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
    const minWidthMatch = baseSvg.match(/min-width:([\d.]+)px/);
    const existingMinWidth = minWidthMatch ? Number(minWidthMatch[1]) : 0;
    const compactWidth = Math.max(300, existingMinWidth);
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
    const minWidthMatch = baseSvg.match(/min-width:([\d.]+)px/);
    const existingMinWidth = minWidthMatch ? Number(minWidthMatch[1]) : 0;
    const requiredMinWidth = Math.max(
      existingMinWidth,
      Math.ceil(firstNoteX + labelOffsetX + labelWidth + SPATIUM),
    );
    svg = svg.replace(/min-width:[\d.]+px/, `min-width:${requiredMinWidth}px`);
  }
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

  let cursorStep = clampStep(config.initialStep ?? DEFAULT_NOTATION_STEP);
  let placedNote: NotationNote | null = extractInitialPlacedNote(config.notes);

  const syncDom = (emitChange = false) => {
    const state = describeBuilderState({
      cursorStep,
      placedNote,
      clef: config.clef ?? "treble",
    });

    stage.innerHTML = renderNotationBuilderSvg({
      config,
      cursorStep,
      placedNote,
    });

    root.dataset.cursorStep = String(state.cursorStep);
    root.dataset.cursorNote = state.currentNote;
    root.dataset.canCreate = String(state.canCreate);
    root.dataset.canDelete = String(state.canDelete);
    if (placedNote && state.placedStep !== null && state.placedNoteName) {
      root.dataset.placedStep = String(state.placedStep);
      root.dataset.placedNote = state.placedNoteName;
      root.dataset.placedDuration = placedNote.duration ?? "quarter";
    } else {
      delete root.dataset.placedStep;
      delete root.dataset.placedNote;
      delete root.dataset.placedDuration;
    }

    if (statusNote) {
      statusNote.textContent = `Aktuelle Note: ${state.currentNote}`;
    }
    if (statusAction) {
      statusAction.textContent = state.isOnPlacedNote
        ? `Viertelnote ${state.currentNote} löschen (Entf)`
        : state.placedNoteName
          ? `Viertelnote ${state.currentNote} erstellen (Num 1) · ${state.placedNoteName} löschen (Entf)`
          : `Viertelnote ${state.currentNote} erstellen (Num 1)`;
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

  const resolveStepFromEvent = (event: MouseEvent): number | undefined => {
    const svg = stage.querySelector<SVGSVGElement>("svg.notation-staff");
    if (!svg) return undefined;
    const rect = svg.getBoundingClientRect();
    if (rect.height <= 0) return undefined;
    const svgY =
      ((event.clientY - rect.top) / rect.height) * BUILDER_SVG_HEIGHT;
    return yToStep(svgY);
  };

  stage.addEventListener("click", (event) => {
    root.focus({ preventScroll: true });
    const step = resolveStepFromEvent(event);
    if (step !== undefined) {
      cursorStep = step;
      syncDom(true);
    }
  });

  root.addEventListener("keydown", (event) => {
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
    if (event.code === "Numpad1" || event.key === "1") {
      event.preventDefault();
      placedNote = { duration: "quarter", step: cursorStep };
      syncDom(true);
      return;
    }
    if (
      event.key === "Delete" ||
      event.code === "Delete" ||
      event.key === "Backspace"
    ) {
      event.preventDefault();
      if (placedNote !== null) {
        placedNote = null;
        syncDom(true);
      }
    }
  });

  root.addEventListener("notationbuilder:reset", (event) => {
    const detail =
      event instanceof CustomEvent && typeof event.detail?.step === "number"
        ? event.detail.step
        : (config.initialStep ?? DEFAULT_NOTATION_STEP);
    cursorStep = clampStep(detail);
    placedNote = null;
    syncDom(false);
  });

  syncDom(false);
}

export function setupNotationBuilders(): void {
  document
    .querySelectorAll<HTMLElement>("[data-notation-builder]")
    .forEach(attachNotationBuilder);
}
