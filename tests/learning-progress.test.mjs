import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLearningProgress,
  completePracticeStep,
  completeTheoryBlock,
  completeTheoryStep,
  createInitialProgress,
  getDashboardOverview,
  LEARNING_PROGRESS_STORAGE_KEY,
  loadLearningProgress,
  recordExerciseAnswer,
  saveLearningProgress,
  submitQuizAttempt,
  syncProgressWithCurriculum,
} from "../src/lib/learning-progress.ts";
import {
  upsertModule,
  upsertQuestion,
  createEmptyModulesDatabase,
  updateQuizSettings,
} from "../src/lib/module-store.ts";

describe("Übergreifende Quiz-Einstellungen", () => {
  afterEach(() => clearLearningProgress());

  it("setzt Lernfortschritt nur bei einer neueren Änderung zurück und ignoriert ältere Anfangsdaten", () => {
    const db = buildTestDatabase();
    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, db.modules[0], "tb-1");
    saveLearningProgress(state);
    const changed = updateQuizSettings(db, { quizEasyMinScore: 0.9, fastlaneMinScore: 0.9 });
    const reset = loadLearningProgress(db.modules, undefined, changed.quizSettings);
    expect(reset.totalXp).toBe(0);
    expect(reset.modules["mod-theory-1"].steps.theory).toBe("unlocked");
    expect(reset.quizSettings.revision).toBe(1);
    const earned = completeTheoryBlock(reset, db.modules[0], "tb-1");
    saveLearningProgress(earned);
    expect(loadLearningProgress(db.modules, undefined, changed.quizSettings).totalXp).toBe(45);
    const stale = loadLearningProgress(db.modules);
    expect(stale.totalXp).toBe(45);
    expect(stale.quizSettings.quizEasyMinScore).toBe(0.9);
  });

  it("verwendet globale statt modulspezifischer Grenzen", () => {
    const db = buildTestDatabase();
    const changed = updateQuizSettings(db, { quizEasyMinScore: 0.9, fastlaneMinScore: 0.95 });
    let state = createInitialProgress(db.modules, changed.quizSettings);
    state = submitQuizAttempt(state, changed, db.modules[0].id, "fastlane", 0.9);
    expect(state.modules[db.modules[0].id].status).not.toBe("completed");
    state = submitQuizAttempt(state, changed, db.modules[0].id, "fastlane", 0.95);
    expect(state.modules[db.modules[0].id].status).toBe("completed");
  });
});

function buildTestDatabase() {
  let db = createEmptyModulesDatabase();

  db = upsertModule(db, {
    id: "mod-theory-1",
    order: 1,
    title: "Schall & Notensystem",
    scope: "theory",
    level: 100,
    tags: ["Notensystem", "Violinschlüssel"],
    hasPractice: false,
    theoryBaseXp: 30,
    theoryBlocks: [{ id: "tb-1", order: 1, title: "Theorie", markdownContent: "", tags: ["Notensystem", "Violinschlüssel"] }],
    quizEasyMinScore: 0.8,
    fastlaneMinScore: 0.85,
  });

  db = upsertModule(db, {
    id: "mod-guitar-2",
    order: 2,
    title: "Erste Akkorde auf der Gitarre",
    scope: "instrument",
    level: 100,
    tags: ["Gitarre", "Tabulatur"],
    hasPractice: true,
    theoryBaseXp: 30,
    theoryBlocks: [{ id: "tb-2", order: 1, title: "Theorie", markdownContent: "", tags: ["Gitarre"] }],
    quizEasyMinScore: 0.8,
    fastlaneMinScore: 0.85,
  });

  db = upsertModule(db, {
    id: "mod-rhythm-3",
    order: 3,
    title: "Taktarten & Rhythmus",
    scope: "theory",
    level: 200,
    tags: ["Rhythmus"],
    hasPractice: false,
    theoryBaseXp: 30,
    theoryBlocks: [{ id: "tb-3", order: 1, title: "Theorie", markdownContent: "", tags: ["Rhythmus"] }],
  });

  // Modul 1 Aufgaben:
  // q-1: 10 * 1.5 = 15 XP
  db = upsertQuestion(db, {
    id: "q-1",
    moduleId: "mod-theory-1",
    targetLane: "exercise",
    questionType: "numeric_input",
    prompt: "Welche Frequenz hat A4?",
    correctAnswers: ["440"],
    baseXp: 10,
    tags: ["Notensystem"],
  });

  // q-2: 10 * 1.0 = 10 XP
  db = upsertQuestion(db, {
    id: "q-2",
    moduleId: "mod-theory-1",
    targetLane: "exercise",
    questionType: "single_choice",
    prompt: "Wofür steht der Violinschlüssel?",
    options: ["G4", "F3"],
    correctAnswers: ["G4"],
    baseXp: 10,
    tags: ["Violinschlüssel"],
  });

  // q-3: 15 * 1.0 = 15 XP
  db = upsertQuestion(db, {
    id: "q-3",
    moduleId: "mod-theory-1",
    targetLane: "quiz_easy",
    questionType: "single_choice",
    prompt: "Wie viele Linien hat das Notensystem?",
    options: ["4", "5"],
    correctAnswers: ["5"],
    baseXp: 15,
    tags: ["Allgemein"],
  });

  // q-4: 25 * 1.5 = 38 XP
  db = upsertQuestion(db, {
    id: "q-4",
    moduleId: "mod-theory-1",
    targetLane: "fastlane",
    questionType: "interactive_notation",
    prompt: "Setze G4 in den Violinschlüssel.",
    notationTask: { clef: "treble", expectedPitches: ["G4"] },
    baseXp: 25,
    tags: ["Notensystem"],
  });

  // Modul 2 Aufgaben:
  // q-5: 10 * 1.2 = 12 XP
  db = upsertQuestion(db, {
    id: "q-5",
    moduleId: "mod-guitar-2",
    targetLane: "exercise",
    questionType: "single_choice",
    prompt: "Wie viele Saiten hat die Standard-Gitarre?",
    options: ["5", "6"],
    correctAnswers: ["6"],
    baseXp: 10,
    tags: ["Gitarre"],
  });

  // q-6: 15 * 1.2 = 18 XP
  db = upsertQuestion(db, {
    id: "q-6",
    moduleId: "mod-guitar-2",
    targetLane: "quiz_easy",
    questionType: "numeric_input",
    prompt: "Auf welchem Bund greift man A auf der G-Saite?",
    correctAnswers: ["2"],
    baseXp: 15,
    tags: ["Gitarre"],
  });

  // q-7: 25 * 1.2 = 30 XP
  db = upsertQuestion(db, {
    id: "q-7",
    moduleId: "mod-guitar-2",
    targetLane: "fastlane",
    questionType: "single_choice",
    prompt: "Welcher Ton klingt auf der leeren A-Saite?",
    options: ["A2", "E2"],
    correctAnswers: ["A2"],
    baseXp: 25,
    tags: ["Gitarre"],
  });

  return db;
}

describe("Lernfortschritts- & XP-Engine (learning-progress)", () => {
  afterEach(() => {
    clearLearningProgress();
    vi.unstubAllGlobals();
  });

  it("vergibt Block-XP einzeln, speichert den Fortschritt und vergütet Fastlane nur offene Blöcke", () => {
    const db = buildTestDatabase();
    const mod = db.modules[0];
    mod.theoryBlocks = [
      { id: "a", order: 1, title: "A", markdownContent: "", baseXp: 20, tags: ["Rhythmus"] },
      { id: "b", order: 2, title: "B", markdownContent: "" },
    ];
    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod, "a");
    expect(state.totalXp).toBe(24);
    expect(state.xpByTag.Rhythmus).toBe(24);
    expect(state.xpByTag.Notensystem).toBe(0);
    expect(state.modules[mod.id].steps.exercise).toBe("locked");
    expect(completeTheoryBlock(state, mod, "a")).toBe(state);
    expect(completeTheoryStep(state, mod)).toBe(state);
    saveLearningProgress(state);
    state = loadLearningProgress(db.modules);
    expect(state.modules[mod.id].completedTheoryBlockIds).toEqual(["a"]);
    state = submitQuizAttempt(state, db, mod.id, "fastlane", 1);
    expect(state.totalXp).toBe(24 + 30 + 78);
    expect(state.modules[mod.id].completedTheoryBlockIds).toEqual(["a", "b"]);
    expect(completeTheoryBlock(state, mod, "b")).toBe(state);
  });

  it("vergibt bereits nach altem Modell abgeschlossene Theorie nicht erneut", () => {
    const db = buildTestDatabase();
    const state = createInitialProgress(db.modules);
    state.modules[db.modules[0].id].steps.theory = "completed";
    state.totalXp = 45;
    delete state.modules[db.modules[0].id].completedTheoryBlockIds;
    saveLearningProgress(state);
    const restored = loadLearningProgress(db.modules);
    expect(completeTheoryBlock(restored, db.modules[0], "tb-1")).toBe(restored);
    expect(submitQuizAttempt(restored, db, db.modules[0].id, "fastlane", 1).totalXp).toBe(45 + 78);
  });

  it("initialisiert Modul 1 offen und Folgemodule gesperrt und synchronisiert neue Module ohne Verlust", () => {
    const db = buildTestDatabase();
    const initial = createInitialProgress([db.modules[2], db.modules[0]]);

    expect(initial.totalXp).toBe(0);
    expect(initial.modules["mod-theory-1"].status).toBe("unlocked");
    expect(initial.modules["mod-theory-1"].steps).toEqual({
      theory: "unlocked",
      exercise: "locked",
      practice: "locked",
      quiz_easy: "locked",
    });
    expect(initial.modules["mod-rhythm-3"].status).toBe("locked");

    const afterTheory = completeTheoryBlock(initial, db.modules[0], "tb-1");
    const synced = syncProgressWithCurriculum(afterTheory, db.modules);

    expect(synced.modules["mod-theory-1"].steps.theory).toBe("completed");
    expect(synced.modules["mod-theory-1"].steps.exercise).toBe("unlocked");
    expect(synced.modules["mod-guitar-2"].status).toBe("locked");
    expect(synced.modules["mod-rhythm-3"].status).toBe("locked");
    expect(synced.totalXp).toBe(45);
  });

  it("durchläuft Normal Lane für ein reines Theorie-Modul (überspringt practice und schaltet Modul 2 frei)", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];
    const q1 = db.questions.find((q) => q.id === "q-1");
    const q2 = db.questions.find((q) => q.id === "q-2");
    expect(mod1.hasPractice).toBe(false);
    if (!q1 || !q2) throw new Error("Testaufgaben fehlen");

    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod1, "tb-1");
    expect(state.totalXp).toBe(45); // 30 * 1.5
    expect(state.modules[mod1.id].steps.exercise).toBe("unlocked");

    // Erste Aufgabe gelöst, zweite noch offen -> exercise bleibt unlocked
    state = recordExerciseAnswer(state, mod1, q1, true, db.questions);
    expect(state.totalXp).toBe(60); // +15
    expect(state.modules[mod1.id].steps.exercise).toBe("unlocked");
    expect(state.modules[mod1.id].steps.quiz_easy).toBe("locked");

    // Zweite Aufgabe gelöst -> überspringt practice direkt zu quiz_easy
    state = recordExerciseAnswer(state, mod1, q2, true, db.questions);
    expect(state.totalXp).toBe(70); // +10
    expect(state.modules[mod1.id].steps.exercise).toBe("completed");
    expect(state.modules[mod1.id].steps.practice).toBe("locked");
    expect(state.modules[mod1.id].steps.quiz_easy).toBe("unlocked");

    // Zu niedriger Quiz-Score (< 0.80) schaltet Modul 2 noch nicht frei
    state = submitQuizAttempt(state, db, mod1.id, "quiz_easy", 0.75);
    expect(state.modules[mod1.id].status).toBe("unlocked");
    expect(state.modules[mod1.id].bestQuizEasyScore).toBe(0.75);
    expect(state.modules["mod-guitar-2"].status).toBe("locked");

    // Bestandenes Abschluss-Quiz (>= 0.80) schaltet Modul 2 frei
    state = submitQuizAttempt(state, db, mod1.id, "quiz_easy", 0.8);
    expect(state.totalXp).toBe(85); // +15 für q-3
    expect(state.modules[mod1.id].steps.quiz_easy).toBe("completed");
    expect(state.modules[mod1.id].status).toBe("completed");
    expect(state.modules[mod1.id].completedVia).toBe("normal");
    expect(state.modules["mod-guitar-2"].status).toBe("unlocked");
    expect(state.modules["mod-guitar-2"].steps.theory).toBe("unlocked");
  });

  it("erzwingt bei Instrumenten-Modulen (hasPractice: true) den Praxisschritt vor quiz_easy", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];
    const mod2 = db.modules[1];
    const q5 = db.questions.find((q) => q.id === "q-5");
    if (!q5) throw new Error("Testaufgabe q-5 fehlt");

    let state = createInitialProgress(db.modules);
    state = submitQuizAttempt(state, db, mod1.id, "fastlane", 0.9);
    expect(state.modules[mod2.id].status).toBe("unlocked");

    // completePracticeStep bleibt bei reinen Theorie-Modulen wirkungslos
    expect(completePracticeStep(state, mod1)).toBe(state);

    state = completeTheoryBlock(state, mod2, "tb-2");
    state = recordExerciseAnswer(state, mod2, q5, true, db.questions);

    expect(state.modules[mod2.id].steps.exercise).toBe("completed");
    expect(state.modules[mod2.id].steps.practice).toBe("unlocked");
    expect(state.modules[mod2.id].steps.quiz_easy).toBe("locked");

    state = completePracticeStep(state, mod2);
    expect(state.modules[mod2.id].steps.practice).toBe("completed");
    expect(state.modules[mod2.id].steps.quiz_easy).toBe("unlocked");
  });

  it("verhindert doppelte XP bei wiederholtem Lösen desselben Schritts oder derselben Aufgabe", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];
    const q1 = db.questions.find((q) => q.id === "q-1");
    if (!q1) throw new Error("Testaufgabe q-1 fehlt");

    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod1, "tb-1");
    state = completeTheoryBlock(state, mod1, "tb-1");
    expect(state.totalXp).toBe(45);

    state = recordExerciseAnswer(state, mod1, q1, false);
    expect(state.totalXp).toBe(45);

    state = recordExerciseAnswer(state, mod1, q1, true);
    state = recordExerciseAnswer(state, mod1, q1, true);
    expect(state.totalXp).toBe(60);
    expect(state.modules[mod1.id].solvedQuestionIds).toEqual(["q-1"]);

    // Über quiz_easy wird bereits gelöstes q-1 nicht doppelt bezahlt
    state = completeTheoryStep(state, mod1);
    state = submitQuizAttempt(state, db, mod1.id, "quiz_easy", 1.0);
    const xpAfterFirstQuiz = state.totalXp;
    state = submitQuizAttempt(state, db, mod1.id, "quiz_easy", 1.0);
    expect(state.totalXp).toBe(xpAfterFirstQuiz);
  });

  it("schreibt bei Fastlane-Erfolg (>= 85 %) nach erledigter Theorie nur die offenen XP gut und schaltet das Folgemodul frei", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];

    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod1, "tb-1");
    expect(state.totalXp).toBe(45);

    // Offene Aufgaben von Modul 1: q-1 (15) + q-2 (10) + q-3 (15) + q-4 (38) = 78 XP
    state = submitQuizAttempt(state, db, mod1.id, "fastlane", 0.85);
    expect(state.totalXp).toBe(123); // 45 + 78 (ohne doppelte Theorie-XP)
    expect(state.modules[mod1.id].status).toBe("completed");
    expect(state.modules[mod1.id].completedVia).toBe("fastlane");
    expect(state.modules[mod1.id].bestFastlaneScore).toBe(0.85);
    expect(state.modules[mod1.id].steps).toEqual({
      theory: "completed",
      exercise: "completed",
      practice: "completed",
      quiz_easy: "completed",
    });
    expect(state.modules["mod-guitar-2"].status).toBe("unlocked");

    // Fastlane funktioniert auch direkt auf einem noch gesperrten Modul (mod-rhythm-3)
    state = submitQuizAttempt(state, db, "mod-rhythm-3", "fastlane", 0.9);
    expect(state.modules["mod-rhythm-3"].status).toBe("completed");
    expect(state.modules["mod-rhythm-3"].completedVia).toBe("fastlane");
  });

  it("verweigert bei Fastlane-Misserfolg (< 85 %) XP-Gutschrift und Freischaltung", () => {
    const db = buildTestDatabase();
    const initial = createInitialProgress(db.modules);

    const failed = submitQuizAttempt(
      initial,
      db,
      "mod-guitar-2",
      "fastlane",
      0.84,
    );

    expect(failed.totalXp).toBe(0);
    expect(failed.modules["mod-guitar-2"].status).toBe("locked");
    expect(failed.modules["mod-guitar-2"].bestFastlaneScore).toBe(0.84);
    expect(failed.modules["mod-guitar-2"].completedVia).toBeUndefined();
    expect(failed.modules["mod-rhythm-3"].status).toBe("locked");
  });

  it("berechnet Dashboard-Kennzahlen korrekt und persistiert SSR-sicher", () => {
    const db = buildTestDatabase();
    let state = createInitialProgress(db.modules);

    const emptyOverview = getDashboardOverview(state, db);
    expect(emptyOverview).toEqual({
      totalXp: 0,
      level: 1,
      levelProgressPercent: 0,
      xpToNextLevel: 500,
      completedModules: 0,
      totalModules: 3,
      overallPercent: 0,
      xpByScope: {
        theory: 0,
        instrument: 0,
        production: 0,
        band: 0,
      },
      xpByTag: {
        Allgemein: 0,
        Notensystem: 0,
        Violinschlüssel: 0,
        Bassschlüssel: 0,
        Tabulatur: 0,
        Gitarre: 0,
        Rhythmus: 0,
      },
    });

    state = submitQuizAttempt(state, db, "mod-theory-1", "fastlane", 1.0); // 123 XP
    const boostedState = {
      ...state,
      totalXp: 625,
    };

    const overview = getDashboardOverview(boostedState, db);
    expect(overview.level).toBe(2);
    expect(overview.levelProgressPercent).toBe(25);
    expect(overview.xpToNextLevel).toBe(375);
    expect(overview.completedModules).toBe(1);
    expect(overview.totalModules).toBe(3);
    expect(overview.overallPercent).toBe(33);
    expect(overview.xpByScope.theory).toBe(123);
    expect(overview.xpByTag.Notensystem).toBe(98); // 45 (Theory) + 15 (q-1) + 38 (q-4)

    // Persistenz in localStorage
    saveLearningProgress(state);
    expect(window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)).not.toBeNull();
    const reloaded = loadLearningProgress(db.modules);
    expect(reloaded.totalXp).toBe(123);
    expect(reloaded.modules["mod-theory-1"].status).toBe("completed");

    // SSR-Fallback ohne window
    vi.stubGlobal("window", undefined);
    const ssrState = createInitialProgress(db.modules);
    saveLearningProgress(ssrState, "ssr_test_key");
    const ssrLoaded = loadLearningProgress(db.modules, "ssr_test_key");
    expect(ssrLoaded.modules["mod-theory-1"].status).toBe("unlocked");
  });
});
