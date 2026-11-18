import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLearningProgress,
  completePracticeBlock,
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
import { getAvailableTags } from "../src/lib/xp-tags.ts";

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
    state = submitQuizAttempt(state, changed, db.modules[0].id, "schwer", 0.9);
    expect(state.modules[db.modules[0].id].status).not.toBe("completed");
    state = submitQuizAttempt(state, changed, db.modules[0].id, "schwer", 0.95);
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
    theoryBaseXp: 30,
    theoryBlocks: [{ id: "tb-2", order: 1, title: "Theorie", markdownContent: "", tags: ["Gitarre"] }],
    practiceBlocks: [{ id: "pb-2", title: "Akkord greifen", markdownContent: "", tags: ["Gitarre"] }],
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
    theoryBaseXp: 30,
    theoryBlocks: [{ id: "tb-3", order: 1, title: "Theorie", markdownContent: "", tags: ["Rhythmus"] }],
  });

  // Modul 1 Aufgaben:
  // q-1: 10 * 1.5 = 15 XP
  db = upsertQuestion(db, {
    id: "q-1",
    moduleIds: ["mod-theory-1"],
    targetLane: "leicht",
    questionType: "numeric_input",
    prompt: "Welche Frequenz hat A4?",
    correctAnswers: ["440"],
    baseXp: 10,
    tags: ["Notensystem"],
  });

  // q-2: 10 * 1.0 = 10 XP
  db = upsertQuestion(db, {
    id: "q-2",
    moduleIds: ["mod-theory-1"],
    targetLane: "leicht",
    questionType: "single_choice",
    prompt: "Wofür steht der Violinschlüssel?",
    options: ["G4", "F3"],
    correctAnswers: ["G4"],
    baseXp: 10,
    tags: ["Violinschlüssel"],
  });

  // q-3: 10 * 1.5 * 1.0 = 15 XP
  db = upsertQuestion(db, {
    id: "q-3",
    moduleIds: ["mod-theory-1"],
    targetLane: "mittel",
    difficulty: "mittel",
    questionType: "single_choice",
    prompt: "Wie viele Linien hat das Notensystem?",
    options: ["4", "5"],
    correctAnswers: ["5"],
    baseXp: 10,
    tags: ["Allgemein"],
  });

  // q-4: 10 * 2 * 1.5 = 30 XP
  db = upsertQuestion(db, {
    id: "q-4",
    moduleIds: ["mod-theory-1"],
    targetLane: "schwer",
    difficulty: "schwer",
    questionType: "interactive_notation",
    prompt: "Setze G4 in den Violinschlüssel.",
    notationTask: { clef: "treble", expectedPitches: ["G4"] },
    baseXp: 10,
    tags: ["Notensystem"],
  });

  // Modul 2 Aufgaben:
  // q-5: 10 * 1.2 = 12 XP
  db = upsertQuestion(db, {
    id: "q-5",
    moduleIds: ["mod-guitar-2"],
    targetLane: "leicht",
    questionType: "single_choice",
    prompt: "Wie viele Saiten hat die Standard-Gitarre?",
    options: ["5", "6"],
    correctAnswers: ["6"],
    baseXp: 10,
    tags: ["Gitarre"],
  });

  // q-6: 10 * 1.5 * 1.2 = 18 XP
  db = upsertQuestion(db, {
    id: "q-6",
    moduleIds: ["mod-guitar-2"],
    targetLane: "mittel",
    difficulty: "mittel",
    questionType: "numeric_input",
    prompt: "Auf welchem Bund greift man A auf der G-Saite?",
    correctAnswers: ["2"],
    baseXp: 10,
    tags: ["Gitarre"],
  });

  // q-7: 10 * 2 * 1.2 = 24 XP
  db = upsertQuestion(db, {
    id: "q-7",
    moduleIds: ["mod-guitar-2"],
    targetLane: "schwer",
    difficulty: "schwer",
    questionType: "single_choice",
    prompt: "Welcher Ton klingt auf der leeren A-Saite?",
    options: ["A2", "E2"],
    correctAnswers: ["A2"],
    baseXp: 10,
    tags: ["Gitarre"],
  });

  return db;
}

describe("Lernfortschritts- & XP-Engine (learning-progress)", () => {
  afterEach(() => {
    clearLearningProgress();
    vi.unstubAllGlobals();
  });

  it("vergütet eine schwere Lernpfad-Aufgabe mit festen Basis-XP und Tag-Faktor genau einmal", () => {
    const db = buildTestDatabase();
    const mod = db.modules[0];
    const question = { ...db.questions[0], difficulty: "schwer", baseXp: 99 };
    const initial = createInitialProgress(db.modules);
    const solved = recordExerciseAnswer(initial, mod, question, true, db.questions);
    expect(solved.totalXp).toBe(30);
    expect(recordExerciseAnswer(solved, mod, question, true, db.questions).totalXp).toBe(30);
  });

  it("vergibt Übungs-XP vor Theorieabschluss, schaltet das Quiz aber erst nach allen Inhalten frei", () => {
    const db = buildTestDatabase();
    const mod = db.modules[0];
    const q1 = db.questions.find((question) => question.id === "q-1");
    const q2 = db.questions.find((question) => question.id === "q-2");
    let state = createInitialProgress(db.modules);
    state = recordExerciseAnswer(state, mod, q1, true, db.questions);
    state = recordExerciseAnswer(state, mod, q2, true, db.questions);
    expect(state.totalXp).toBe(25);
    expect(state.modules[mod.id].steps.leicht).toBe("unlocked");
    expect(state.modules[mod.id].steps.mittel).toBe("locked");
    state = completeTheoryBlock(state, mod, "tb-1", db.questions);
    expect(state.totalXp).toBe(70);
    expect(state.modules[mod.id].steps.leicht).toBe("completed");
    expect(state.modules[mod.id].steps.mittel).toBe("unlocked");
    expect(recordExerciseAnswer(state, mod, q1, true, db.questions).totalXp).toBe(70);
  });

  it("verlangt für Aufgabeneinleitungen keinen Abschluss und vergibt dafür keine XP", () => {
    const db = buildTestDatabase();
    const mod = db.modules[0];
    mod.theoryBlocks.push({
      id: "intro", order: 2, title: "Einleitung", markdownContent: "",
      role: "exercise_intro", baseXp: 100, tags: ["Notensystem"],
    });
    const initial = createInitialProgress(db.modules);
    expect(completeTheoryBlock(initial, mod, "intro", db.questions)).toBe(initial);
    const state = completeTheoryBlock(initial, mod, "tb-1", db.questions);
    expect(state.modules[mod.id].steps.theory).toBe("completed");
    expect(state.modules[mod.id].completedTheoryBlockIds).toEqual(["tb-1"]);
    expect(state.totalXp).toBe(45);

    const fastlane = submitQuizAttempt(initial, db, mod.id, "schwer", 1);
    expect(fastlane.modules[mod.id].completedTheoryBlockIds).toEqual(["tb-1"]);
    const withoutIntroduction = structuredClone(db);
    withoutIntroduction.modules[0].theoryBlocks.pop();
    expect(fastlane.totalXp).toBe(
      submitQuizAttempt(initial, withoutIntroduction, mod.id, "schwer", 1).totalXp,
    );
  });

  it("schaltet ohne Übungen nach der Theorie direkt den Praxisteil frei", () => {
    const db = buildTestDatabase();
    const mod = {
      ...db.modules[0],
      practiceBlocks: [{ id: "pb-1", title: "Üben", markdownContent: "" }],
    };
    const state = completeTheoryBlock(
      createInitialProgress([mod]), mod, "tb-1", [],
    );
    expect(state.modules[mod.id].steps.leicht).toBe("completed");
    expect(state.modules[mod.id].steps.practice).toBe("unlocked");
    expect(state.modules[mod.id].steps.mittel).toBe("locked");
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
    expect(state.modules[mod.id].steps.leicht).toBe("locked");
    expect(completeTheoryBlock(state, mod, "a")).toBe(state);
    expect(completeTheoryStep(state, mod)).toBe(state);
    saveLearningProgress(state);
    state = loadLearningProgress(db.modules);
    expect(state.modules[mod.id].completedTheoryBlockIds).toEqual(["a"]);
    state = submitQuizAttempt(state, db, mod.id, "schwer", 1);
    expect(state.totalXp).toBe(24 + 30 + 70);
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
    expect(submitQuizAttempt(restored, db, db.modules[0].id, "schwer", 1).totalXp).toBe(45 + 70);
  });

  it("initialisiert Modul 1 offen und Folgemodule gesperrt und synchronisiert neue Module ohne Verlust", () => {
    const db = buildTestDatabase();
    const initial = createInitialProgress([db.modules[2], db.modules[0]]);

    expect(initial.totalXp).toBe(0);
    expect(initial.modules["mod-theory-1"].status).toBe("unlocked");
    expect(initial.modules["mod-theory-1"].steps).toEqual({
      theory: "unlocked",
      leicht: "locked",
      practice: "locked",
      mittel: "locked",
    });
    expect(initial.modules["mod-rhythm-3"].status).toBe("locked");

    const afterTheory = completeTheoryBlock(initial, db.modules[0], "tb-1");
    const synced = syncProgressWithCurriculum(afterTheory, db.modules);

    expect(synced.modules["mod-theory-1"].steps.theory).toBe("completed");
    expect(synced.modules["mod-theory-1"].steps.leicht).toBe("unlocked");
    expect(synced.modules["mod-guitar-2"].status).toBe("locked");
    expect(synced.modules["mod-rhythm-3"].status).toBe("locked");
    expect(synced.totalXp).toBe(45);
  });

  it("durchläuft Normal Lane für ein reines Theorie-Modul (überspringt practice und schaltet Modul 2 frei)", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];
    const q1 = db.questions.find((q) => q.id === "q-1");
    const q2 = db.questions.find((q) => q.id === "q-2");
    expect(mod1.practiceBlocks).toEqual([]);
    if (!q1 || !q2) throw new Error("Testaufgaben fehlen");

    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod1, "tb-1");
    expect(state.totalXp).toBe(45); // 30 * 1.5
    expect(state.modules[mod1.id].steps.leicht).toBe("unlocked");

    // Erste Aufgabe gelöst, zweite noch offen -> exercise bleibt unlocked
    state = recordExerciseAnswer(state, mod1, q1, true, db.questions);
    expect(state.totalXp).toBe(60); // +15
    expect(state.modules[mod1.id].steps.leicht).toBe("unlocked");
    expect(state.modules[mod1.id].steps.mittel).toBe("locked");

    // Zweite Aufgabe gelöst -> überspringt practice direkt zu mittel
    state = recordExerciseAnswer(state, mod1, q2, true, db.questions);
    expect(state.totalXp).toBe(70); // +10
    expect(state.modules[mod1.id].steps.leicht).toBe("completed");
    expect(state.modules[mod1.id].steps.practice).toBe("locked");
    expect(state.modules[mod1.id].steps.mittel).toBe("unlocked");

    // Zu niedriger Quiz-Score (< 0.80) schaltet Modul 2 noch nicht frei
    state = submitQuizAttempt(state, db, mod1.id, "mittel", 0.75);
    expect(state.modules[mod1.id].status).toBe("unlocked");
    expect(state.modules[mod1.id].bestQuizEasyScore).toBe(0.75);
    expect(state.modules["mod-guitar-2"].status).toBe("locked");

    // Bestandenes Abschluss-Quiz (>= 0.80) schaltet Modul 2 frei
    state = submitQuizAttempt(state, db, mod1.id, "mittel", 0.8);
    expect(state.totalXp).toBe(85); // +15 für q-3
    expect(state.modules[mod1.id].steps.mittel).toBe("completed");
    expect(state.modules[mod1.id].status).toBe("completed");
    expect(state.modules[mod1.id].completedVia).toBe("normal");
    expect(state.modules["mod-guitar-2"].status).toBe("unlocked");
    expect(state.modules["mod-guitar-2"].steps.theory).toBe("unlocked");
  });

  it("erzwingt bei Instrumenten-Modulen (Praxisaufgaben) den Praxisschritt vor mittel", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];
    const mod2 = db.modules[1];
    const q5 = db.questions.find((q) => q.id === "q-5");
    if (!q5) throw new Error("Testaufgabe q-5 fehlt");

    let state = createInitialProgress(db.modules);
    state = submitQuizAttempt(state, db, mod1.id, "schwer", 0.9);
    expect(state.modules[mod2.id].status).toBe("unlocked");

    // Unbekannte Praxisaufgaben bleiben wirkungslos
    expect(completePracticeBlock(state, mod1, "pb-x")).toBe(state);

    state = completeTheoryBlock(state, mod2, "tb-2");
    state = recordExerciseAnswer(state, mod2, q5, true, db.questions);

    expect(state.modules[mod2.id].steps.leicht).toBe("completed");
    expect(state.modules[mod2.id].steps.practice).toBe("unlocked");
    expect(state.modules[mod2.id].steps.mittel).toBe("locked");

    const xpBefore = state.totalXp;
    state = completePracticeBlock(state, mod2, "pb-2");
    expect(state.totalXp).toBe(xpBefore + 24); // 20 * 1.2
    expect(state.modules[mod2.id].steps.practice).toBe("completed");
    expect(state.modules[mod2.id].steps.mittel).toBe("unlocked");
    expect(completePracticeBlock(state, mod2, "pb-2")).toBe(state);
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

    // Über mittel wird bereits gelöstes q-1 nicht doppelt bezahlt
    state = completeTheoryStep(state, mod1);
    state = submitQuizAttempt(state, db, mod1.id, "mittel", 1.0);
    const xpAfterFirstQuiz = state.totalXp;
    state = submitQuizAttempt(state, db, mod1.id, "mittel", 1.0);
    expect(state.totalXp).toBe(xpAfterFirstQuiz);
  });

  it("schreibt bei Fastlane-Erfolg (>= 85 %) nach erledigter Theorie nur die offenen XP gut und schaltet das Folgemodul frei", () => {
    const db = buildTestDatabase();
    const mod1 = db.modules[0];

    let state = createInitialProgress(db.modules);
    state = completeTheoryBlock(state, mod1, "tb-1");
    expect(state.totalXp).toBe(45);

    // Offene Aufgaben von Modul 1: q-1 (15) + q-2 (10) + q-3 (15) + q-4 (30) = 70 XP
    state = submitQuizAttempt(state, db, mod1.id, "schwer", 0.85);
    expect(state.totalXp).toBe(115); // 45 + 70 (ohne doppelte Theorie-XP)
    expect(state.modules[mod1.id].status).toBe("completed");
    expect(state.modules[mod1.id].completedVia).toBe("fastlane");
    expect(state.modules[mod1.id].bestFastlaneScore).toBe(0.85);
    expect(state.modules[mod1.id].steps).toEqual({
      theory: "completed",
      leicht: "completed",
      practice: "completed",
      mittel: "completed",
    });
    expect(state.modules["mod-guitar-2"].status).toBe("unlocked");

    // Fastlane funktioniert auch direkt auf einem noch gesperrten Modul (mod-rhythm-3)
    state = submitQuizAttempt(state, db, "mod-rhythm-3", "schwer", 0.9);
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
      "schwer",
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
      xpByTag: Object.fromEntries(getAvailableTags().map((tag) => [tag, 0])),
    });

    state = submitQuizAttempt(state, db, "mod-theory-1", "schwer", 1.0); // 115 XP
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
    expect(overview.xpByScope.theory).toBe(115);
    expect(overview.xpByTag.Notensystem).toBe(90); // 45 (Theory) + 15 (q-1) + 30 (q-4)

    // Persistenz in localStorage
    saveLearningProgress(state);
    expect(window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)).not.toBeNull();
    const reloaded = loadLearningProgress(db.modules);
    expect(reloaded.totalXp).toBe(115);
    expect(reloaded.modules["mod-theory-1"].status).toBe("completed");

    // SSR-Fallback ohne window
    vi.stubGlobal("window", undefined);
    const ssrState = createInitialProgress(db.modules);
    saveLearningProgress(ssrState, "ssr_test_key");
    const ssrLoaded = loadLearningProgress(db.modules, "ssr_test_key");
    expect(ssrLoaded.modules["mod-theory-1"].status).toBe("unlocked");
  });
});
