import { layoutNotationEvents } from "./notation-layout.ts";
import {
  assertNoClefChanges,
  defaultFirstNoteX,
  type NotationAccidental,
  type NotationClef,
  type NotationCurve,
  type NotationEvent,
  type NotationRenderOptions,
  sp,
} from "./notation-renderer.ts";
import { rhythmicPositions } from "./rhythm.ts";
import {
  omitUnchangedTimeSignatures,
  type TimeSignature,
  validateTimeSignature,
} from "./time-signature.ts";

export type MeasureWidthMode = "rhythmic" | "equal";
export type LayoutMode = "auto" | number | number[];

export const DEFAULT_MAX_SYSTEM_WIDTH = 600;

export interface SystemLayoutOptions {
  measureWidth?: MeasureWidthMode;
  maxSystemWidth?: number;
  scale?: number;
  stretchLastRow?: boolean;
}

export interface NotationMeasure {
  notes: NotationEvent[];
  clef?: NotationClef | false;
  timeSignature?: TimeSignature;
  layoutTimeSignature?: TimeSignature;
  accidentals?: NotationAccidental[];
  showLeftBar?: boolean;
  showRightBar?: boolean;
  rightBarStyle?: "single" | "final";
  repeatStart?: boolean;
  repeatEnd?: boolean;
  curves?: NotationCurve[];
  measureNumber?: string | number;
  tempo?: string;
  tempoDetail?: string;
  ritAt?: number;
  aTempoAt?: number;
  hairpin?: "crescendo" | "decrescendo";
  initialDynamic?: "piano" | "forte";
  spacing?: MeasureWidthMode | number;
  noteStart?: number;
  firstNoteX?: number;
}

export interface NotationBaseProps {
  clef?: NotationClef | false;
  timeSignature?: TimeSignature;
  accidentals?: NotationAccidental[];
  layout?: LayoutMode;
  measureWidth?: MeasureWidthMode;
  stretchLastRow?: boolean;
  scale?: number;
  scrollable?: boolean;
  title?: string;
  subtitle?: string;
  tempo?: string;
  tempoDetail?: string;
  showLeftBar?: boolean;
  showRightBar?: boolean;
  rightBarStyle?: "single" | "final";
  repeatStart?: boolean;
  repeatEnd?: boolean;
  curves?: NotationCurve[];
  measureNumber?: string | number;
  ritAt?: number;
  aTempoAt?: number;
  hairpin?: "crescendo" | "decrescendo";
  initialDynamic?: "piano" | "forte";
}

export type NotationProps =
  | (NotationBaseProps & {
      notes: NotationEvent[];
      measures?: never;
    })
  | (NotationBaseProps & {
      measures: NotationMeasure[];
      notes?: never;
    });

export type ArrangedNotationMeasure<T> = Omit<T, "clef" | "accidentals"> & {
  clef: NotationClef | false;
  accidentals?: NotationAccidental[];
  layoutTimeSignature?: TimeSignature;
  firstNoteX: number;
  minWidth: number;
  columnWeight: number;
  systemWidthRatio: number;
};

export interface NotationSystemRow<T = NotationMeasure> {
  measures: ArrangedNotationMeasure<T>[];
  columnWeights: number[];
  gridTemplateColumns: string;
  minWidth: number;
  widthRatio: number;
}

const NOTE_WIDTH = sp(1.35);
const LEDGER_OVERHANG = sp(0.5);
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
  const step = Number.isInteger(event.step) ? event.step : 2;
  const ledger = step === -2 || step === 10 ? LEDGER_OVERHANG : 0;
  const left =
    noteHeadHalfWidth +
    Math.max(ledger, event.accidental ? accidentalNoteGap + sp(1) : 0);
  const flagged =
    !event.beamGroup &&
    (event.duration === "eighth" || event.duration === "sixteenth") &&
    step < 4;
  const right = Math.max(
    noteHeadHalfWidth +
      Math.max(ledger, event.dotted ? sp(0.6) + 2 * dotRadius : 0),
    flagged ? noteHeadHalfWidth + sp(1.3) : 0,
  );
  return { left: left + sp(0.2), right: right + sp(0.2) };
}

export function estimateMeasureMinWidth(
  options: Pick<
    NotationRenderOptions,
    | "clef"
    | "notes"
    | "accidentals"
    | "timeSignature"
    | "layoutTimeSignature"
    | "noteStart"
    | "firstNoteX"
    | "showRightBar"
    | "rightBarStyle"
    | "repeatStart"
    | "repeatEnd"
  >,
): number {
  const {
    clef,
    notes = [],
    accidentals = [],
    timeSignature,
    layoutTimeSignature,
    firstNoteX,
    showRightBar = true,
    rightBarStyle = "single",
    repeatStart = false,
    repeatEnd = false,
  } = options;

  const repeatEndInset = repeatEnd ? 16 : 0;
  const lastNote = notes[notes.length - 1];
  const wholeMeasureRest =
    notes.length === 1 &&
    lastNote?.type === "rest" &&
    lastNote.duration === "whole" &&
    !lastNote.dotted;
  const noteInset =
    firstNoteX ??
    (wholeMeasureRest &&
    !clef &&
    !timeSignature &&
    !accidentals.length &&
    !repeatStart
      ? Math.max(options.noteStart ?? 0, 0)
      : defaultFirstNoteX(options));
  const endingMarkInset = repeatEnd
    ? repeatEndInset
    : showRightBar && rightBarStyle === "final"
      ? 8
      : 0;

  if (notes.length === 0) {
    return Math.ceil(noteInset + endingMarkInset + sp(2));
  }

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

  let minimumWidth = notes.reduce((minimum, note, index) => {
    if (index === 0) return minimum;
    const rawFraction =
      positions[index].fraction - positions[index - 1].fraction;
    const effectiveFraction =
      rawFraction < 0.25 ? Math.sqrt(rawFraction * 0.25) : rawFraction;
    const gap = rawFraction < 0.25 ? sp(0.4) : sp(1);
    const distance =
      eventExtents(notes[index - 1]).right + gap + eventExtents(note).left;
    return Math.max(
      minimum,
      noteInset + endInset + distance / effectiveFraction,
    );
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

  return Math.ceil(minimumWidth);
}

export function normalizeNotationInput(
  props: NotationProps,
): NotationMeasure[] {
  const defaultClef: NotationClef | false =
    props.clef !== undefined ? props.clef : "treble";
  const baseMeasures: readonly NotationMeasure[] =
    props.measures !== undefined
      ? props.measures
      : [
          {
            notes: props.notes,
            ...(props.showLeftBar !== undefined && {
              showLeftBar: props.showLeftBar,
            }),
            ...(props.showRightBar !== undefined && {
              showRightBar: props.showRightBar,
            }),
            ...(props.rightBarStyle !== undefined && {
              rightBarStyle: props.rightBarStyle,
            }),
            ...(props.repeatStart !== undefined && {
              repeatStart: props.repeatStart,
            }),
            ...(props.repeatEnd !== undefined && {
              repeatEnd: props.repeatEnd,
            }),
            ...(props.curves !== undefined && { curves: props.curves }),
            ...(props.measureNumber !== undefined && {
              measureNumber: props.measureNumber,
            }),
            ...(props.ritAt !== undefined && { ritAt: props.ritAt }),
            ...(props.aTempoAt !== undefined && { aTempoAt: props.aTempoAt }),
            ...(props.hairpin !== undefined && { hairpin: props.hairpin }),
            ...(props.initialDynamic !== undefined && {
              initialDynamic: props.initialDynamic,
            }),
          },
        ];

  if (baseMeasures.length === 0) return [];

  return baseMeasures.map((measure, index) => {
    if (index !== 0) return { ...measure };
    const clef = measure.clef !== undefined ? measure.clef : defaultClef;
    const timeSignature = measure.timeSignature ?? props.timeSignature;
    const accidentals = measure.accidentals ?? props.accidentals;
    return {
      ...measure,
      clef,
      ...(timeSignature !== undefined && { timeSignature }),
      ...(accidentals !== undefined && { accidentals }),
    };
  });
}

function resolveAutoSystemCounts<
  T extends {
    clef?: NotationClef | false;
    accidentals?: NotationAccidental[];
    timeSignature?: TimeSignature;
    layoutTimeSignature?: TimeSignature;
    notes?: NotationEvent[];
    noteStart?: number;
    showRightBar?: boolean;
    rightBarStyle?: "single" | "final";
    repeatStart?: boolean;
    repeatEnd?: boolean;
  },
>(
  measures: readonly T[],
  clef: NotationClef,
  maxSystemWidth: number,
  measureWidthMode: MeasureWidthMode = "rhythmic",
): number[] {
  const counts: number[] = [];
  let activeAccidentals: NotationAccidental[] = [];
  let activeTimeSignature: TimeSignature | undefined;
  let currentCount = 0;
  let currentWidth = 0;
  let currentMaxMeasureWidth = 0;

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    const nextTime = measure.timeSignature ?? measure.layoutTimeSignature;
    const effectiveTime = nextTime ?? activeTimeSignature;
    const nextAccidentals = measure.accidentals;
    const changedAccidentals =
      nextAccidentals !== undefined &&
      (nextAccidentals.length !== activeAccidentals.length ||
        nextAccidentals.some(
          (sign, idx) =>
            sign.type !== activeAccidentals[idx]?.type ||
            sign.step !== activeAccidentals[idx]?.step,
        ));
    const cancellations: NotationAccidental[] = changedAccidentals
      ? activeAccidentals
          .filter(
            (old) =>
              !nextAccidentals.some(
                (sign) =>
                  sign.type === old.type && (sign.step - old.step) % 7 === 0,
              ),
          )
          .map(({ step }) => ({ type: "natural", step }))
      : [];
    const nextActiveAccidentals = changedAccidentals
      ? nextAccidentals
      : activeAccidentals;

    if (currentCount === 0) {
      const startAccidentals = changedAccidentals
        ? [...cancellations, ...nextActiveAccidentals]
        : activeAccidentals;
      currentWidth = estimateMeasureMinWidth({
        ...measure,
        clef,
        accidentals: startAccidentals,
        layoutTimeSignature: effectiveTime,
      });
      currentMaxMeasureWidth = currentWidth;
      currentCount = 1;
    } else {
      const continuationAccidentals = changedAccidentals
        ? [...cancellations, ...nextActiveAccidentals]
        : undefined;
      const continuationWidth = estimateMeasureMinWidth({
        ...measure,
        clef: undefined,
        accidentals: continuationAccidentals,
        layoutTimeSignature: effectiveTime,
      });
      const nextCount = currentCount + 1;
      const nextMaxMeasureWidth = Math.max(
        currentMaxMeasureWidth,
        continuationWidth,
      );
      const projectedRowWidth =
        measureWidthMode === "equal"
          ? nextCount * nextMaxMeasureWidth
          : currentWidth + continuationWidth;
      if (projectedRowWidth <= maxSystemWidth) {
        currentWidth += continuationWidth;
        currentMaxMeasureWidth = nextMaxMeasureWidth;
        currentCount = nextCount;
      } else {
        counts.push(currentCount);
        const startAccidentals = changedAccidentals
          ? [...cancellations, ...nextActiveAccidentals]
          : activeAccidentals;
        currentWidth = estimateMeasureMinWidth({
          ...measure,
          clef,
          accidentals: startAccidentals,
          layoutTimeSignature: effectiveTime,
        });
        currentMaxMeasureWidth = currentWidth;
        currentCount = 1;
      }
    }

    activeAccidentals = nextActiveAccidentals;
    if (nextTime) activeTimeSignature = nextTime;
  }

  if (currentCount > 0) counts.push(currentCount);
  return counts;
}

export function arrangeNotationSystems<
  T extends {
    clef?: NotationClef | false;
    accidentals?: NotationAccidental[];
    timeSignature?: TimeSignature;
    layoutTimeSignature?: TimeSignature;
    notes?: NotationEvent[];
    spacing?: MeasureWidthMode | number;
    noteStart?: number;
    showRightBar?: boolean;
    rightBarStyle?: "single" | "final";
    repeatStart?: boolean;
    repeatEnd?: boolean;
  },
>(
  measures: readonly T[],
  measuresPerSystem: LayoutMode | readonly number[] = "auto",
  options: SystemLayoutOptions = {},
): ArrangedNotationMeasure<T>[][] {
  if (measuresPerSystem !== "auto") {
    const rawCounts =
      typeof measuresPerSystem === "number"
        ? [measuresPerSystem]
        : measuresPerSystem;
    if (
      rawCounts.length === 0 ||
      rawCounts.some((count) => !Number.isSafeInteger(count) || count < 1)
    ) {
      throw new Error("Ein Notensystem muss mindestens einen Takt enthalten.");
    }
    if (
      typeof measuresPerSystem !== "number" &&
      rawCounts.reduce((sum, count) => sum + count, 0) !== measures.length
    ) {
      throw new Error(
        "Die Taktzahlen der Systeme müssen zusammen alle Takte umfassen.",
      );
    }
  }

  if (measures.length === 0) return [];
  assertNoClefChanges(
    measures.map(({ clef }) => clef),
    "Notensystem",
  );
  const clef = measures[0].clef;
  if (!clef)
    throw new Error(
      "Für den Zeilenumbruch wird ein Anfangsschlüssel benötigt.",
    );

  const scale = options.scale && options.scale > 0 ? options.scale : 1;
  const effectiveMaxWidth =
    (options.maxSystemWidth ?? DEFAULT_MAX_SYSTEM_WIDTH) / scale;
  const measureWidthMode: MeasureWidthMode = options.measureWidth ?? "rhythmic";

  const counts =
    measuresPerSystem === "auto"
      ? resolveAutoSystemCounts(
          measures,
          clef,
          effectiveMaxWidth,
          measureWidthMode,
        )
      : undefined;

  const systems: (Omit<T, "clef" | "accidentals"> & {
    clef: NotationClef | false;
    accidentals?: NotationAccidental[];
    layoutTimeSignature?: TimeSignature;
  })[][] = [];
  let active: NotationAccidental[] = [];
  let activeTimeSignature: TimeSignature | undefined;
  let index = 0;
  let systemIndex = 0;
  while (index < measures.length) {
    const count =
      typeof measuresPerSystem === "number"
        ? measuresPerSystem
        : measuresPerSystem === "auto"
          ? (counts?.[systemIndex] ?? 1)
          : measuresPerSystem[systemIndex];
    systems.push(
      measures.slice(index, index + count).map((measure, offset) => {
        const nextTimeSignature =
          measure.timeSignature ?? measure.layoutTimeSignature;
        if (nextTimeSignature) {
          validateTimeSignature(nextTimeSignature);
          activeTimeSignature = nextTimeSignature;
        }
        const next = measure.accidentals;
        if (next?.some((sign) => sign.type === "natural")) {
          throw new Error(
            "Eine Tonartvorzeichnung darf nur Kreuze oder b-Vorzeichen enthalten.",
          );
        }
        const changed =
          next !== undefined &&
          (next.length !== active.length ||
            next.some(
              (sign, i) =>
                sign.type !== active[i]?.type || sign.step !== active[i]?.step,
            ));
        const cancellations: NotationAccidental[] = changed
          ? active
              .filter(
                (old) =>
                  !next.some(
                    (sign) =>
                      sign.type === old.type &&
                      (sign.step - old.step) % 7 === 0,
                  ),
              )
              .map(({ step }) => ({ type: "natural", step }))
          : [];
        if (changed) active = next;
        const accidentals = changed
          ? [...cancellations, ...active]
          : offset === 0
            ? active
            : undefined;
        return {
          ...measure,
          clef: offset === 0 ? clef : false,
          accidentals,
          layoutTimeSignature: activeTimeSignature,
        };
      }),
    );
    index += count;
    systemIndex += 1;
  }

  const alignedSystems = alignFirstNotesInSystems(systems);
  const baseFirstColumnX = Math.max(
    0,
    ...systems.map((system) =>
      system[0]
        ? defaultFirstNoteX({
            ...system[0],
            clef: system[0].clef || undefined,
            timeSignature: undefined,
          })
        : 0,
    ),
  );
  const baseFollowingColumnX = Math.max(
    0,
    ...systems.flatMap((system) =>
      system.slice(1).map((measure) =>
        defaultFirstNoteX({
          ...measure,
          clef: measure.clef || undefined,
          timeSignature: undefined,
        }),
      ),
    ),
  );

  const weightedSystems = alignedSystems.map((system) =>
    system.map((measure, colIndex) => {
      const ownFirstNoteX = defaultFirstNoteX({
        ...measure,
        clef: measure.clef || undefined,
      });
      const firstNoteX = Math.max(
        colIndex === 0 ? baseFirstColumnX : baseFollowingColumnX,
        ownFirstNoteX,
      );
      const minWidth = estimateMeasureMinWidth({
        ...measure,
        clef: measure.clef || undefined,
        firstNoteX,
      });
      const columnWeight =
        measureWidthMode === "equal"
          ? 1
          : typeof measure.spacing === "number" && measure.spacing > 0
            ? measure.spacing
            : minWidth;
      return {
        ...measure,
        firstNoteX,
        minWidth,
        columnWeight,
      };
    }),
  );

  const maxSystemLength = Math.max(
    ...weightedSystems.map((system) => system.length),
  );
  const fullLineMeasureCount =
    typeof measuresPerSystem === "number" ? measuresPerSystem : maxSystemLength;
  const rowWeights = weightedSystems.map((system) =>
    system.reduce((sum, measure) => sum + measure.columnWeight, 0),
  );
  const fullRowWeights =
    weightedSystems.length > 1
      ? rowWeights.slice(0, -1)
      : [rowWeights[0] * (fullLineMeasureCount / weightedSystems[0].length)];
  const referenceRowWeight = Math.max(...fullRowWeights, 1);

  return weightedSystems.map((system, rowIndex) => {
    const isLastRow = rowIndex === weightedSystems.length - 1;
    const isExplicitArrayLayout = Array.isArray(measuresPerSystem);
    const isIncompleteLastRow =
      !options.stretchLastRow &&
      !isExplicitArrayLayout &&
      isLastRow &&
      system.length < fullLineMeasureCount &&
      (weightedSystems.length > 1 || typeof measuresPerSystem === "number");

    let systemWidthRatio = 1;
    if (isIncompleteLastRow) {
      if (measureWidthMode === "equal") {
        systemWidthRatio = system.length / fullLineMeasureCount;
      } else {
        const countRatio = system.length / fullLineMeasureCount;
        const weightRatio = rowWeights[rowIndex] / referenceRowWeight;
        systemWidthRatio = Math.min(1, Math.max(countRatio, weightRatio));
        if (systemWidthRatio >= 1) {
          systemWidthRatio = countRatio;
        }
      }
    }

    return system.map((measure) => ({
      ...measure,
      systemWidthRatio,
    }));
  });
}

export function layoutNotationSystems(
  props: NotationProps,
  options: Omit<
    SystemLayoutOptions,
    "measureWidth" | "scale" | "stretchLastRow"
  > = {},
): NotationSystemRow<NotationMeasure>[] {
  const normalized = normalizeNotationInput(props);
  if (normalized.length === 0) return [];
  const omittedTime = omitUnchangedTimeSignatures([normalized])[0];
  const measureWidth = props.measureWidth ?? "rhythmic";
  const systems = arrangeNotationSystems(omittedTime, props.layout ?? "auto", {
    ...options,
    measureWidth,
    scale: props.scale,
    stretchLastRow: props.stretchLastRow,
  });

  return systems.map((measures) => {
    const columnWeights = measures.map((measure) => measure.columnWeight);
    const gridTemplateColumns =
      measureWidth === "equal"
        ? `repeat(${measures.length}, minmax(min-content, 1fr))`
        : measures
            .map(
              (measure) =>
                `minmax(${measure.minWidth}px, ${measure.columnWeight}fr)`,
            )
            .join(" ");
    const minWidth = measures.reduce(
      (sum, measure) => sum + measure.minWidth,
      0,
    );
    const widthRatio = measures[0]?.systemWidthRatio ?? 1;

    return {
      measures,
      columnWeights,
      gridTemplateColumns,
      minWidth,
      widthRatio,
    };
  });
}

export function alignFirstNotesInSystems<
  T extends Omit<NotationRenderOptions, "clef"> & {
    clef: NotationClef | false;
  },
>(systems: readonly (readonly T[])[]): (T & { firstNoteX: number })[][] {
  const columns: number[] = [];
  for (const system of systems) {
    system.forEach((measure, index) => {
      const minimum = defaultFirstNoteX({
        ...measure,
        clef: measure.clef || undefined,
      });
      columns[index] = Math.max(columns[index] ?? 0, minimum);
    });
  }
  const followingMeasureStart = Math.max(0, ...columns.slice(1));
  return systems.map((system) =>
    system.map((measure, index) => ({
      ...measure,
      firstNoteX: index === 0 ? columns[0] : followingMeasureStart,
    })),
  );
}
