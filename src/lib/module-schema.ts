import {
  BASE_XP_DEFAULTS,
  getAvailableTags,
  type TagDefinition,
} from "./xp-tags.ts";

export { BASE_XP_DEFAULTS, getAvailableTags, type TagDefinition };

export const MODULE_SCOPES = [
  "theory",
  "instrument",
  "production",
  "band",
] as const;
export type ModuleScope = (typeof MODULE_SCOPES)[number];

export const D_STAGES = ["D1", "D2", "D3"] as const;
export type DStage = (typeof D_STAGES)[number];

export const TARGET_LANES = ["exercise", "quiz_easy", "fastlane"] as const;
export type TargetLane = (typeof TARGET_LANES)[number];

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
  baseXp?: number;
  tags?: string[];
  visualComponent?: VisualComponentType;
  visualPropsJson?: string;
}

export interface ModuleContentReference {
  kind: "theory" | "exercise";
  id: string;
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
  moduleId: string;
  targetLane: TargetLane;
  questionType: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  notationTask?: NotationBuilderTaskConfig;
  explanation: string;
  baseXp: number;
  tags: string[];
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
  hasPractice: boolean;
  theoryBaseXp: number;
  quizEasyMinScore: number;
  fastlaneMinScore: number;
  theoryBlocks: TheoryBlock[];
  contentOrder?: ModuleContentReference[];
  createdAt: string;
  updatedAt: string;
}

export interface ModulesDatabase {
  modules: LearningModule[];
  questions: ModuleQuestion[];
  quizSettings?: QuizSettings;
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
    case "exercise":
      return BASE_XP_DEFAULTS.exercise;
    case "quiz_easy":
      return BASE_XP_DEFAULTS.quizEasy;
    case "fastlane":
      return BASE_XP_DEFAULTS.fastlane;
  }
}
