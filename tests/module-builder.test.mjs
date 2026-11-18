// @vitest-environment node
import { getStore } from "@netlify/blobs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import modulesHandler from "../netlify/functions/modules.ts";
import * as moduleArchive from "../src/lib/module-archive.ts";
import { mockBlobStore } from "./fixtures/blob-store.ts";
import {
  DEFAULT_FASTLANE_MIN_SCORE,
  DEFAULT_QUIZ_EASY_MIN_SCORE,
  getLearningCatalog,
  normalizeLegacyDatabase,
} from "../src/lib/module-schema.ts";
import {
  createEmptyModulesDatabase,
  deleteModule,
  deleteQuestion,
  getModuleSummary,
  moveModule,
  upsertModule,
  upsertQuestion,
  validateModuleInput,
  validateQuestionInput,
} from "../src/lib/module-store.ts";
import {
  BASE_XP_DEFAULTS,
  calculateQuestionXp,
  calculateModuleQuestionXp,
  getAvailableTags,
  TAG_DEFINITIONS,
} from "../src/lib/xp-tags.ts";

describe("xp-tags Konfiguration & Berechnung", () => {
  it("liefert zentrale Basis-EXP und Tag-Liste", () => {
    expect(BASE_XP_DEFAULTS).toEqual({
      theoryBlock: 30,
      practice: 20,
      leicht: 10,
      mittel: 10,
      schwer: 10,
    });
    expect(getAvailableTags()).toEqual(
      expect.arrayContaining([
        "Allgemein",
        "Notensystem",
        "Violinschlüssel",
        "Bassschlüssel",
        "Tabulatur",
        "Gitarre",
        "Rhythmus",
      ]),
    );
    expect(TAG_DEFINITIONS.Notensystem.multiplier).toBe(1.5);
  });

  it("berechnet Fragen-XP mit Multiplikator und Multi-Tag-Strategien", () => {
    expect(calculateQuestionXp(10, ["Notensystem"])).toBe(15);
    expect(calculateQuestionXp(20, ["Allgemein", "Notensystem"])).toBe(30);
    expect(
      calculateQuestionXp(20, ["Allgemein", "Notensystem"], "average"),
    ).toBe(25);
    expect(calculateQuestionXp(15, [])).toBe(15);
    expect(calculateQuestionXp(15, ["Unbekannt"])).toBe(15);
    expect(calculateQuestionXp(0, ["Notensystem"])).toBe(0);
  });

  it.each([
    ["Tonsystem", 11],
    ["Vortragslehre", 11],
    ["Harmonielehre", 12],
  ])("liefert für %s bei 10 Basis-XP %i XP", (tag, xp) => {
    expect(getAvailableTags()).toContain(tag);
    expect(calculateQuestionXp(10, [tag])).toBe(xp);
  });

  it.each([
    [undefined, [], 10],
    ["einfach", ["Notensystem"], 15],
    ["mittel", ["Notensystem"], 23],
    ["schwer", ["Notensystem", "Rhythmus"], 30],
  ])("berechnet Aufgaben mit Schwierigkeit %s und Tag-Faktor", (difficulty, tags, xp) => {
    expect(calculateModuleQuestionXp({ baseXp: 99, difficulty, tags })).toBe(xp);
  });
});

describe("module-store Validierung & Store-Operationen", () => {
  it("normalisiert bestehende Aufgaben auf 10 Basis-XP und erhält die Schwierigkeit unabhängig von der Lernspur", () => {
    const db = upsertModule(createEmptyModulesDatabase(), { id: "mod", title: "Modul" });
    const question = {
      id: "q", moduleIds: ["mod"], targetLane: "leicht",
      questionType: "numeric_input", prompt: "Frage", correctAnswers: ["1"],
      difficulty: "schwer", baseXp: 99, tags: ["Rhythmus"],
    };
    const saved = upsertQuestion(db, question);
    expect(saved.questions[0]).toMatchObject({ difficulty: "schwer", baseXp: 10, targetLane: "leicht" });
    expect(getModuleSummary(saved, "mod")?.questionsXp).toBe(24);
    const { difficulty, ...legacy } = question;
    const normalized = normalizeLegacyDatabase({ ...db, questions: [legacy] });
    expect(normalized.questions[0]).toMatchObject({ difficulty: "einfach", baseXp: 10 });
    expect(upsertQuestion(saved, legacy).questions[0].difficulty).toBe("schwer");
    expect(validateQuestionInput({ ...question, difficulty: "unbekannt" }, db).valid).toBe(false);
    expect(() => normalizeLegacyDatabase({ ...db, questions: [{ ...question, difficulty: "unbekannt" }] }))
      .toThrow("Ungültige Schwierigkeit");
  });
  it("behält das Blocklager beim Speichern und trennt es vom Lern- und Quizangebot", () => {
    let db = upsertModule(createEmptyModulesDatabase(), { id: "basics", title: "Basics" });
    db = upsertModule(db, { id: "lager", title: "Blocklager", archived: true });
    db = upsertModule(db, { id: "lager", title: "Blocklager bearbeitet" });
    const question = {
      targetLane: "mittel",
      questionType: "single_choice",
      prompt: "Eine Frage?",
      options: ["Ja", "Nein"],
      correctAnswers: ["Ja"],
    };
    for (const [id, moduleIds] of [
      ["lagerfrage", ["lager"]],
      ["geteilt", ["basics", "lager"]],
      ["pool", []],
    ]) {
      db = upsertQuestion(db, { ...question, id, moduleIds });
    }

    expect(db.modules[1].archived).toBe(true);
    const learning = getLearningCatalog(db);
    expect(learning.modules.map(({ id }) => id)).toEqual(["basics"]);
    expect(learning.questions.map(({ id, moduleIds }) => [id, moduleIds]))
      .toEqual([["geteilt", ["basics"]], ["pool", []]]);
    expect(db.questions).toHaveLength(3);
    expect(getLearningCatalog(upsertModule(db, { id: "lager", title: "Lager", archived: false })).modules)
      .toHaveLength(2);
  });
  const sourceMarker = (number) => `[${"cite"}: ${number}]`;

  it("speichert Aufgabentitel getrennt von der Frage und erlaubt ihr Entfernen", () => {
    const db = upsertModule(createEmptyModulesDatabase(), { id: "mod", title: "Modul" });
    const question = {
      id: "q", moduleIds: ["mod"], targetLane: "leicht",
      questionType: "numeric_input", prompt: "Frage", correctAnswers: ["1"],
    };
    expect(validateQuestionInput({ ...question, title: 1 }, db).valid).toBe(false);
    const titled = upsertQuestion(db, { ...question, title: ` Kammerton ${sourceMarker(1)} ` });
    expect(titled.questions[0]).toMatchObject({ title: "Kammerton", prompt: "Frage" });
    expect(upsertQuestion(titled, question).questions[0].title).toBe("Kammerton");
    expect(upsertQuestion(titled, { ...question, title: "" }).questions[0])
      .not.toHaveProperty("title");
  });

  it("speichert optionale Aufgabenhinweise und erlaubt ihr Entfernen", () => {
    const db = upsertModule(createEmptyModulesDatabase(), { id: "mod", title: "Modul" });
    const question = {
      id: "q", moduleIds: ["mod"], targetLane: "leicht",
      questionType: "numeric_input", prompt: "Frage", correctAnswers: ["1"],
    };
    expect(validateQuestionInput({ ...question, simpleHint: 1 }, db).valid).toBe(false);
    const withHints = upsertQuestion(db, {
      ...question, simpleHint: " Einfach ", strongHint: "Genauer",
    });
    expect(withHints.questions[0]).toMatchObject({ simpleHint: "Einfach", strongHint: "Genauer" });
    const updated = upsertQuestion(withHints, { ...question, simpleHint: "" });
    expect(updated.questions[0]).not.toHaveProperty("simpleHint");
    expect(updated.questions[0].strongHint).toBe("Genauer");
  });

  it("speichert explizite Voraussetzungen und erhält sie bei Teiländerungen", () => {
    const empty = createEmptyModulesDatabase();
    const db = upsertModule(empty, { id: "elementarlehre", title: "Elementarlehre" });
    expect(db.modules[0]).not.toHaveProperty("prerequisiteModuleIds");

    const guitar = { id: "gitarre", title: "Gitarre" };
    const withPrerequisite = upsertModule(db, {
      ...guitar,
      prerequisiteModuleIds: [" elementarlehre "],
    });
    expect(upsertModule(withPrerequisite, guitar).modules[1].prerequisiteModuleIds)
      .toEqual(["elementarlehre"]);
    expect(upsertModule(withPrerequisite, { ...guitar, prerequisiteModuleIds: [] })
      .modules[1].prerequisiteModuleIds).toEqual([]);
  });

  it.each([
    { prerequisiteModuleIds: "elementarlehre" },
    { prerequisiteModuleIds: [" "] },
    { prerequisiteModuleIds: ["a", " a "] },
    { prerequisiteModuleIds: [" gitarre "] },
  ])(
    "weist ungültige Voraussetzungen ab: $prerequisiteModuleIds",
    ({ prerequisiteModuleIds }) => {
      expect(validateModuleInput({ id: "gitarre", title: "Gitarre", prerequisiteModuleIds }).valid)
        .toBe(false);
    },
  );

  it("speichert die gemischte Blockreihenfolge und bewahrt sie bei Teiländerungen", () => {
    const order = [{ kind: "theory", id: "tb" }, { kind: "exercise", id: "q" }];
    let db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod", title: "Modul", contentOrder: order,
    });
    order[0].id = "changed";
    expect(db.modules[0].contentOrder).toEqual([
      { kind: "theory", id: "tb" }, { kind: "exercise", id: "q" },
    ]);
    db = upsertModule(db, { id: "mod", title: "Neu" });
    expect(db.modules[0].contentOrder).toHaveLength(2);
    expect(validateModuleInput({ id: "mod", title: "Modul", contentOrder: [{ kind: "theory", id: "x" }, { kind: "theory", id: "x" }] }).valid).toBe(false);
    expect(validateModuleInput({ id: "mod", title: "Modul", contentOrder: [{ kind: "quiz", id: "x" }] }).valid).toBe(false);
  });

  it("entfernt Quellenmarker aus Modul- und Aufgabentexten beim Speichern", () => {
    let db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod",
      title: `Modul ${sourceMarker(1)}`,
      description: `Beschreibung ${sourceMarker(2)}`,
      theoryBlocks: [{
        id: "tb",
        order: 1,
        title: `Theorie ${sourceMarker(3)}`,
        markdownContent: `Text ${sourceMarker(4)} weiter`,
      }],
      practiceBlocks: [{
        id: "pb",
        title: `Praxis ${sourceMarker(5)}`,
        markdownContent: `Übung ${sourceMarker(6)} weiter`,
      }],
    });

    expect(db.modules[0]).toMatchObject({
      title: "Modul",
      description: "Beschreibung",
    });
    expect(db.modules[0].theoryBlocks[0]).toMatchObject({
      title: "Theorie",
      markdownContent: "Text weiter",
    });
    expect(db.modules[0].practiceBlocks[0]).toMatchObject({
      title: "Praxis",
      markdownContent: "Übung weiter",
    });

    db = upsertQuestion(db, {
      id: "q",
      moduleIds: [],
      targetLane: "mittel",
      questionType: "numeric_input",
      prompt: `Frage ${sourceMarker(7)}`,
      correctAnswers: [`Antwort ${sourceMarker(8)}`],
      explanation: `Erklärung ${sourceMarker(9)}`,
    });
    expect(db.questions[0]).toMatchObject({
      prompt: "Frage",
      correctAnswers: ["Antwort"],
      explanation: "Erklärung",
    });
  });

  it("speichert gruppierte Theorie- und Übungseinträge in der Modulreihenfolge", () => {
    const contentOrder = [
      { kind: "theory", id: "tb-1", groupId: "g1", groupTitle: "Grundlagen" },
      { kind: "exercise", id: "q-1", groupId: "g1", groupTitle: "Grundlagen" },
    ];
    const db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod",
      title: "Modul",
      contentOrder,
    });

    expect(db.modules[0].contentOrder).toEqual(contentOrder);
    expect(validateModuleInput({
      id: "mod",
      title: "Modul",
      contentOrder: [
        contentOrder[0],
        { ...contentOrder[1], groupTitle: "Anderer Abschnitt" },
      ],
    }).valid).toBe(false);
    expect(validateModuleInput({
      id: "mod",
      title: "Modul",
      contentOrder: [
        contentOrder[0],
        { kind: "theory", id: "tb-2" },
        contentOrder[1],
      ],
    }).valid).toBe(false);
  });

  it("speichert und validiert eigene Theorie-Block-XP und berechnet die Summe", () => {
    const blocks = [
      { id: "a", order: 1, title: "A", markdownContent: "", baseXp: 20, tags: ["Notensystem"] },
      { id: "b", order: 2, title: "B", markdownContent: "" },
    ];
    const db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod", title: "Modul", theoryBaseXp: 30, tags: ["Notensystem"], theoryBlocks: blocks,
    });
    expect(db.modules[0].theoryBlocks[0]).toMatchObject({ baseXp: 20, tags: ["Notensystem"] });
    expect(getModuleSummary(db, "mod")?.theoryXp).toBe(60);
    expect(validateModuleInput({ id: "mod", title: "Modul", theoryBlocks: [{ ...blocks[0], baseXp: -1 }] }).valid).toBe(false);
    expect(validateModuleInput({ id: "mod", title: "Modul", theoryBlocks: [blocks[0], blocks[0]] }).valid).toBe(false);
  });

  it("erhält Aufgabeneinleitungen ohne eigene Theorie-XP und validiert ihre Rolle", () => {
    const introduction = {
      id: "intro", order: 2, title: "Einleitung", markdownContent: "Vergleiche die Muster.",
      role: "exercise_intro", baseXp: 100, tags: ["Notensystem"],
    };
    const db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod", title: "Modul", theoryBaseXp: 30,
      theoryBlocks: [
        { id: "theory", order: 1, title: "Theorie", markdownContent: "" },
        introduction,
      ],
    });
    expect(db.modules[0].theoryBlocks[1]).toEqual(introduction);
    expect(getModuleSummary(db, "mod")).toMatchObject({
      theoryBlockCount: 1, theoryXp: 30,
    });
    expect(validateModuleInput({
      id: "mod", title: "Modul",
      theoryBlocks: [{ ...introduction, role: "unknown" }],
    }).valid).toBe(false);
  });

  it("validiert statische DrumPattern-Visualisierungen in Theorieblöcken", () => {
    const valid = validateModuleInput({
      id: "drums",
      title: "Drums",
      theoryBlocks: [{
        id: "tb-1",
        order: 1,
        title: "Pattern",
        markdownContent:
          '<DrumPattern steps={4} continuous={true} patternData={[{ name: "Kick", note: "C1", color: "#ef4444", activeSteps: [0], eventPositions: [0, 4 / 3] }]} />',
      }],
    });
    expect(valid.valid).toBe(true);

    const invalid = validateModuleInput({
      id: "drums",
      title: "Drums",
      theoryBlocks: [{
        id: "tb-1",
        order: 1,
        title: "Pattern",
        markdownContent: "<DrumPattern steps={0} />",
      }],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(" ")).toContain("DrumPattern");
  });

  it("speichert benannte Theorieblock-Gruppen und lehnt uneinheitliche Gruppen ab", () => {
    const group = [
      { id: "a", order: 1, title: "A", markdownContent: "", groupId: "g1", groupTitle: "Grundlagen" },
      { id: "b", order: 2, title: "B", markdownContent: "", groupId: "g1", groupTitle: "Grundlagen" },
    ];
    const db = upsertModule(createEmptyModulesDatabase(), {
      id: "grouped", title: "Gruppiertes Modul", theoryBlocks: group,
    });
    expect(db.modules[0].theoryBlocks.map(({ groupId, groupTitle }) => [
      groupId, groupTitle,
    ])).toEqual([
      ["g1", "Grundlagen"],
      ["g1", "Grundlagen"],
    ]);
    expect(validateModuleInput({
      id: "grouped",
      title: "Gruppiertes Modul",
      theoryBlocks: [group[0], { ...group[1], groupTitle: "Andere" }],
    }).valid).toBe(false);
    expect(validateModuleInput({
      id: "grouped",
      title: "Gruppiertes Modul",
      theoryBlocks: [group[0], { id: "c", order: 3, title: "C", markdownContent: "" }, group[1]],
    }).valid).toBe(false);
  });

  it("hängt neue Module hinter der höchsten Position an und bewahrt die Position beim Bearbeiten", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, { id: "first", title: "Erstes" });
    expect(db.modules[0].order).toBe(1);
    db = upsertModule(db, { id: "gap", title: "Lücke", order: 5 });
    db = upsertModule(db, { id: "last", title: "Neues" });
    expect(db.modules.find((mod) => mod.id === "last")?.order).toBe(6);
    db = upsertModule(db, { id: "first", title: "Bearbeitet" });
    expect(db.modules.find((mod) => mod.id === "first")?.order).toBe(1);
    expect(validateModuleInput({ id: "invalid", title: "Fehler", order: 0 }).valid).toBe(false);
  });

  it("verschiebt Module mit Lücken dauerhaft und erkennt veraltete Nachbarn", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, { id: "a", title: "A", order: 2 });
    db = upsertModule(db, { id: "b", title: "B", order: 8 });
    db = upsertModule(db, { id: "c", title: "C", order: 10 });
    const reordered = moveModule(db, "b", "a", "up");
    expect(reordered.modules.map(({ id, order }) => [id, order])).toEqual([
      ["b", 1], ["a", 2], ["c", 3],
    ]);
    expect(moveModule(reordered, "b", "a", "up")).toBeNull();
    expect(moveModule(db, "a", "c", "down")).toBeNull();
    expect(db.modules.map((mod) => mod.id)).toEqual(["a", "b", "c"]);
  });

  it("validiert ein reines Theorie-Modul mit hasPractice: false und lehnt ungültige Eingaben ab", () => {
    const validTheory = validateModuleInput({
      id: "mod-notenlesen-1",
      order: 1,
      title: "Das Notensystem",
      description: "Grundlagen zu Linien und Zwischenräumen.",
      scope: "theory",
      level: 100,
      dStage: "D1",
      tags: ["Allgemein", "Notensystem"],
      theoryBaseXp: 30,
      quizEasyMinScore: DEFAULT_QUIZ_EASY_MIN_SCORE,
      fastlaneMinScore: DEFAULT_FASTLANE_MIN_SCORE,
      theoryBlocks: [
        {
          id: "tb-1",
          order: 1,
          title: "Fünf Notenlinien",
          markdownContent: "Das System besteht aus fünf Linien.",
          visualComponent: "Notation",
          visualPropsJson: JSON.stringify({ clef: "treble", notes: [] }),
        },
      ],
    });
    expect(validTheory.valid).toBe(true);
    expect(validTheory.errors).toEqual([]);

    const invalid = validateModuleInput({
      id: " ",
      order: 0,
      title: "",
      quizEasyMinScore: 1.2,
      fastlaneMinScore: -0.1,
      theoryBlocks: [
        {
          id: "tb-err",
          order: 1,
          title: "Kaputtes JSON",
          markdownContent: "Text",
          visualComponent: "Notation",
          visualPropsJson: "{ungueltig",
        },
      ],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("löscht ein Modul samt Lernpfad-Aufgaben, Quizfragen bleiben ohne Zuordnung im Pool", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-1",
      order: 1,
      title: "Notenwerte",
      scope: "theory",
    });
    db = upsertModule(db, {
      id: "mod-2",
      order: 2,
      title: "Akkorde",
      scope: "instrument",
    });

    db = upsertQuestion(db, {
      id: "q-1",
      moduleIds: ["mod-1"],
      targetLane: "leicht",
      questionType: "single_choice",
      prompt: "Wie viele Schläge hat eine Ganze Note im 4/4-Takt?",
      options: ["1", "2", "4"],
      correctAnswers: ["4"],
    });
    db = upsertQuestion(db, {
      id: "q-2",
      moduleIds: ["mod-2"],
      targetLane: "mittel",
      questionType: "numeric_input",
      prompt: "Wie viele Töne hat ein Dreiklang?",
      correctAnswers: ["3"],
    });

    db = upsertQuestion(db, {
      id: "q-3",
      moduleIds: ["mod-1", "mod-2"],
      targetLane: "schwer",
      questionType: "numeric_input",
      prompt: "Wie viele Halbtöne hat eine Oktave?",
      correctAnswers: ["12"],
    });

    const afterDelete = deleteModule(db, "mod-1");
    expect(afterDelete.modules.map((m) => m.id)).toEqual(["mod-2"]);
    expect(afterDelete.questions.map((q) => q.id)).toEqual(["q-2", "q-3"]);
    expect(afterDelete.questions.find((q) => q.id === "q-3")?.moduleIds).toEqual([
      "mod-2",
    ]);
    expect(
      deleteModule(afterDelete, "mod-2").questions.map((q) => q.moduleIds),
    ).toEqual([[], []]);
  });

  it("validiert Standardfragen und interaktive NotationBuilder-Aufgaben", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-notation",
      order: 1,
      title: "Violinschlüssel",
      scope: "theory",
    });

    expect(
      validateQuestionInput(
        {
          moduleIds: ["unbekannt"],
          questionType: "single_choice",
          prompt: "Test?",
          correctAnswers: ["Ja"],
        },
        db,
      ).valid,
    ).toBe(false);

    expect(
      validateQuestionInput(
        {
          moduleIds: ["mod-notation"],
          questionType: "single_choice",
          prompt: "Welche Linie markiert der Violinschlüssel?",
          options: ["1. Linie", "2. Linie"],
          correctAnswers: ["2. Linie"],
        },
        db,
      ).valid,
    ).toBe(true);

    expect(
      validateQuestionInput(
        {
          moduleIds: ["mod-notation"],
          questionType: "numeric_input",
          prompt: "Wie viele Zwischenräume hat das Notensystem?",
          correctAnswers: ["4"],
        },
        db,
      ).valid,
    ).toBe(true);

    expect(
      validateQuestionInput(
        {
          moduleIds: ["mod-notation"],
          questionType: "numeric_input",
          prompt: "Ohne Lösung",
          correctAnswers: [],
        },
        db,
      ).valid,
    ).toBe(false);

    const validNotationTask = validateQuestionInput(
      {
        moduleIds: ["mod-notation"],
        targetLane: "schwer",
        questionType: "interactive_notation",
        prompt: "Setze das eingestrichene G (G4).",
        notationTask: {
          clef: "treble",
          timeSignature: { numerator: 4, denominator: 4 },
          maxNotes: 1,
          lockDuration: "quarter",
          compact: "tight",
          showHints: true,
          expectedPitches: ["G4"],
        },
      },
      db,
    );
    expect(validNotationTask.valid).toBe(true);

    const validDurationOnlyTask = validateQuestionInput(
      {
        moduleIds: ["mod-notation"],
        targetLane: "leicht",
        questionType: "interactive_notation",
        prompt: "Wähle eine halbe Note.",
        notationTask: {
          clef: "treble",
          showDurationPicker: true,
          expectedDurations: ["half"],
        },
      },
      db,
    );
    expect(validDurationOnlyTask.valid).toBe(true);

    const missingNotationTask = validateQuestionInput(
      {
        moduleIds: ["mod-notation"],
        questionType: "interactive_notation",
        prompt: "Fehlende Config",
      },
      db,
    );
    expect(missingNotationTask.valid).toBe(false);

    const emptyExpectedNotation = validateQuestionInput(
      {
        moduleIds: ["mod-notation"],
        questionType: "interactive_notation",
        prompt: "Ohne Zielwerte",
        notationTask: {
          clef: "bass",
          expectedPitches: [],
          expectedDurations: [],
        },
      },
      db,
    );
    expect(emptyExpectedNotation.valid).toBe(false);
  });

  it("erlaubt Quizfragen ohne oder mit mehreren Modulen, Lernpfad-Aufgaben aber nur mit genau einem", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, { id: "mod-a", title: "A" });
    db = upsertModule(db, { id: "mod-b", title: "B" });
    const base = {
      questionType: "single_choice",
      prompt: "Frage?",
      correctAnswers: ["Ja"],
    };

    expect(
      validateQuestionInput(
        { ...base, targetLane: "mittel", moduleIds: [] },
        db,
      ).valid,
    ).toBe(true);
    expect(
      validateQuestionInput(
        { ...base, targetLane: "schwer", moduleIds: ["mod-a", "mod-b"] },
        db,
      ).valid,
    ).toBe(true);
    expect(
      validateQuestionInput(
        { ...base, targetLane: "leicht", moduleIds: ["mod-a", "mod-b"] },
        db,
      ).valid,
    ).toBe(false);
    expect(
      validateQuestionInput(
        { ...base, targetLane: "leicht", moduleIds: [] },
        db,
      ).valid,
    ).toBe(false);
  });

  it("speichert Praxisaufgaben im Modul und bewahrt sie in der Blockreihenfolge", () => {
    const db = upsertModule(createEmptyModulesDatabase(), {
      id: "mod-practice",
      title: "Praxis",
      practiceBlocks: [
        { id: "pb-1", title: "Üben", markdownContent: "Spiele C-Dur.", tags: ["Gitarre"] },
      ],
      contentOrder: [{ kind: "practice", id: "pb-1" }],
    });
    const mod = db.modules[0];
    expect(mod.practiceBlocks).toHaveLength(1);
    expect(mod.contentOrder).toEqual([{ kind: "practice", id: "pb-1" }]);
    expect(getModuleSummary(db, "mod-practice")).toMatchObject({
      practiceBlockCount: 1,
      practiceXp: 24,
    });
    expect(
      validateModuleInput({
        id: "x",
        title: "x",
        practiceBlocks: [{ id: "", title: "", markdownContent: "" }],
      }).valid,
    ).toBe(false);
  });

  it("wertet Theorie-Blöcke, Lanes und gewichtete Gesamt-XP in getModuleSummary korrekt aus", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-summary",
      order: 1,
      title: "Noten & Rhythmus",
      scope: "theory",
      theoryBlocks: [
        {
          id: "tb-1",
          order: 1,
          title: "Block 1",
          markdownContent: "Inhalt 1",
        },
        {
          id: "tb-2",
          order: 2,
          title: "Block 2",
          markdownContent: "Inhalt 2",
        },
      ],
    });

    db = upsertQuestion(db, {
      id: "q-ex",
      moduleIds: ["mod-summary"],
      targetLane: "leicht",
      questionType: "single_choice",
      prompt: "Übung 1",
      correctAnswers: ["A"],
      tags: ["Notensystem"],
    }); // baseXp 10 * 1.5 = 15

    db = upsertQuestion(db, {
      id: "q-quiz",
      moduleIds: ["mod-summary"],
      targetLane: "mittel",
      difficulty: "mittel",
      questionType: "numeric_input",
      prompt: "Quiz 1",
      correctAnswers: ["4"],
      tags: ["Gitarre"],
    });

    db = upsertQuestion(db, {
      id: "q-fast",
      moduleIds: ["mod-summary"],
      targetLane: "schwer",
      difficulty: "schwer",
      questionType: "interactive_notation",
      prompt: "Fastlane 1",
      notationTask: {
        clef: "treble",
        expectedPitches: ["E4", "G4"],
      },
      tags: ["Notensystem", "Violinschlüssel"],
    });

    const summary = getModuleSummary(db, "mod-summary");
    expect(summary).toEqual({
      moduleId: "mod-summary",
      theoryBlockCount: 2,
      theoryXp: 60,
      practiceBlockCount: 0,
      practiceXp: 0,
      questionCounts: {
        leicht: 1,
        mittel: 1,
        schwer: 1,
        total: 3,
      },
      laneXp: {
        leicht: 15,
        mittel: 18,
        schwer: 30,
      },
      questionsXp: 63,
      totalXp: 123,
    });

    const afterQuestionDelete = deleteQuestion(db, "q-quiz");
    expect(getModuleSummary(afterQuestionDelete, "mod-summary")?.totalXp).toBe(
      105,
    );
    expect(getModuleSummary(db, "nicht-vorhanden")).toBeNull();
  });
});

vi.mock("@netlify/blobs", () => ({ getStore: vi.fn() }));

describe("Modules Serverless API (/api/modules)", () => {
  let store;
  const storedDb = () => store.value("modules");
  beforeEach(() => {
    vi.stubEnv("NETLIFY_DEV", "false");
    store = mockBlobStore();
    store.put("modules", { modules: [], questions: [] });
    vi.mocked(getStore).mockReset().mockReturnValue(store);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["true", "false"])("aktualisiert MDX-Kopien nur lokal (NETLIFY_DEV=%s)", async (local) => {
    const synchronize = vi.spyOn(moduleArchive, "syncModuleArchivesAfterSave").mockResolvedValue();
    vi.stubEnv("NETLIFY_DEV", local);
    try {
      const response = await modulesHandler(new Request("http://localhost/api/modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "module", id: "m", title: "Test" }),
      }));
      expect(response.status).toBe(201);
      if (local === "true") expect(synchronize).toHaveBeenCalledWith(storedDb());
      else expect(synchronize).not.toHaveBeenCalled();
    } finally {
      synchronize.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("meldet ausdrücklich, wenn nur die Kopien nach dem Speichern fehlgeschlagen sind", async () => {
    const message = "Die Moduldaten wurden gespeichert, aber die MDX-Kopien konnten nicht aktualisiert werden.";
    const synchronize = vi.spyOn(moduleArchive, "syncModuleArchivesAfterSave")
      .mockRejectedValue(new moduleArchive.ModuleArchiveSyncError(message));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NETLIFY_DEV", "true");
    try {
      const response = await modulesHandler(new Request("http://localhost/api/modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "module", id: "m", title: "Test" }),
      }));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: message });
      expect(storedDb().modules[0].id).toBe("m");
      expect(log).toHaveBeenCalled();
    } finally {
      synchronize.mockRestore();
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("speichert Modul und Lernpfad-Aufgaben gemeinsam oder lehnt den ganzen Schreibvorgang ab", async () => {
    const request = (body) => modulesHandler(new Request("http://localhost/api/modules", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    const exercise = {
      id: "q", moduleIds: ["m"], targetLane: "leicht",
      questionType: "numeric_input", prompt: "Frage", correctAnswers: ["1"],
    };
    const payload = {
      entity: "module", id: "m", title: "Test", contentOrder: [{ kind: "exercise", id: "q" }],
    };
    const invalid = await request({
      ...payload, exercises: [exercise, { ...exercise, id: "invalid", correctAnswers: [] }],
    });
    expect(invalid.status).toBe(400);
    expect(storedDb()).toEqual({ modules: [], questions: [] });
    const saved = await request({ ...payload, exercises: [exercise] });
    expect(saved.status).toBe(201);
    expect(await saved.json()).toMatchObject({
      module: { id: "m", contentOrder: payload.contentOrder },
      questions: [exercise],
    });
    expect(storedDb().questions).toMatchObject([exercise]);
  });

  it("speichert globale Grenzen mit Konfliktschutz und erhält sie bei späteren Moduländerungen", async () => {
    const request = (body) => modulesHandler(new Request("http://localhost/api/modules", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    const settings = { quizEasyMinScore: 0.9, fastlaneMinScore: 0.95, revision: 0 };
    expect((await request({ entity: "quiz-settings", settings })).status).toBe(200);
    expect(storedDb().quizSettings).toEqual({ ...settings, revision: 1 });
    expect((await request({ entity: "quiz-settings", settings })).status).toBe(409);
    expect((await request({ entity: "module", id: "m", title: "Test" })).status).toBe(200);
    expect(storedDb().quizSettings.revision).toBe(1);
    const current = { ...settings, revision: 1 };
    expect((await request({ entity: "quiz-settings", settings: current })).status).toBe(200);
    expect(storedDb().quizSettings.revision).toBe(1);
    expect((await request({ entity: "quiz-settings", settings: { ...current, quizEasyMinScore: 2 } })).status).toBe(400);
  });

  it("weist nicht unterstützte Methoden und fehlenden Blob-Kontext ab", async () => {
    const patchRes = await modulesHandler(
      new Request("http://localhost/api/modules", { method: "PATCH" }),
    );
    expect(patchRes.status).toBe(405);

    vi.mocked(getStore).mockImplementation(() => {
      throw Object.assign(new Error("Kein Blob-Kontext"), { name: "MissingBlobsEnvironmentError" });
    });
    const envRes = await modulesHandler(
      new Request("http://localhost/api/modules", { method: "GET" }),
    );
    expect(envRes.status).toBe(503);
  });

  it("liest per GET, speichert per POST trotz ETag-Konflikt und löscht per DELETE", async () => {
    store.setJSON.mockImplementationOnce(async () => {
      store.put("modules", {
        ...storedDb(),
        modules: [{ id: "concurrent", order: 4, title: "Gleichzeitig hinzugefügt" }],
      });
      return { modified: false };
    });

    const postModRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "module",
          id: "mod-api-1",
          title: "API Modul",
          scope: "theory",
        }),
      }),
    );
    expect(postModRes.status).toBe(201);
    expect(store.setJSON).toHaveBeenCalledTimes(2);
    expect(storedDb().modules).toHaveLength(2);
    expect(storedDb().modules.find((mod) => mod.id === "mod-api-1").order).toBe(5);

    const postQRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "question",
          id: "q-api-1",
          moduleIds: ["mod-api-1"],
          questionType: "interactive_notation",
          prompt: "Setze C4",
          notationTask: {
            clef: "treble",
            expectedPitches: ["C4"],
          },
        }),
      }),
    );
    expect(postQRes.status).toBe(201);
    expect(storedDb().questions).toHaveLength(1);

    const getRes = await modulesHandler(
      new Request("http://localhost/api/modules", { method: "GET" }),
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.modules).toHaveLength(2);
    expect(getBody.questions).toHaveLength(1);

    const moveRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "module-order",
          id: "mod-api-1",
          neighborId: "concurrent",
          direction: "up",
        }),
      }),
    );
    expect(moveRes.status).toBe(200);
    expect(storedDb().modules.map((mod) => mod.id)).toEqual(["mod-api-1", "concurrent"]);
    const staleMove = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "module-order",
          id: "mod-api-1",
          neighborId: "concurrent",
          direction: "up",
        }),
      }),
    );
    expect(staleMove.status).toBe(409);

    const delRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "module", id: "mod-api-1" }),
      }),
    );
    expect(delRes.status).toBe(200);
    expect(storedDb().modules.map((mod) => mod.id)).toEqual(["concurrent"]);
    expect(storedDb().questions).toEqual([]);
  });
});
