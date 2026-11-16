// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import modulesHandler from "../netlify/functions/modules.ts";
import {
  DEFAULT_FASTLANE_MIN_SCORE,
  DEFAULT_QUIZ_EASY_MIN_SCORE,
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
  getAvailableTags,
  TAG_DEFINITIONS,
} from "../src/lib/xp-tags.ts";

describe("xp-tags Konfiguration & Berechnung", () => {
  it("liefert zentrale Basis-EXP und Tag-Liste", () => {
    expect(BASE_XP_DEFAULTS).toEqual({
      theoryBlock: 30,
      exercise: 10,
      quizEasy: 15,
      fastlane: 25,
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
});

describe("module-store Validierung & Store-Operationen", () => {
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
      hasPractice: false,
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

  it("löscht ein Modul kaskadierend mitsamt seinen Fragen, behält fremde Module aber bei", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-1",
      order: 1,
      title: "Notenwerte",
      scope: "theory",
      hasPractice: false,
    });
    db = upsertModule(db, {
      id: "mod-2",
      order: 2,
      title: "Akkorde",
      scope: "instrument",
    });

    db = upsertQuestion(db, {
      id: "q-1",
      moduleId: "mod-1",
      targetLane: "exercise",
      questionType: "single_choice",
      prompt: "Wie viele Schläge hat eine Ganze Note im 4/4-Takt?",
      options: ["1", "2", "4"],
      correctAnswers: ["4"],
    });
    db = upsertQuestion(db, {
      id: "q-2",
      moduleId: "mod-2",
      targetLane: "quiz_easy",
      questionType: "numeric_input",
      prompt: "Wie viele Töne hat ein Dreiklang?",
      correctAnswers: ["3"],
    });

    expect(db.modules.find((m) => m.id === "mod-1")?.hasPractice).toBe(false);
    expect(db.modules.find((m) => m.id === "mod-2")?.hasPractice).toBe(true);

    const afterDelete = deleteModule(db, "mod-1");
    expect(afterDelete.modules.map((m) => m.id)).toEqual(["mod-2"]);
    expect(afterDelete.questions.map((q) => q.id)).toEqual(["q-2"]);
  });

  it("validiert Standardfragen und interaktive NotationBuilder-Aufgaben", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-notation",
      order: 1,
      title: "Violinschlüssel",
      scope: "theory",
      hasPractice: false,
    });

    expect(
      validateQuestionInput(
        {
          moduleId: "unbekannt",
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
          moduleId: "mod-notation",
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
          moduleId: "mod-notation",
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
          moduleId: "mod-notation",
          questionType: "numeric_input",
          prompt: "Ohne Lösung",
          correctAnswers: [],
        },
        db,
      ).valid,
    ).toBe(false);

    const validNotationTask = validateQuestionInput(
      {
        moduleId: "mod-notation",
        targetLane: "fastlane",
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
        moduleId: "mod-notation",
        targetLane: "exercise",
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
        moduleId: "mod-notation",
        questionType: "interactive_notation",
        prompt: "Fehlende Config",
      },
      db,
    );
    expect(missingNotationTask.valid).toBe(false);

    const emptyExpectedNotation = validateQuestionInput(
      {
        moduleId: "mod-notation",
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

  it("wertet Theorie-Blöcke, Lanes und gewichtete Gesamt-XP in getModuleSummary korrekt aus", () => {
    let db = createEmptyModulesDatabase();
    db = upsertModule(db, {
      id: "mod-summary",
      order: 1,
      title: "Noten & Rhythmus",
      scope: "theory",
      hasPractice: false,
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
      moduleId: "mod-summary",
      targetLane: "exercise",
      questionType: "single_choice",
      prompt: "Übung 1",
      correctAnswers: ["A"],
      tags: ["Notensystem"],
    }); // baseXp 10 * 1.5 = 15

    db = upsertQuestion(db, {
      id: "q-quiz",
      moduleId: "mod-summary",
      targetLane: "quiz_easy",
      questionType: "numeric_input",
      prompt: "Quiz 1",
      correctAnswers: ["4"],
      tags: ["Gitarre"],
    }); // baseXp 15 * 1.2 = 18

    db = upsertQuestion(db, {
      id: "q-fast",
      moduleId: "mod-summary",
      targetLane: "fastlane",
      questionType: "interactive_notation",
      prompt: "Fastlane 1",
      notationTask: {
        clef: "treble",
        expectedPitches: ["E4", "G4"],
      },
      tags: ["Notensystem", "Violinschlüssel"],
    }); // baseXp 25 * 1.5 = 38 (Math.round(37.5))

    const summary = getModuleSummary(db, "mod-summary");
    expect(summary).toEqual({
      moduleId: "mod-summary",
      theoryBlockCount: 2,
      theoryXp: 60,
      questionCounts: {
        exercise: 1,
        quiz_easy: 1,
        fastlane: 1,
        total: 3,
      },
      laneXp: {
        exercise: 15,
        quiz_easy: 18,
        fastlane: 38,
      },
      questionsXp: 71,
      totalXp: 131,
    });

    const afterQuestionDelete = deleteQuestion(db, "q-quiz");
    expect(getModuleSummary(afterQuestionDelete, "mod-summary")?.totalXp).toBe(
      113,
    );
    expect(getModuleSummary(db, "nicht-vorhanden")).toBeNull();
  });
});

describe("Modules Serverless API (/api/modules)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("weist nicht unterstützte Methoden und fehlende Env-Konfiguration ab", async () => {
    const patchRes = await modulesHandler(
      new Request("http://localhost/api/modules", { method: "PATCH" }),
    );
    expect(patchRes.status).toBe(405);

    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_REPOSITORY", "");
    const envRes = await modulesHandler(
      new Request("http://localhost/api/modules", { method: "GET" }),
    );
    expect(envRes.status).toBe(503);
  });

  it("liest per GET, speichert per POST mit 409-Retry und löscht per DELETE", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo");
    vi.stubEnv("GITHUB_MODULES_PATH", "data/modules.json");

    let storedDb = { modules: [], questions: [] };
    let putAttempts = 0;

    const fetchMock = vi.fn(async (_url, init) => {
      if (!init || init.method === undefined || init.method === "GET") {
        return new Response(
          JSON.stringify({
            sha: "sha-1",
            content: Buffer.from(JSON.stringify(storedDb), "utf8").toString(
              "base64",
            ),
          }),
          { status: 200 },
        );
      }

      if (init.method === "PUT") {
        putAttempts += 1;
        if (putAttempts === 1) {
          storedDb.modules.push({
            id: "concurrent", order: 4, title: "Gleichzeitig hinzugefügt",
          });
          return new Response(JSON.stringify({ message: "Conflict" }), {
            status: 409,
          });
        }
        const body = JSON.parse(String(init.body));
        storedDb = JSON.parse(
          Buffer.from(body.content, "base64").toString("utf8"),
        );
        return new Response(JSON.stringify({ content: { sha: "sha-2" } }), {
          status: 200,
        });
      }

      return new Response(null, { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const postModRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "module",
          id: "mod-api-1",
          title: "API Modul",
          scope: "theory",
          hasPractice: false,
        }),
      }),
    );
    expect(postModRes.status).toBe(201);
    expect(putAttempts).toBe(2);
    expect(storedDb.modules).toHaveLength(2);
    expect(storedDb.modules.find((mod) => mod.id === "mod-api-1").order).toBe(5);

    const postQRes = await modulesHandler(
      new Request("http://localhost/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "question",
          id: "q-api-1",
          moduleId: "mod-api-1",
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
    expect(storedDb.questions).toHaveLength(1);

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
    expect(storedDb.modules.map((mod) => mod.id)).toEqual(["mod-api-1", "concurrent"]);
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
    expect(storedDb.modules.map((mod) => mod.id)).toEqual(["concurrent"]);
    expect(storedDb.questions).toEqual([]);
  });
});
