import {
  BASE_XP_DEFAULTS,
  DEFAULT_FASTLANE_MIN_SCORE,
  DEFAULT_QUIZ_EASY_MIN_SCORE,
  DEFAULT_QUIZ_SETTINGS,
  getDefaultBaseXpForLane,
  isDStage,
  isModuleScope,
  isQuestionType,
  isTargetLane,
  isVisualComponent,
  type LearningModule,
  type ModuleQuestion,
  type ModulesDatabase,
  NOTATION_DURATIONS,
  type NotationBuilderTaskConfig,
  type QuizSettings,
  type TargetLane,
  type TheoryBlock,
} from "./module-schema.ts";
import { calculateQuestionXp, calculateTheoryBlockXp } from "./xp-tags.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ModuleSummary {
  moduleId: string;
  theoryBlockCount: number;
  theoryXp: number;
  questionCounts: Record<TargetLane, number> & { total: number };
  laneXp: Record<TargetLane, number>;
  questionsXp: number;
  totalXp: number;
}

export type UpsertModuleInput = Partial<LearningModule> &
  Pick<LearningModule, "id" | "title">;

export type UpsertQuestionInput = Partial<ModuleQuestion> &
  Pick<ModuleQuestion, "id" | "moduleId" | "questionType" | "prompt">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(
  value: unknown,
  requireNonEmptyItems = false,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) =>
      requireNonEmptyItems ? isNonEmptyString(item) : typeof item === "string",
    )
  );
}

function validateScoreThreshold(
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (value === undefined) return;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    errors.push(`${label} muss eine Zahl zwischen 0 und 1 sein.`);
  }
}

function validateTheoryBlocks(blocks: unknown, errors: string[]): void {
  if (blocks === undefined) return;
  if (!Array.isArray(blocks)) {
    errors.push("theoryBlocks muss ein Array sein.");
    return;
  }

  const ids = new Set<string>();
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const prefix = `theoryBlocks[${index}]`;
    if (!isRecord(block)) {
      errors.push(`${prefix} muss ein Objekt sein.`);
      continue;
    }
    if (!isNonEmptyString(block.id)) {
      errors.push(`${prefix}.id darf nicht leer sein.`);
    } else if (ids.has(block.id.trim())) {
      errors.push(`${prefix}.id muss eindeutig sein.`);
    } else {
      ids.add(block.id.trim());
    }
    if (
      typeof block.order !== "number" ||
      !Number.isFinite(block.order) ||
      block.order < 0
    ) {
      errors.push(`${prefix}.order muss eine gültige Zahl >= 0 sein.`);
    }
    if (!isNonEmptyString(block.title)) {
      errors.push(`${prefix}.title darf nicht leer sein.`);
    }
    if (typeof block.markdownContent !== "string") {
      errors.push(`${prefix}.markdownContent muss ein String sein.`);
    }
    if (
      block.baseXp !== undefined &&
      (typeof block.baseXp !== "number" ||
        !Number.isFinite(block.baseXp) ||
        block.baseXp < 0)
    ) {
      errors.push(`${prefix}.baseXp muss eine Zahl >= 0 sein.`);
    }
    if (block.tags !== undefined && !isStringArray(block.tags, true)) {
      errors.push(
        `${prefix}.tags muss ein Array aus nicht-leeren Strings sein.`,
      );
    }
    if (
      block.visualComponent !== undefined &&
      !isVisualComponent(block.visualComponent)
    ) {
      errors.push(`${prefix}.visualComponent ist ungültig.`);
    }
    if (block.visualPropsJson !== undefined) {
      if (typeof block.visualPropsJson !== "string") {
        errors.push(`${prefix}.visualPropsJson muss ein JSON-String sein.`);
      } else if (block.visualPropsJson.trim().length > 0) {
        try {
          JSON.parse(block.visualPropsJson);
        } catch {
          errors.push(`${prefix}.visualPropsJson enthält kein gültiges JSON.`);
        }
      }
    }
  }
}

function validateNotationTask(task: unknown, errors: string[]): void {
  if (!isRecord(task)) {
    errors.push(
      "interactive_notation benötigt ein gültiges notationTask-Objekt.",
    );
    return;
  }

  if (task.clef !== "treble" && task.clef !== "bass") {
    errors.push("notationTask.clef muss 'treble' oder 'bass' sein.");
  }

  if (task.timeSignature !== undefined) {
    if (
      !isRecord(task.timeSignature) ||
      typeof task.timeSignature.numerator !== "number" ||
      !Number.isFinite(task.timeSignature.numerator) ||
      task.timeSignature.numerator < 1 ||
      typeof task.timeSignature.denominator !== "number" ||
      !Number.isFinite(task.timeSignature.denominator) ||
      task.timeSignature.denominator < 1
    ) {
      errors.push("notationTask.timeSignature ist ungültig.");
    }
  }

  if (task.accidentals !== undefined) {
    const validAccidentals =
      Array.isArray(task.accidentals) &&
      task.accidentals.every(
        (acc) =>
          isRecord(acc) &&
          (acc.type === "sharp" || acc.type === "flat") &&
          typeof acc.step === "number" &&
          Number.isFinite(acc.step),
      );
    if (!validAccidentals) {
      errors.push("notationTask.accidentals enthält ungültige Einträge.");
    }
  }

  if (
    task.maxNotes !== undefined &&
    (typeof task.maxNotes !== "number" ||
      !Number.isFinite(task.maxNotes) ||
      task.maxNotes < 1)
  ) {
    errors.push("notationTask.maxNotes muss >= 1 sein.");
  }

  if (
    task.lockDuration !== undefined &&
    typeof task.lockDuration !== "boolean" &&
    !NOTATION_DURATIONS.some((dur) => dur === task.lockDuration)
  ) {
    errors.push("notationTask.lockDuration ist ungültig.");
  }

  if (
    task.compact !== undefined &&
    typeof task.compact !== "boolean" &&
    task.compact !== "tight" &&
    task.compact !== "wide"
  ) {
    errors.push("notationTask.compact ist ungültig.");
  }

  if (
    task.expectedPitches !== undefined &&
    !isStringArray(task.expectedPitches, true)
  ) {
    errors.push(
      "notationTask.expectedPitches muss aus nicht-leeren Strings bestehen.",
    );
  }

  if (
    task.expectedDurations !== undefined &&
    !isStringArray(task.expectedDurations, true)
  ) {
    errors.push(
      "notationTask.expectedDurations muss aus nicht-leeren Strings bestehen.",
    );
  }

  const hasExpectedPitches =
    Array.isArray(task.expectedPitches) && task.expectedPitches.length >= 1;
  const hasExpectedDurations =
    Array.isArray(task.expectedDurations) && task.expectedDurations.length >= 1;

  if (!hasExpectedPitches && !hasExpectedDurations) {
    errors.push(
      "notationTask benötigt mindestens expectedPitches oder expectedDurations.",
    );
  }
}

/** Erzeugt eine leere Modul-Datenbank im Standardformat. */
export function createEmptyModulesDatabase(): ModulesDatabase {
  return { modules: [], questions: [] };
}

/** Validiert die Eingabedaten für ein Lernmodul. */
export function validateModuleInput(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: ["Moduldaten müssen ein Objekt sein."] };
  }

  const errors: string[] = [];

  if (!isNonEmptyString(input.id)) {
    errors.push("Modul-ID ist erforderlich.");
  }
  if (!isNonEmptyString(input.title)) {
    errors.push("Modultitel ist erforderlich.");
  }
  if (
    input.order !== undefined &&
    (typeof input.order !== "number" ||
      !Number.isFinite(input.order) ||
      input.order < 1)
  ) {
    errors.push("Modulreihenfolge (order) muss >= 1 sein.");
  }

  if (
    input.description !== undefined &&
    typeof input.description !== "string"
  ) {
    errors.push("description muss ein String sein.");
  }
  if (input.scope !== undefined && !isModuleScope(input.scope)) {
    errors.push("scope ist ungültig.");
  }
  if (
    input.level !== undefined &&
    (typeof input.level !== "number" ||
      !Number.isFinite(input.level) ||
      input.level < 0)
  ) {
    errors.push("level muss eine Zahl >= 0 sein.");
  }
  if (input.dStage !== undefined && !isDStage(input.dStage)) {
    errors.push("dStage muss D1, D2 oder D3 sein.");
  }
  if (input.tags !== undefined && !isStringArray(input.tags, true)) {
    errors.push("tags muss ein Array aus nicht-leeren Strings sein.");
  }
  if (
    input.hasPractice !== undefined &&
    typeof input.hasPractice !== "boolean"
  ) {
    errors.push("hasPractice muss ein Boolean sein.");
  }
  if (
    input.theoryBaseXp !== undefined &&
    (typeof input.theoryBaseXp !== "number" ||
      !Number.isFinite(input.theoryBaseXp) ||
      input.theoryBaseXp < 0)
  ) {
    errors.push("theoryBaseXp muss eine Zahl >= 0 sein.");
  }

  validateScoreThreshold(input.quizEasyMinScore, "quizEasyMinScore", errors);
  validateScoreThreshold(input.fastlaneMinScore, "fastlaneMinScore", errors);
  validateTheoryBlocks(input.theoryBlocks, errors);
  if (input.contentOrder !== undefined) {
    if (!Array.isArray(input.contentOrder)) {
      errors.push("contentOrder muss ein Array sein.");
    } else {
      const seen = new Set<string>();
      for (const entry of input.contentOrder) {
        if (
          !isRecord(entry) ||
          (entry.kind !== "theory" && entry.kind !== "exercise") ||
          !isNonEmptyString(entry.id)
        ) {
          errors.push("contentOrder enthält einen ungültigen Eintrag.");
          continue;
        }
        const key = `${entry.kind}:${entry.id.trim()}`;
        if (seen.has(key))
          errors.push("contentOrder enthält doppelte Einträge.");
        seen.add(key);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validiert eine Modul-Aufgabe inklusive Prüfung der Modul-Referenz. */
export function validateQuestionInput(
  input: unknown,
  existingModules: readonly LearningModule[] | ModulesDatabase,
): ValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: ["Aufgabendaten müssen ein Objekt sein."] };
  }

  const errors: string[] = [];
  const moduleList: readonly LearningModule[] = Array.isArray(existingModules)
    ? existingModules
    : "modules" in existingModules
      ? existingModules.modules
      : [];

  if (input.id !== undefined && !isNonEmptyString(input.id)) {
    errors.push("Aufgaben-ID darf nicht leer sein.");
  }

  if (!isNonEmptyString(input.moduleId)) {
    errors.push("moduleId ist erforderlich.");
  } else {
    const targetModuleId = input.moduleId.trim();
    if (!moduleList.some((mod) => mod.id === targetModuleId)) {
      errors.push(`Referenziertes Modul '${targetModuleId}' existiert nicht.`);
    }
  }

  if (!isNonEmptyString(input.prompt)) {
    errors.push("Aufgabenstellung (prompt) ist erforderlich.");
  }

  if (input.targetLane !== undefined && !isTargetLane(input.targetLane)) {
    errors.push("targetLane ist ungültig.");
  }

  if (!isQuestionType(input.questionType)) {
    errors.push("questionType ist ungültig.");
  } else if (input.questionType === "interactive_notation") {
    validateNotationTask(input.notationTask, errors);
  } else if (
    !isStringArray(input.correctAnswers, true) ||
    input.correctAnswers.length < 1
  ) {
    errors.push(
      "correctAnswers muss mindestens eine nicht-leere Antwort enthalten.",
    );
  }

  if (input.options !== undefined && !isStringArray(input.options, false)) {
    errors.push("options muss ein String-Array sein.");
  }
  if (
    input.explanation !== undefined &&
    typeof input.explanation !== "string"
  ) {
    errors.push("explanation muss ein String sein.");
  }
  if (
    input.baseXp !== undefined &&
    (typeof input.baseXp !== "number" ||
      !Number.isFinite(input.baseXp) ||
      input.baseXp < 0)
  ) {
    errors.push("baseXp muss eine Zahl >= 0 sein.");
  }
  if (input.tags !== undefined && !isStringArray(input.tags, true)) {
    errors.push("tags muss ein Array aus nicht-leeren Strings sein.");
  }

  return { valid: errors.length === 0, errors };
}

function cloneTheoryBlock(block: TheoryBlock): TheoryBlock {
  return {
    id: block.id.trim(),
    order: block.order,
    title: block.title.trim(),
    markdownContent: block.markdownContent,
    ...(block.baseXp !== undefined ? { baseXp: block.baseXp } : {}),
    ...(block.tags !== undefined ? { tags: [...block.tags] } : {}),
    ...(block.visualComponent !== undefined
      ? { visualComponent: block.visualComponent }
      : {}),
    ...(block.visualPropsJson !== undefined
      ? { visualPropsJson: block.visualPropsJson }
      : {}),
  };
}

function cloneNotationTask(
  task: NotationBuilderTaskConfig,
): NotationBuilderTaskConfig {
  return {
    ...task,
    maxNotes: task.maxNotes ?? 1,
    ...(task.timeSignature ? { timeSignature: { ...task.timeSignature } } : {}),
    ...(task.accidentals
      ? { accidentals: task.accidentals.map((acc) => ({ ...acc })) }
      : {}),
    ...(task.expectedPitches
      ? { expectedPitches: [...task.expectedPitches] }
      : {}),
    ...(task.expectedDurations
      ? { expectedDurations: [...task.expectedDurations] }
      : {}),
  };
}

/** Fügt ein Modul hinzu oder aktualisiert ein bestehendes Modul anhand seiner ID. */
export function upsertModule(
  db: ModulesDatabase,
  moduleData: UpsertModuleInput,
): ModulesDatabase {
  const validation = validateModuleInput(moduleData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const id = moduleData.id.trim();
  const existingIndex = db.modules.findIndex((mod) => mod.id === id);
  const existing = existingIndex >= 0 ? db.modules[existingIndex] : undefined;
  const now = new Date().toISOString();
  const scope = moduleData.scope ?? existing?.scope ?? "theory";
  const dStage = moduleData.dStage ?? existing?.dStage;

  const normalizedModule: LearningModule = {
    id,
    order:
      moduleData.order ??
      existing?.order ??
      db.modules.reduce((highest, mod) => Math.max(highest, mod.order), 0) + 1,
    title: moduleData.title.trim(),
    description: moduleData.description ?? existing?.description ?? "",
    scope,
    level: moduleData.level ?? existing?.level ?? 100,
    ...(dStage !== undefined ? { dStage } : {}),
    tags: [...(moduleData.tags ?? existing?.tags ?? [])],
    hasPractice:
      moduleData.hasPractice ?? existing?.hasPractice ?? scope !== "theory",
    theoryBaseXp:
      moduleData.theoryBaseXp ??
      existing?.theoryBaseXp ??
      BASE_XP_DEFAULTS.theoryBlock,
    quizEasyMinScore:
      moduleData.quizEasyMinScore ??
      existing?.quizEasyMinScore ??
      DEFAULT_QUIZ_EASY_MIN_SCORE,
    fastlaneMinScore:
      moduleData.fastlaneMinScore ??
      existing?.fastlaneMinScore ??
      DEFAULT_FASTLANE_MIN_SCORE,
    theoryBlocks: (moduleData.theoryBlocks ?? existing?.theoryBlocks ?? []).map(
      cloneTheoryBlock,
    ),
    ...((moduleData.contentOrder ?? existing?.contentOrder) !== undefined
      ? {
          contentOrder: (
            moduleData.contentOrder ??
            existing?.contentOrder ??
            []
          ).map((entry) => ({ kind: entry.kind, id: entry.id.trim() })),
        }
      : {}),
    createdAt: moduleData.createdAt ?? existing?.createdAt ?? now,
    updatedAt: moduleData.updatedAt ?? now,
  };

  const modules =
    existingIndex >= 0
      ? db.modules.map((mod, idx) =>
          idx === existingIndex ? normalizedModule : mod,
        )
      : [...db.modules, normalizedModule];

  return { ...db, modules, questions: [...db.questions] };
}

/** Verschiebt ein Modul relativ zu seinem erwarteten Nachbarn. */
export function moveModule(
  db: ModulesDatabase,
  moduleId: string,
  neighborId: string,
  direction: "up" | "down",
): ModulesDatabase | null {
  const sorted = [...db.modules].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((mod) => mod.id === moduleId);
  const neighborIndex = index + (direction === "up" ? -1 : 1);
  if (index < 0 || sorted[neighborIndex]?.id !== neighborId) return null;

  [sorted[index], sorted[neighborIndex]] = [
    sorted[neighborIndex],
    sorted[index],
  ];
  return {
    ...db,
    modules: sorted.map((mod, position) => ({ ...mod, order: position + 1 })),
    questions: [...db.questions],
  };
}

/** Entfernt ein Modul sowie kaskadierend alle zugehörigen Aufgaben. */
export function deleteModule(
  db: ModulesDatabase,
  moduleId: string,
): ModulesDatabase {
  return {
    ...db,
    modules: db.modules.filter((mod) => mod.id !== moduleId),
    questions: db.questions.filter(
      (question) => question.moduleId !== moduleId,
    ),
  };
}

/** Fügt eine Aufgabe hinzu oder aktualisiert eine bestehende Aufgabe anhand ihrer ID. */
export function upsertQuestion(
  db: ModulesDatabase,
  questionData: UpsertQuestionInput,
): ModulesDatabase {
  if (!isNonEmptyString(questionData.id)) {
    throw new Error("Aufgaben-ID ist erforderlich.");
  }

  const validation = validateQuestionInput(questionData, db.modules);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const id = questionData.id.trim();
  const moduleId = questionData.moduleId.trim();
  const existingIndex = db.questions.findIndex((q) => q.id === id);
  const existing = existingIndex >= 0 ? db.questions[existingIndex] : undefined;
  const targetLane =
    questionData.targetLane ?? existing?.targetLane ?? "exercise";
  const options = questionData.options ?? existing?.options;
  const notationTask =
    questionData.questionType === "interactive_notation"
      ? (questionData.notationTask ?? existing?.notationTask)
      : undefined;

  const normalizedQuestion: ModuleQuestion = {
    id,
    moduleId,
    targetLane,
    questionType: questionData.questionType,
    prompt: questionData.prompt.trim(),
    ...(options !== undefined ? { options: [...options] } : {}),
    correctAnswers: [
      ...(questionData.correctAnswers ?? existing?.correctAnswers ?? []),
    ],
    ...(notationTask !== undefined
      ? { notationTask: cloneNotationTask(notationTask) }
      : {}),
    explanation: questionData.explanation ?? existing?.explanation ?? "",
    baseXp:
      questionData.baseXp ??
      existing?.baseXp ??
      getDefaultBaseXpForLane(targetLane),
    tags: [...(questionData.tags ?? existing?.tags ?? [])],
  };

  const questions =
    existingIndex >= 0
      ? db.questions.map((q, idx) =>
          idx === existingIndex ? normalizedQuestion : q,
        )
      : [...db.questions, normalizedQuestion];

  return { ...db, modules: [...db.modules], questions };
}

/** Entfernt eine einzelne Aufgabe anhand ihrer ID. */
export function deleteQuestion(
  db: ModulesDatabase,
  questionId: string,
): ModulesDatabase {
  return {
    ...db,
    modules: [...db.modules],
    questions: db.questions.filter((question) => question.id !== questionId),
  };
}

export function updateQuizSettings(
  db: ModulesDatabase,
  settings: Pick<QuizSettings, "quizEasyMinScore" | "fastlaneMinScore">,
): ModulesDatabase {
  const errors: string[] = [];
  validateScoreThreshold(settings.quizEasyMinScore, "Quiz-Grenze", errors);
  validateScoreThreshold(settings.fastlaneMinScore, "Fastlane-Grenze", errors);
  if (errors.length) throw new Error(errors.join(" "));
  const current = db.quizSettings ?? DEFAULT_QUIZ_SETTINGS;
  if (
    current.quizEasyMinScore === settings.quizEasyMinScore &&
    current.fastlaneMinScore === settings.fastlaneMinScore
  )
    return db;
  return {
    ...db,
    quizSettings: { ...settings, revision: current.revision + 1 },
  };
}

/** Berechnet Theorie-Blöcke, Fragenverteilung je Lane und gewichtete Gesamt-XP eines Moduls. */
export function getModuleSummary(
  db: ModulesDatabase,
  moduleId: string,
): ModuleSummary | null {
  const mod = db.modules.find((item) => item.id === moduleId);
  if (!mod) {
    return null;
  }

  const theoryBlockCount = mod.theoryBlocks.length;
  const theoryXp = mod.theoryBlocks.reduce(
    (total, block) => total + calculateTheoryBlockXp(block, mod.theoryBaseXp),
    0,
  );
  const questionCounts: Record<TargetLane, number> & { total: number } = {
    exercise: 0,
    quiz_easy: 0,
    fastlane: 0,
    total: 0,
  };
  const laneXp: Record<TargetLane, number> = {
    exercise: 0,
    quiz_easy: 0,
    fastlane: 0,
  };

  let questionsXp = 0;
  for (const question of db.questions) {
    if (question.moduleId !== moduleId) continue;
    const xp = calculateQuestionXp(question.baseXp, question.tags);
    questionCounts[question.targetLane] += 1;
    questionCounts.total += 1;
    laneXp[question.targetLane] += xp;
    questionsXp += xp;
  }

  return {
    moduleId: mod.id,
    theoryBlockCount,
    theoryXp,
    questionCounts,
    laneXp,
    questionsXp,
    totalXp: theoryXp + questionsXp,
  };
}
