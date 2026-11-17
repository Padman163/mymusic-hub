import {
  DEFAULT_QUIZ_SETTINGS,
  getAvailableTags,
  isQuizSettings,
  type LearningModule,
  MODULE_SCOPES,
  type ModuleQuestion,
  type ModuleScope,
  type ModulesDatabase,
  type QuizSettings,
} from "./module-schema.ts";
import { calculateQuestionXp, calculateTheoryBlockXp } from "./xp-tags.ts";

export const LEARNING_PROGRESS_STORAGE_KEY = "mymusic_learning_progress_v1";
export const XP_PER_LEVEL = 500;

export const LANE_STEPS = [
  "theory",
  "exercise",
  "practice",
  "quiz_easy",
] as const;
export type LaneStep = (typeof LANE_STEPS)[number];

export const STEP_PROGRESS_STATES = [
  "locked",
  "unlocked",
  "completed",
] as const;
export type StepProgressState = (typeof STEP_PROGRESS_STATES)[number];

export type ModuleUnlockStatus = "locked" | "unlocked" | "completed";
export type ModuleCompletionMode = "normal" | "fastlane";

export interface ModuleProgress {
  moduleId: string;
  status: ModuleUnlockStatus;
  completedVia?: ModuleCompletionMode;
  steps: Record<LaneStep, StepProgressState>;
  solvedQuestionIds: string[];
  completedTheoryBlockIds: string[];
  bestQuizEasyScore?: number;
  bestFastlaneScore?: number;
}

export interface LearningProgressState {
  totalXp: number;
  xpByScope: Record<ModuleScope, number>;
  xpByTag: Record<string, number>;
  modules: Record<string, ModuleProgress>;
  updatedAt: string;
  quizSettings?: QuizSettings;
}

export interface DashboardOverview {
  totalXp: number;
  level: number;
  levelProgressPercent: number;
  xpToNextLevel: number;
  completedModules: number;
  totalModules: number;
  overallPercent: number;
  xpByScope: Record<ModuleScope, number>;
  xpByTag: Record<string, number>;
}

export function getEffectiveQuizSettings(
  state: LearningProgressState,
  db: ModulesDatabase,
): QuizSettings {
  const saved = state.quizSettings ?? DEFAULT_QUIZ_SETTINGS;
  const current = db.quizSettings ?? DEFAULT_QUIZ_SETTINGS;
  return current.revision > saved.revision ? current : saved;
}

const memoryStorageFallback = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function sortModulesByOrder(
  modules: readonly LearningModule[],
): LearningModule[] {
  return [...modules].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id),
  );
}

function createEmptyScopeXp(): Record<ModuleScope, number> {
  return {
    theory: 0,
    instrument: 0,
    production: 0,
    band: 0,
  };
}

function createEmptyTagXp(): Record<string, number> {
  const tags: Record<string, number> = {};
  for (const tag of getAvailableTags()) {
    tags[tag] = 0;
  }
  return tags;
}

function createModuleProgress(
  moduleId: string,
  unlocked: boolean,
): ModuleProgress {
  return {
    moduleId,
    status: unlocked ? "unlocked" : "locked",
    steps: {
      theory: unlocked ? "unlocked" : "locked",
      exercise: "locked",
      practice: "locked",
      quiz_easy: "locked",
    },
    solvedQuestionIds: [],
    completedTheoryBlockIds: [],
  };
}

function cloneModuleProgress(progress: ModuleProgress): ModuleProgress {
  return {
    moduleId: progress.moduleId,
    status: progress.status,
    ...(progress.completedVia !== undefined
      ? { completedVia: progress.completedVia }
      : {}),
    steps: {
      theory: progress.steps.theory,
      exercise: progress.steps.exercise,
      practice: progress.steps.practice,
      quiz_easy: progress.steps.quiz_easy,
    },
    solvedQuestionIds: [...progress.solvedQuestionIds],
    completedTheoryBlockIds: [...(progress.completedTheoryBlockIds ?? [])],
    ...(progress.bestQuizEasyScore !== undefined
      ? { bestQuizEasyScore: progress.bestQuizEasyScore }
      : {}),
    ...(progress.bestFastlaneScore !== undefined
      ? { bestFastlaneScore: progress.bestFastlaneScore }
      : {}),
  };
}

function cloneState(state: LearningProgressState): LearningProgressState {
  const xpByScope = createEmptyScopeXp();
  for (const scope of MODULE_SCOPES) {
    const val = state.xpByScope[scope];
    xpByScope[scope] =
      typeof val === "number" && Number.isFinite(val) ? val : 0;
  }

  const xpByTag = createEmptyTagXp();
  for (const [tag, value] of Object.entries(state.xpByTag)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      xpByTag[tag] = value;
    }
  }

  const modules: Record<string, ModuleProgress> = {};
  for (const [moduleId, modProgress] of Object.entries(state.modules)) {
    modules[moduleId] = cloneModuleProgress(modProgress);
  }

  return {
    totalXp:
      typeof state.totalXp === "number" && Number.isFinite(state.totalXp)
        ? state.totalXp
        : 0,
    xpByScope,
    xpByTag,
    modules,
    updatedAt: state.updatedAt,
    ...(state.quizSettings ? { quizSettings: { ...state.quizSettings } } : {}),
  };
}

function creditXp(
  target: LearningProgressState,
  amount: number,
  scope: ModuleScope,
  tags: readonly string[],
): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }
  const rounded = Math.round(amount);
  target.totalXp += rounded;
  target.xpByScope[scope] = (target.xpByScope[scope] ?? 0) + rounded;

  const uniqueTags = new Set(
    tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
  );
  for (const tag of uniqueTags) {
    target.xpByTag[tag] = (target.xpByTag[tag] ?? 0) + rounded;
  }
}

function unlockModuleEntry(progress: ModuleProgress): void {
  if (progress.status === "locked") {
    progress.status = "unlocked";
  }
  if (progress.steps.theory === "locked") {
    progress.steps.theory = "unlocked";
  }
}

function unlockNextStepAfterExercise(
  progress: ModuleProgress,
  mod: LearningModule,
): void {
  progress.steps.exercise = "completed";
  if (mod.hasPractice) {
    if (progress.steps.practice === "locked") {
      progress.steps.practice = "unlocked";
    }
  } else if (progress.steps.quiz_easy === "locked") {
    progress.steps.quiz_easy = "unlocked";
  }
}

function unlockSuccessorModule(
  state: LearningProgressState,
  sortedModules: readonly LearningModule[],
  completedModuleId: string,
): void {
  const index = sortedModules.findIndex((mod) => mod.id === completedModuleId);
  if (index < 0 || index + 1 >= sortedModules.length) {
    return;
  }
  const nextModule = sortedModules[index + 1];
  const existing = state.modules[nextModule.id];
  if (!existing) {
    state.modules[nextModule.id] = createModuleProgress(nextModule.id, true);
    return;
  }
  unlockModuleEntry(existing);
}

/**
 * Erzeugt einen frischen Lernfortschritt für ein Curriculum:
 * Modul mit kleinster `order` startet freigeschaltet (`steps.theory = 'unlocked'`),
 * alle Folgemodule starten gesperrt.
 */
export function createInitialProgress(
  modules: readonly LearningModule[],
  quizSettings: QuizSettings = DEFAULT_QUIZ_SETTINGS,
): LearningProgressState {
  const sorted = sortModulesByOrder(modules);
  const moduleEntries: Record<string, ModuleProgress> = {};

  for (let index = 0; index < sorted.length; index += 1) {
    const mod = sorted[index];
    moduleEntries[mod.id] = createModuleProgress(mod.id, index === 0);
  }

  return {
    totalXp: 0,
    xpByScope: createEmptyScopeXp(),
    xpByTag: createEmptyTagXp(),
    modules: moduleEntries,
    updatedAt: nowIso(),
    quizSettings: { ...quizSettings },
  };
}

/**
 * Synchronisiert bestehenden Lernfortschritt mit neu hinzugekommenen Modulen,
 * ohne bereits erzielte Fortschritte, XP oder Scores zu überschreiben.
 */
export function syncProgressWithCurriculum(
  state: LearningProgressState,
  modules: readonly LearningModule[],
): LearningProgressState {
  const next = cloneState(state);
  const sorted = sortModulesByOrder(modules);

  for (let index = 0; index < sorted.length; index += 1) {
    const mod = sorted[index];
    const prevMod = index > 0 ? sorted[index - 1] : undefined;
    const prevCompleted =
      prevMod !== undefined && next.modules[prevMod.id]?.status === "completed";
    const shouldUnlock = index === 0 || prevCompleted;

    const existing = next.modules[mod.id];
    if (!existing) {
      next.modules[mod.id] = createModuleProgress(mod.id, shouldUnlock);
    } else if (shouldUnlock && existing.status === "locked") {
      unlockModuleEntry(existing);
    }
  }

  next.updatedAt = nowIso();
  return next;
}

/**
 * Schließt einen leeren oder vollständig bearbeiteten Theorie-Schritt ab.
 */
export function completeTheoryStep(
  state: LearningProgressState,
  module: LearningModule,
  moduleQuestions?: readonly ModuleQuestion[],
): LearningProgressState {
  const existing = state.modules[module.id];
  if (
    !existing ||
    existing.status === "locked" ||
    existing.steps.theory === "locked" ||
    (existing.steps.theory !== "completed" &&
      module.theoryBlocks.some(
        (block) => !existing.completedTheoryBlockIds?.includes(block.id),
      ))
  ) {
    return state;
  }

  const next = cloneState(state);
  const target = next.modules[module.id];

  if (target.steps.theory !== "completed") {
    target.steps.theory = "completed";
  }

  if (target.steps.exercise === "locked") {
    target.steps.exercise = "unlocked";
  }

  if (
    moduleQuestions &&
    target.steps.exercise !== "completed" &&
    moduleQuestions
      .filter(
        (question) =>
          question.moduleId === module.id && question.targetLane === "exercise",
      )
      .every((question) => target.solvedQuestionIds.includes(question.id))
  ) {
    unlockNextStepAfterExercise(target, module);
  }

  if (
    target.steps.theory === existing.steps.theory &&
    target.steps.exercise === existing.steps.exercise &&
    target.steps.practice === existing.steps.practice &&
    target.steps.quiz_easy === existing.steps.quiz_easy
  ) {
    return state;
  }

  next.updatedAt = nowIso();
  return next;
}

export function completeTheoryBlock(
  state: LearningProgressState,
  module: LearningModule,
  blockId: string,
  moduleQuestions?: readonly ModuleQuestion[],
): LearningProgressState {
  const existing = state.modules[module.id];
  const block = module.theoryBlocks.find((item) => item.id === blockId);
  if (
    !existing ||
    !block ||
    existing.status === "locked" ||
    existing.steps.theory !== "unlocked" ||
    existing.completedTheoryBlockIds?.includes(blockId)
  ) {
    return state;
  }
  const next = cloneState(state);
  next.modules[module.id].completedTheoryBlockIds.push(blockId);
  creditXp(
    next,
    calculateTheoryBlockXp(block, module.theoryBaseXp),
    module.scope,
    block.tags ?? [],
  );
  next.updatedAt = nowIso();
  return module.theoryBlocks.every((item) =>
    next.modules[module.id].completedTheoryBlockIds.includes(item.id),
  )
    ? completeTheoryStep(next, module, moduleQuestions)
    : next;
}

/**
 * Verarbeitet eine beantwortete Übungsaufgabe (`exercise`).
 * Bei `isCompleted === true` wird jede `question.id` höchstens einmal vergütet.
 * Sind alle `exercise`-Aufgaben des Moduls gelöst, wird je nach `module.hasPractice`
 * der Praxis-Schritt oder direkt `quiz_easy` freigeschaltet.
 */
export function recordExerciseAnswer(
  state: LearningProgressState,
  module: LearningModule,
  question: ModuleQuestion,
  isCompleted: boolean,
  moduleQuestions?: readonly ModuleQuestion[],
): LearningProgressState {
  if (!isCompleted || question.moduleId !== module.id) {
    return state;
  }

  const existing = state.modules[module.id];
  if (
    !existing ||
    existing.status === "locked" ||
    (existing.steps.exercise === "locked" && moduleQuestions === undefined)
  ) {
    return state;
  }

  const next = cloneState(state);
  const target = next.modules[module.id];
  const solvedSet = new Set(target.solvedQuestionIds);
  if (target.steps.exercise === "locked") {
    target.steps.exercise = "unlocked";
  }

  if (!solvedSet.has(question.id)) {
    solvedSet.add(question.id);
    target.solvedQuestionIds.push(question.id);
    const questionXp = calculateQuestionXp(question.baseXp, question.tags);
    creditXp(next, questionXp, module.scope, question.tags);
  }

  if (question.targetLane === "exercise") {
    if (moduleQuestions) {
      const exerciseQuestions = moduleQuestions.filter(
        (item) => item.moduleId === module.id && item.targetLane === "exercise",
      );
      const allExercisesSolved =
        exerciseQuestions.length === 0 ||
        exerciseQuestions.every((item) => solvedSet.has(item.id));
      if (allExercisesSolved && target.steps.theory === "completed") {
        unlockNextStepAfterExercise(target, module);
      }
    } else if (target.steps.theory === "completed") {
      unlockNextStepAfterExercise(target, module);
    }
  }

  next.updatedAt = nowIso();
  return next;
}

/**
 * Markiert den instrumentalen Praxisteil eines Moduls als abgeschlossen
 * und schaltet das einfache Abschluss-Quiz (`quiz_easy`) frei.
 * Bei Modulen mit `hasPractice === false` bleibt der Zustand unverändert.
 */
export function completePracticeStep(
  state: LearningProgressState,
  module: LearningModule,
): LearningProgressState {
  if (!module.hasPractice) {
    return state;
  }

  const existing = state.modules[module.id];
  if (
    !existing ||
    existing.status === "locked" ||
    existing.steps.practice === "locked"
  ) {
    return state;
  }

  const next = cloneState(state);
  const target = next.modules[module.id];
  target.steps.practice = "completed";
  if (target.steps.quiz_easy === "locked") {
    target.steps.quiz_easy = "unlocked";
  }

  next.updatedAt = nowIso();
  return next;
}

/**
 * Wertet einen Abschluss-Quiz- (`quiz_easy`) oder Fastlane-Versuch (`fastlane`) aus.
 * Vergibt noch nicht verdiente Modul-XP einmalig und schaltet bei Bestehen das Folgemodul frei.
 */
export function submitQuizAttempt(
  state: LearningProgressState,
  db: ModulesDatabase,
  moduleId: string,
  lane: "quiz_easy" | "fastlane",
  scorePercentage: number,
): LearningProgressState {
  const mod = db.modules.find((item) => item.id === moduleId);
  if (!mod) {
    return state;
  }

  const normalizedScore = Number.isFinite(scorePercentage)
    ? Math.max(0, Math.min(1, scorePercentage))
    : 0;
  const sortedModules = sortModulesByOrder(db.modules);
  const next = syncProgressWithCurriculum(state, sortedModules);
  const target = next.modules[moduleId];
  if (!target) {
    return state;
  }

  if (lane === "quiz_easy") {
    if (target.status === "locked" || target.steps.quiz_easy === "locked") {
      return state;
    }

    target.bestQuizEasyScore = Math.max(
      target.bestQuizEasyScore ?? 0,
      normalizedScore,
    );

    const settings = getEffectiveQuizSettings(next, db);
    if (normalizedScore >= settings.quizEasyMinScore) {
      const solvedSet = new Set(target.solvedQuestionIds);
      for (const question of db.questions) {
        if (
          question.moduleId === moduleId &&
          question.targetLane === "quiz_easy" &&
          !solvedSet.has(question.id)
        ) {
          solvedSet.add(question.id);
          target.solvedQuestionIds.push(question.id);
          creditXp(
            next,
            calculateQuestionXp(question.baseXp, question.tags),
            mod.scope,
            question.tags,
          );
        }
      }

      target.steps.quiz_easy = "completed";
      target.status = "completed";
      if (target.completedVia === undefined) {
        target.completedVia = "normal";
      }
      unlockSuccessorModule(next, sortedModules, moduleId);
    }

    next.updatedAt = nowIso();
    return next;
  }

  target.bestFastlaneScore = Math.max(
    target.bestFastlaneScore ?? 0,
    normalizedScore,
  );

  const settings = getEffectiveQuizSettings(next, db);
  if (normalizedScore >= settings.fastlaneMinScore) {
    if (target.steps.theory !== "completed") {
      const completedBlocks = new Set(target.completedTheoryBlockIds);
      for (const block of mod.theoryBlocks) {
        if (completedBlocks.has(block.id)) continue;
        completedBlocks.add(block.id);
        target.completedTheoryBlockIds.push(block.id);
        creditXp(
          next,
          calculateTheoryBlockXp(block, mod.theoryBaseXp),
          mod.scope,
          block.tags ?? [],
        );
      }
    }

    const solvedSet = new Set(target.solvedQuestionIds);
    for (const question of db.questions) {
      if (question.moduleId === moduleId && !solvedSet.has(question.id)) {
        solvedSet.add(question.id);
        target.solvedQuestionIds.push(question.id);
        creditXp(
          next,
          calculateQuestionXp(question.baseXp, question.tags),
          mod.scope,
          question.tags,
        );
      }
    }

    for (const step of LANE_STEPS) {
      target.steps[step] = "completed";
    }
    target.status = "completed";
    if (target.completedVia === undefined) {
      target.completedVia = "fastlane";
    }
    unlockSuccessorModule(next, sortedModules, moduleId);
  }

  next.updatedAt = nowIso();
  return next;
}

/** Berechnet Level, Fortschrittsprozentwerte sowie Scope- und Tag-XP für das Dashboard. */
export function getDashboardOverview(
  state: LearningProgressState,
  db: ModulesDatabase,
): DashboardOverview {
  const totalXp = Math.max(0, Math.round(state.totalXp));
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const levelProgressPercent = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

  const totalModules = db.modules.length;
  const completedModules = db.modules.filter(
    (mod) => state.modules[mod.id]?.status === "completed",
  ).length;
  const overallPercent =
    totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const xpByScope = createEmptyScopeXp();
  for (const scope of MODULE_SCOPES) {
    xpByScope[scope] = state.xpByScope[scope] ?? 0;
  }

  const xpByTag = createEmptyTagXp();
  for (const [tag, value] of Object.entries(state.xpByTag)) {
    xpByTag[tag] = value;
  }

  return {
    totalXp,
    level,
    levelProgressPercent,
    xpToNextLevel,
    completedModules,
    totalModules,
    overallPercent,
    xpByScope,
    xpByTag,
  };
}

function sanitizeStoredProgress(
  raw: unknown,
  modules: readonly LearningModule[],
): LearningProgressState | null {
  if (!isRecord(raw) || !isRecord(raw.modules)) {
    return null;
  }

  const xpByScope = createEmptyScopeXp();
  if (isRecord(raw.xpByScope)) {
    for (const scope of MODULE_SCOPES) {
      const value = raw.xpByScope[scope];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        xpByScope[scope] = value;
      }
    }
  }

  const xpByTag = createEmptyTagXp();
  if (isRecord(raw.xpByTag)) {
    for (const [tag, value] of Object.entries(raw.xpByTag)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        xpByTag[tag] = value;
      }
    }
  }

  const sanitizedModules: Record<string, ModuleProgress> = {};
  for (const [moduleId, entry] of Object.entries(raw.modules)) {
    if (!isRecord(entry) || !isRecord(entry.steps)) {
      continue;
    }

    const status: ModuleUnlockStatus =
      entry.status === "unlocked" || entry.status === "completed"
        ? entry.status
        : "locked";
    const completedVia: ModuleCompletionMode | undefined =
      entry.completedVia === "normal" || entry.completedVia === "fastlane"
        ? entry.completedVia
        : undefined;

    const steps = {
      theory: isStepState(entry.steps.theory) ? entry.steps.theory : "locked",
      exercise: isStepState(entry.steps.exercise)
        ? entry.steps.exercise
        : "locked",
      practice: isStepState(entry.steps.practice)
        ? entry.steps.practice
        : "locked",
      quiz_easy: isStepState(entry.steps.quiz_easy)
        ? entry.steps.quiz_easy
        : "locked",
    };

    const solvedQuestionIds = Array.isArray(entry.solvedQuestionIds)
      ? entry.solvedQuestionIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const completedTheoryBlockIds = Array.isArray(entry.completedTheoryBlockIds)
      ? entry.completedTheoryBlockIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];

    sanitizedModules[moduleId] = {
      moduleId,
      status,
      ...(completedVia !== undefined ? { completedVia } : {}),
      steps,
      solvedQuestionIds,
      completedTheoryBlockIds,
      ...(typeof entry.bestQuizEasyScore === "number" &&
      Number.isFinite(entry.bestQuizEasyScore)
        ? { bestQuizEasyScore: entry.bestQuizEasyScore }
        : {}),
      ...(typeof entry.bestFastlaneScore === "number" &&
      Number.isFinite(entry.bestFastlaneScore)
        ? { bestFastlaneScore: entry.bestFastlaneScore }
        : {}),
    };
  }

  const baseState: LearningProgressState = {
    totalXp:
      typeof raw.totalXp === "number" &&
      Number.isFinite(raw.totalXp) &&
      raw.totalXp >= 0
        ? raw.totalXp
        : 0,
    xpByScope,
    xpByTag,
    modules: sanitizedModules,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    ...(isQuizSettings(raw.quizSettings)
      ? { quizSettings: raw.quizSettings }
      : {}),
  };

  return syncProgressWithCurriculum(baseState, modules);
}

function isStepState(value: unknown): value is StepProgressState {
  return value === "locked" || value === "unlocked" || value === "completed";
}

function readStorageRaw(storageKey: string): string | null {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        return window.localStorage.getItem(storageKey);
      }
    } catch {
      // Fallback bei deaktiviertem oder blockiertem localStorage
    }
  }
  return memoryStorageFallback.get(storageKey) ?? null;
}

function writeStorageRaw(storageKey: string, payload: string): void {
  memoryStorageFallback.set(storageKey, payload);
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(storageKey, payload);
      }
    } catch {
      // Speicherfehler ignorieren, In-Memory-Stand bleibt erhalten
    }
  }
}

function removeStorageRaw(storageKey: string): void {
  memoryStorageFallback.delete(storageKey);
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignorieren
    }
  }
}

/** Lädt den gespeicherten Lernfortschritt SSR-sicher und gleicht ihn mit dem Curriculum ab. */
export function loadLearningProgress(
  modules: readonly LearningModule[] = [],
  storageKey: string = LEARNING_PROGRESS_STORAGE_KEY,
  quizSettings: QuizSettings = DEFAULT_QUIZ_SETTINGS,
): LearningProgressState {
  const raw = readStorageRaw(storageKey);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const restored = sanitizeStoredProgress(parsed, modules);
      if (restored) {
        const savedRevision = restored.quizSettings?.revision ?? 0;
        if (quizSettings.revision > savedRevision) {
          const reset = createInitialProgress(modules, quizSettings);
          saveLearningProgress(reset, storageKey);
          return reset;
        }
        if (!restored.quizSettings) {
          restored.quizSettings = { ...quizSettings };
          saveLearningProgress(restored, storageKey);
        }
        return restored;
      }
    } catch {
      // Ungültiges JSON fällt auf frischen Zustand zurück
    }
  }
  const initial = createInitialProgress(modules, quizSettings);
  saveLearningProgress(initial, storageKey);
  return initial;
}

/** Speichert den Lernfortschritt in `localStorage` bzw. im SSR-In-Memory-Fallback. */
export function saveLearningProgress(
  state: LearningProgressState,
  storageKey: string = LEARNING_PROGRESS_STORAGE_KEY,
): LearningProgressState {
  writeStorageRaw(storageKey, JSON.stringify(state));
  return state;
}

/** Löscht den gespeicherten Lernfortschritt vollständig. */
export function clearLearningProgress(
  storageKey: string = LEARNING_PROGRESS_STORAGE_KEY,
): void {
  removeStorageRaw(storageKey);
}
