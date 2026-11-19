import {
  DEFAULT_LEARNING_CONFIGURATION,
  isLearningConfiguration,
  type LearningConfiguration,
} from "./learning-config.ts";
import {
  BASE_XP_DEFAULTS,
  getAvailableTags,
  QUESTION_BASE_XP,
  type TagDefinition,
} from "./xp-tags.ts";

export type { LearningConfiguration };
export {
  BASE_XP_DEFAULTS,
  getAvailableTags,
  isLearningConfiguration,
  type TagDefinition,
};

export const MODULE_SCOPES = [
  "theory",
  "instrument",
  "production",
  "band",
] as const;
export type ModuleScope = (typeof MODULE_SCOPES)[number];

export const D_STAGES = ["D1", "D2", "D3"] as const;
export type DStage = (typeof D_STAGES)[number];

export const TARGET_LANES = ["leicht", "mittel", "schwer"] as const;
export type TargetLane = (typeof TARGET_LANES)[number];

export const QUESTION_DIFFICULTIES = ["einfach", "mittel", "schwer"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];
export const QUESTION_DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  einfach: "Einfach",
  mittel: "Mittel",
  schwer: "Schwer",
};

export const QUESTION_TYPES = [
  "single_choice",
  "multi_select",
  "numeric_input",
  "interactive_notation",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const VISUAL_COMPONENTS = [
  "none",
  "Notation",
  "NotationVisual",
  "NotationKeyboard",
  "ScalePattern",
  "FretboardClickable",
] as const;
export type VisualComponentType = (typeof VISUAL_COMPONENTS)[number];

export interface DrumPatternTrack {
  name: string;
  note: string;
  color: string;
  activeSteps: number[];
  cellLabels?: string[];
  eventPositions?: number[];
  eventLabels?: string[];
  velocities?: number[];
  soundUrl?: string;
}

export interface DrumPatternProps {
  steps?: number;
  bpm?: number;
  timeSignature?: string;
  resolution?: string;
  highlightTrack?: string;
  highlightTracks?: string[];
  interactive?: boolean;
  enableAudio?: boolean;
  showPlaybackButton?: boolean;
  showTempo?: boolean;
  showPlaybackHint?: boolean;
  showAudioHelp?: boolean;
  showVelocity?: boolean;
  showTrackNote?: boolean;
  showFooter?: boolean;
  showFooterInfo?: boolean;
  useTrackColors?: boolean;
  continuous?: boolean;
  keepEmptyTracks?: boolean;
  stepSize?: number;
  stepLabels?: string[];
  patternData?: DrumPatternTrack[];
}

export const DEFAULT_DRUM_PATTERN_DATA: DrumPatternTrack[] = [
  { name: "Kick - Hit", note: "C1", color: "#ef4444", activeSteps: [0, 4] },
  {
    name: "Snare - Center",
    note: "D1",
    color: "#f97316",
    activeSteps: [2, 6],
  },
  { name: "Snare - Edge", note: "A0", color: "#f97316", activeSteps: [] },
  {
    name: "Floortom 2 - Center",
    note: "F1",
    color: "#eab308",
    activeSteps: [],
  },
  {
    name: "Hi-Hat - Closed Edge",
    note: "A#-1",
    color: "#22c55e",
    activeSteps: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    name: "Hi-Hat - Open Edge 0",
    note: "E3",
    color: "#22c55e",
    activeSteps: [],
  },
  {
    name: "Hi-Hat - Open Edge 3",
    note: "D0",
    color: "#22c55e",
    activeSteps: [],
  },
  { name: "Crash 1 - Crash", note: "D5", color: "#0ea5e9", activeSteps: [] },
];

export const DEFAULT_DRUM_PATTERN_PROPS: Required<
  Omit<DrumPatternProps, "stepLabels" | "enableAudio">
> = {
  steps: 8,
  bpm: 120,
  showPlaybackButton: true,
  showTempo: true,
  showPlaybackHint: true,
  showAudioHelp: true,
  timeSignature: "4/4",
  resolution: "1/8",
  highlightTrack: "",
  highlightTracks: [],
  interactive: true,
  showVelocity: false,
  showTrackNote: true,
  showFooter: true,
  showFooterInfo: true,
  useTrackColors: false,
  continuous: false,
  keepEmptyTracks: false,
  stepSize: 32.5,
  patternData: DEFAULT_DRUM_PATTERN_DATA,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

export function getDrumPatternPropsErrors(value: unknown): string[] {
  if (!isRecord(value)) return ["Die Props müssen ein Objekt sein."];

  const errors: string[] = [];
  const propNames = new Set([
    "steps",
    "bpm",
    "timeSignature",
    "resolution",
    "highlightTrack",
    "highlightTracks",
    "interactive",
    "enableAudio",
    "showPlaybackButton",
    "showTempo",
    "showPlaybackHint",
    "showAudioHelp",
    "showVelocity",
    "showTrackNote",
    "showFooter",
    "showFooterInfo",
    "useTrackColors",
    "continuous",
    "keepEmptyTracks",
    "stepSize",
    "stepLabels",
    "patternData",
  ]);
  for (const name of Object.keys(value)) {
    if (!propNames.has(name)) errors.push(`Unbekannte Prop „${name}“.`);
  }

  const steps =
    typeof value.steps === "number" &&
    Number.isInteger(value.steps) &&
    value.steps >= 1 &&
    value.steps <= 64
      ? value.steps
      : DEFAULT_DRUM_PATTERN_PROPS.steps;
  if (
    value.bpm !== undefined &&
    (typeof value.bpm !== "number" ||
      !Number.isFinite(value.bpm) ||
      value.bpm <= 0)
  ) {
    errors.push("bpm muss eine endliche Zahl größer 0 sein.");
  }
  if (
    value.steps !== undefined &&
    (typeof value.steps !== "number" ||
      !Number.isInteger(value.steps) ||
      value.steps < 1 ||
      value.steps > 64)
  ) {
    errors.push("steps muss eine ganze Zahl zwischen 1 und 64 sein.");
  }

  for (const name of ["timeSignature", "resolution"] as const) {
    if (
      value[name] !== undefined &&
      (typeof value[name] !== "string" || value[name].trim().length === 0)
    ) {
      errors.push(`${name} muss ein nicht-leerer Text sein.`);
    }
  }

  const requestedHighlights: Array<{
    name: string;
    prop: "highlightTrack" | "highlightTracks";
  }> = [];
  if (value.highlightTrack !== undefined) {
    if (typeof value.highlightTrack !== "string") {
      errors.push("highlightTrack muss ein Spur-Name sein.");
    } else if (value.highlightTrack.trim()) {
      requestedHighlights.push({
        name: value.highlightTrack.trim(),
        prop: "highlightTrack",
      });
    }
  }
  if (value.highlightTracks !== undefined) {
    if (
      !isStringArray(value.highlightTracks) ||
      value.highlightTracks.length > 64 ||
      value.highlightTracks.some((track) => track.trim().length === 0)
    ) {
      errors.push(
        "highlightTracks muss ein Array nicht-leerer Spur-Namen sein.",
      );
    } else {
      requestedHighlights.push(
        ...value.highlightTracks.map((name) => ({
          name: name.trim(),
          prop: "highlightTracks" as const,
        })),
      );
    }
  }
  const tracks =
    value.patternData === undefined
      ? DEFAULT_DRUM_PATTERN_DATA
      : value.patternData;
  if (Array.isArray(tracks)) {
    for (const { name, prop } of requestedHighlights) {
      if (!tracks.some((track) => isRecord(track) && track.name === name)) {
        errors.push(
          prop === "highlightTrack"
            ? "highlightTrack muss einem Namen in patternData entsprechen."
            : `highlightTracks enthält den unbekannten Spur-Namen „${name}“.`,
        );
      }
    }
  }

  for (const name of [
    "interactive",
    "enableAudio",
    "showPlaybackButton",
    "showTempo",
    "showPlaybackHint",
    "showAudioHelp",
    "showVelocity",
    "showTrackNote",
    "showFooter",
    "showFooterInfo",
    "useTrackColors",
    "continuous",
    "keepEmptyTracks",
  ] as const) {
    if (value[name] !== undefined && typeof value[name] !== "boolean") {
      errors.push(`${name} muss true oder false sein.`);
    }
  }

  if (
    value.stepSize !== undefined &&
    (typeof value.stepSize !== "number" ||
      !Number.isFinite(value.stepSize) ||
      value.stepSize <= 0 ||
      value.stepSize > 128)
  ) {
    errors.push("stepSize muss eine Zahl größer 0 und höchstens 128 sein.");
  }

  if (value.stepLabels !== undefined) {
    if (!isStringArray(value.stepLabels) || value.stepLabels.length > steps) {
      errors.push(
        "stepLabels muss ein Text-Array mit höchstens steps Labels sein.",
      );
    }
  }

  if (value.patternData !== undefined) {
    if (!Array.isArray(value.patternData) || value.patternData.length > 64) {
      errors.push("patternData muss ein Array mit höchstens 64 Spuren sein.");
    } else {
      for (let index = 0; index < value.patternData.length; index += 1) {
        const track = value.patternData[index];
        const prefix = `patternData[${index}]`;
        if (!isRecord(track)) {
          errors.push(`${prefix} muss ein Objekt sein.`);
          continue;
        }
        for (const name of Object.keys(track)) {
          if (
            ![
              "name",
              "note",
              "color",
              "activeSteps",
              "cellLabels",
              "eventPositions",
              "eventLabels",
              "velocities",
              "soundUrl",
            ].includes(name)
          ) {
            errors.push(
              `${prefix} enthält die unbekannte Eigenschaft „${name}“.`,
            );
          }
        }
        for (const name of ["name", "note"] as const) {
          if (
            typeof track[name] !== "string" ||
            track[name].trim().length === 0
          ) {
            errors.push(`${prefix}.${name} muss ein nicht-leerer Text sein.`);
          }
        }
        if (
          track.soundUrl !== undefined &&
          (typeof track.soundUrl !== "string" || !track.soundUrl.trim())
        ) {
          errors.push(`${prefix}.soundUrl muss ein nicht-leerer Text sein.`);
        }
        if (
          typeof track.color !== "string" ||
          !/^(?:#[\da-f]{3,8}|[a-z]+)$/i.test(track.color)
        ) {
          errors.push(`${prefix}.color muss ein Hex- oder CSS-Farbname sein.`);
        }
        if (!Array.isArray(track.activeSteps)) {
          errors.push(`${prefix}.activeSteps muss ein Zahlen-Array sein.`);
        } else if (
          !track.activeSteps.every(
            (step) =>
              typeof step === "number" &&
              Number.isInteger(step) &&
              step >= 0 &&
              step < steps,
          )
        ) {
          errors.push(
            `${prefix}.activeSteps muss gültige Step-Indizes enthalten.`,
          );
        }
        for (const name of ["cellLabels", "eventLabels"] as const) {
          if (track[name] !== undefined && !isStringArray(track[name])) {
            errors.push(`${prefix}.${name} muss ein Text-Array sein.`);
          }
        }
        if (
          track.eventPositions !== undefined &&
          (!isNumberArray(track.eventPositions) ||
            track.eventPositions.some(
              (position) => position < 0 || position >= steps,
            ))
        ) {
          errors.push(
            `${prefix}.eventPositions muss Positionen innerhalb der Steps enthalten.`,
          );
        }
        if (
          track.velocities !== undefined &&
          (!isNumberArray(track.velocities) ||
            track.velocities.some(
              (velocity) =>
                !Number.isInteger(velocity) || velocity < 0 || velocity > 127,
            ))
        ) {
          errors.push(
            `${prefix}.velocities muss Ganzzahlen zwischen 0 und 127 enthalten.`,
          );
        }
      }
    }
  }

  return errors;
}

export function isDrumPatternProps(value: unknown): value is DrumPatternProps {
  return getDrumPatternPropsErrors(value).length === 0;
}

export const NOTATION_DURATIONS = [
  "whole",
  "half",
  "quarter",
  "eighth",
  "sixteenth",
] as const;
export type NotationTaskDuration = (typeof NOTATION_DURATIONS)[number];

export const DEFAULT_QUIZ_EASY_MIN_SCORE = 0.8;
export const DEFAULT_FASTLANE_MIN_SCORE = 0.85;

export interface QuizSettings {
  quizEasyMinScore: number;
  fastlaneMinScore: number;
  revision: number;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  quizEasyMinScore: DEFAULT_QUIZ_EASY_MIN_SCORE,
  fastlaneMinScore: DEFAULT_FASTLANE_MIN_SCORE,
  revision: 0,
};

export function isQuizSettings(value: unknown): value is QuizSettings {
  if (typeof value !== "object" || value === null) return false;
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.quizEasyMinScore === "number" &&
    Number.isFinite(settings.quizEasyMinScore) &&
    settings.quizEasyMinScore >= 0 &&
    settings.quizEasyMinScore <= 1 &&
    typeof settings.fastlaneMinScore === "number" &&
    Number.isFinite(settings.fastlaneMinScore) &&
    settings.fastlaneMinScore >= 0 &&
    settings.fastlaneMinScore <= 1 &&
    typeof settings.revision === "number" &&
    Number.isSafeInteger(settings.revision) &&
    settings.revision >= 0
  );
}

export interface TheoryBlock {
  id: string;
  order: number;
  title: string;
  markdownContent: string;
  role?: "theory" | "exercise_intro";
  groupId?: string;
  groupTitle?: string;
  baseXp?: number;
  tags?: string[];
  visualComponent?: VisualComponentType;
  visualPropsJson?: string;
}

export interface PracticeBlock {
  id: string;
  title: string;
  markdownContent: string;
  baseXp?: number;
  tags?: string[];
}

export interface ModuleContentReference {
  kind: "theory" | "exercise" | "practice";
  id: string;
  groupId?: string;
  groupTitle?: string;
}

export interface NotationBuilderTaskConfig {
  clef: "treble" | "bass";
  timeSignature?: { numerator: number; denominator: number };
  accidentals?: Array<{ type: "sharp" | "flat"; step: number }>;
  maxNotes?: number;
  lockDuration?: NotationTaskDuration | boolean;
  showDurationPicker?: boolean;
  compact?: boolean | "tight" | "wide";
  showHints?: boolean;
  expectedPitches?: string[];
  expectedDurations?: string[];
}

export interface ModuleQuestion {
  id: string;
  /** Module, in denen die Frage verwendet wird; Lernpfad-Aufgaben (`leicht`) gehören genau einem Modul. */
  moduleIds: string[];
  targetLane: TargetLane;
  difficulty?: QuestionDifficulty;
  questionType: QuestionType;
  title?: string;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  notationTask?: NotationBuilderTaskConfig;
  simpleHint?: string;
  strongHint?: string;
  explanation: string;
  baseXp: number;
  tags: string[];
}

export function formatExerciseTitle(title?: string, fallback = ""): string {
  const text = title?.trim().replace(/^Aufgabe:\s*/i, "");
  const promptFallback = fallback
    .replace(/<(?:Notation(?:Keyboard)?|DrumPattern)\b[\s\S]*?\/>/gi, " ")
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `Aufgabe: ${text || promptFallback || "Neue Aufgabe"}`;
}

export interface LearningModule {
  id: string;
  order: number;
  title: string;
  description: string;
  scope: ModuleScope;
  level: number;
  dStage?: DStage;
  tags: string[];
  archived?: boolean;
  prerequisiteModuleIds?: string[];
  theoryBaseXp: number;
  quizEasyMinScore: number;
  fastlaneMinScore: number;
  theoryBlocks: TheoryBlock[];
  practiceBlocks: PracticeBlock[];
  contentOrder?: ModuleContentReference[];
  createdAt: string;
  updatedAt: string;
}

export interface ModulesDatabase {
  modules: LearningModule[];
  questions: ModuleQuestion[];
  quizSettings?: QuizSettings;
  learningConfig?: LearningConfiguration;
}

/** Das Blocklager bleibt im Builder verfügbar, gehört aber nicht zum Lernangebot. */
export function getLearningCatalog(db: ModulesDatabase): ModulesDatabase {
  const archivedIds = new Set(
    db.modules.filter((mod) => mod.archived).map((mod) => mod.id),
  );
  if (archivedIds.size === 0) return db;
  return {
    ...db,
    modules: db.modules.filter((mod) => !archivedIds.has(mod.id)),
    questions: db.questions.flatMap((question) => {
      if (!question.moduleIds.some((id) => archivedIds.has(id))) {
        return [question];
      }
      const moduleIds = question.moduleIds.filter((id) => !archivedIds.has(id));
      return moduleIds.length > 0 ? [{ ...question, moduleIds }] : [];
    }),
  };
}

const LEGACY_LANES: Record<string, TargetLane> = {
  exercise: "leicht",
  quiz_easy: "mittel",
  fastlane: "schwer",
};

/** Normalisiert Altdaten, Aufgabenschwierigkeit und feste Aufgaben-Basis-XP. */
export function normalizeLegacyDatabase(db: ModulesDatabase): ModulesDatabase {
  return {
    ...db,
    learningConfig: db.learningConfig ?? DEFAULT_LEARNING_CONFIGURATION,
    modules: db.modules.map((mod) => {
      const { hasPractice: _legacy, ...rest } = mod as LearningModule & {
        hasPractice?: boolean;
      };
      return {
        ...rest,
        practiceBlocks: Array.isArray(rest.practiceBlocks)
          ? rest.practiceBlocks
          : [],
      };
    }),
    questions: db.questions.map((question) => {
      const { moduleId, ...rest } = question as ModuleQuestion & {
        moduleId?: string;
      };
      if (
        rest.difficulty !== undefined &&
        !isQuestionDifficulty(rest.difficulty)
      ) {
        throw new Error(`Ungültige Schwierigkeit für Aufgabe '${rest.id}'.`);
      }
      return {
        ...rest,
        targetLane: LEGACY_LANES[rest.targetLane] ?? rest.targetLane,
        difficulty: rest.difficulty ?? "einfach",
        baseXp: QUESTION_BASE_XP,
        moduleIds: Array.isArray(rest.moduleIds)
          ? rest.moduleIds
          : moduleId
            ? [moduleId]
            : [],
      };
    }),
  };
}

export function isModuleScope(value: unknown): value is ModuleScope {
  return (
    typeof value === "string" && MODULE_SCOPES.some((scope) => scope === value)
  );
}

export function isDStage(value: unknown): value is DStage {
  return typeof value === "string" && D_STAGES.some((stage) => stage === value);
}

export function isTargetLane(value: unknown): value is TargetLane {
  return (
    typeof value === "string" && TARGET_LANES.some((lane) => lane === value)
  );
}

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === "string" &&
    QUESTION_TYPES.some((questionType) => questionType === value)
  );
}

export function isQuestionDifficulty(
  value: unknown,
): value is QuestionDifficulty {
  return (
    typeof value === "string" &&
    QUESTION_DIFFICULTIES.some((difficulty) => difficulty === value)
  );
}

export function isVisualComponent(
  value: unknown,
): value is VisualComponentType {
  return (
    typeof value === "string" &&
    VISUAL_COMPONENTS.some((component) => component === value)
  );
}

/** Liefert die Standard-Basis-XP passend zur Ziel-Lane einer Aufgabe. */
export function getDefaultBaseXpForLane(lane: TargetLane): number {
  switch (lane) {
    case "leicht":
      return BASE_XP_DEFAULTS.leicht;
    case "mittel":
      return BASE_XP_DEFAULTS.mittel;
    case "schwer":
      return BASE_XP_DEFAULTS.schwer;
  }
}

/** Prüft, ob eine Frage dem Modul zugeordnet ist. */
export function isQuestionInModule(
  question: Pick<ModuleQuestion, "moduleIds">,
  moduleId: string,
): boolean {
  return question.moduleIds.includes(moduleId);
}
