import { afterEach, describe, expect, it } from "vitest";
import rawSeedDb from "../../data/modules.json";
import { clearLearningProgress } from "../../src/lib/learning-progress";
import type { ModulesDatabase } from "../../src/lib/module-schema";
import {
  validateModuleInput,
  validateQuestionInput,
} from "../../src/lib/module-store";
import {
  attachModuleRoadmap,
  attachModuleStepper,
  attachProgressDashboard,
  evaluateQuestionAnswer,
  renderTheoryMarkdown,
} from "../../src/lib/module-player-ui";
import { calculateTheoryBlockXp } from "../../src/lib/xp-tags";

const seedDb = rawSeedDb as unknown as ModulesDatabase;

function keyPress(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("Schüler-UI (Dashboard, Roadmap, Stepper & Quiz/Fastlane-Runner)", () => {
  afterEach(() => {
    clearLearningProgress();
    document.body.replaceChildren();
  });

  it("rendert Notation an ihrer Textposition ohne Quelltext und unterstützt mehrere Elemente", () => {
    const container = document.createElement("div");
    container.append(renderTheoryMarkdown(
      'Vorher\n\n<Notation clef="treble" notes={[{ step: 2, duration: "quarter" }, { step: 4, duration: "quarter" }]} />\n\nDanach\n\n<Notation clef="bass" notes={[]} />',
    ));
    expect(container.querySelectorAll("svg.notation-staff")).toHaveLength(2);
    expect(container.querySelectorAll("svg.notation-staff")[0].querySelectorAll(".notation-note")).toHaveLength(2);
    expect(Array.from(container.children).map((child) => child.tagName)).toEqual([
      "P", "DIV", "P", "DIV",
    ]);
    expect(container.textContent).not.toContain("<Notation");
    expect(container.textContent).toContain("Vorher");
    expect(container.textContent).toContain("Danach");
  });

  it("zeigt eine alte Visualisierung nicht doppelt, wenn dieselbe Notation bereits im Text steht", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    db.modules[0].theoryBlocks[1].markdownContent =
      'Text\n\n<Notation clef="treble" notes={[]} />';
    db.modules[0].theoryBlocks[1].visualComponent = "Notation";
    db.modules[0].theoryBlocks[1].visualPropsJson = '{"notes":[],"clef":"treble"}';
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    expect(root.querySelectorAll(".learning-theory-block")[1].querySelectorAll("svg.notation-staff")).toHaveLength(1);
    expect(root.textContent).not.toContain("<Notation");
  });

  it("führt keine Ausdrücke aus und lässt Komponenten in Inline-Code unverändert", () => {
    const container = document.createElement("div");
    container.append(renderTheoryMarkdown(
      '`<Notation notes={[]} />`\n\n<Notation notes={window.alert(1)} />',
    ));
    expect(container.querySelector("code")?.textContent).toBe("<Notation notes={[]} />");
    expect(container.querySelector(".learning-notation-error")?.textContent).toContain("Nur feste Werte");
    expect(container.querySelector("svg.notation-staff")).toBeNull();
  });

  it("zeigt die globale Bestehensgrenze im Fastlane-Quiz an", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    root.dataset.mode = "fastlane";
    document.body.append(root);
    const db = structuredClone(seedDb);
    db.quizSettings = { quizEasyMinScore: 0.9, fastlaneMinScore: 0.93, revision: 1 };
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    expect(root.textContent).toContain("Benötigt: 93 %");
  });

  it("enthält valide Startmodule und Fragen in data/modules.json", () => {
    expect(seedDb.modules.length).toBeGreaterThanOrEqual(2);
    for (const mod of seedDb.modules) {
      expect(validateModuleInput(mod)).toEqual({ valid: true, errors: [] });
    }
    for (const q of seedDb.questions) {
      expect(validateQuestionInput(q, seedDb.modules)).toEqual({
        valid: true,
        errors: [],
      });
    }

    const qNumeric = seedDb.questions.find((q) => q.id === "q-101-ex-1");
    expect(qNumeric).toBeDefined();
    if (qNumeric) {
      expect(
        evaluateQuestionAnswer(qNumeric, { kind: "numeric", value: "880" })
          .correct,
      ).toBe(true);
      expect(
        evaluateQuestionAnswer(qNumeric, { kind: "numeric", value: "880 hz" })
          .correct,
      ).toBe(true);
      expect(
        evaluateQuestionAnswer(qNumeric, { kind: "numeric", value: "440" })
          .correct,
      ).toBe(false);
    }
  });

  it("sperrt nachfolgende Stepper-Schritte initial und entsperrt Schritt 2 nach Theorie-Abschluss live inklusive Dashboard-Update", () => {
    const db = structuredClone(seedDb);
    db.questions = db.questions.filter((q) =>
      q.moduleId !== "theory-101" || q.targetLane !== "exercise" ||
      ["q-101-ex-1", "q-101-ex-2"].includes(q.id),
    );
    const dashboardEl = document.createElement("section");
    const stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    stepperEl.dataset.mode = "normal";
    document.body.append(dashboardEl, stepperEl);

    attachProgressDashboard(dashboardEl, {
      initialDb: db,
      autoFetch: false,
    });
    attachModuleStepper(stepperEl, { initialDb: db, autoFetch: false });

    const theoryStep = stepperEl.querySelector<HTMLElement>(
      '[data-step="theory"]',
    );
    const exerciseStep = stepperEl.querySelector<HTMLElement>(
      '[data-step="exercise"]',
    );
    const quizStep = stepperEl.querySelector<HTMLElement>(
      '[data-step="quiz_easy"]',
    );

    expect(theoryStep?.dataset.stepState).toBe("unlocked");
    expect(exerciseStep?.dataset.stepState).toBe("locked");
    expect(quizStep?.dataset.stepState).toBe("locked");
    expect(
      stepperEl.querySelectorAll('[data-action="check-exercise"]'),
    ).toHaveLength(0);
    expect(stepperEl.querySelector(".katex")).not.toBeNull();
    expect(stepperEl.querySelector("svg.notation-staff")).not.toBeNull();
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset
        .dashboardXp,
    ).toBe("0");

    // Schritt 1 abschließen -> Theorie wird completed, Aufgaben werden unlocked
    const blockButtons = stepperEl.querySelectorAll<HTMLButtonElement>(
      '[data-action="complete-theory-block"]',
    );
    expect(blockButtons.length).toBe(db.modules[0].theoryBlocks.length);
    blockButtons[0].click();
    expect(blockButtons[0].disabled).toBe(true);
    expect(exerciseStep?.dataset.stepState).toBe("locked");
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset.dashboardXp,
    ).toBe(String(calculateTheoryBlockXp(
      [...db.modules[0].theoryBlocks].sort((a, b) => a.order - b.order)[0],
      db.modules[0].theoryBaseXp,
    )));
    blockButtons.forEach((button) => button.click());

    expect(theoryStep?.dataset.stepState).toBe("completed");
    expect(exerciseStep?.dataset.stepState).toBe("unlocked");
    expect(quizStep?.dataset.stepState).toBe("locked");
    expect(
      stepperEl.querySelectorAll('[data-action="check-exercise"]'),
    ).toHaveLength(2);
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset
        .dashboardXp,
    ).toBe(String(db.modules[0].theoryBlocks.reduce(
      (total, block) => total + calculateTheoryBlockXp(block, db.modules[0].theoryBaseXp),
      0,
    )));

    // Falsche Antwort auf Aufgabe 1 zeigt didaktische Erklärung
    const ex1Card = stepperEl.querySelector<HTMLElement>(
      '[data-question-card="q-101-ex-1"]',
    );
    const ex1Input = ex1Card?.querySelector<HTMLInputElement>(
      ".learning-numeric-input",
    );
    const ex1Btn = ex1Card?.querySelector<HTMLButtonElement>(
      '[data-action="check-exercise"]',
    );
    if (!ex1Input || !ex1Btn) throw new Error("Aufgabe 1 fehlt");

    ex1Input.value = "440";
    ex1Btn.click();
    const feedback = ex1Card?.querySelector<HTMLElement>(".learning-feedback");
    expect(feedback?.dataset.outcome).toBe("wrong");
    expect(feedback?.textContent).toContain("Frequenzverhältnis 2:1");

    // Korrekte Antwort auf Aufgabe 1 + G4 im NotationBuilder für Aufgabe 2 -> Quiz Einfach wird frei
    ex1Input.value = "880 Hz";
    ex1Btn.click();
    expect(feedback?.dataset.outcome).toBe("correct");

    const ex2Card = stepperEl.querySelector<HTMLElement>(
      '[data-question-card="q-101-ex-2"]',
    );
    const builder = ex2Card?.querySelector<HTMLElement>(
      "[data-notation-builder]",
    );
    const ex2Btn = ex2Card?.querySelector<HTMLButtonElement>(
      '[data-action="check-exercise"]',
    );
    if (!builder || !ex2Btn) throw new Error("Notationsaufgabe fehlt");

    keyPress(builder, "ArrowDown"); // B4 -> A4
    keyPress(builder, "ArrowDown"); // A4 -> G4
    keyPress(builder, " "); // G4 setzen
    ex2Btn.click();

    expect(exerciseStep?.dataset.stepState).toBe("completed");
    expect(quizStep?.dataset.stepState).toBe("unlocked");

    const roadmapCheck = document.createElement("section");
    document.body.append(roadmapCheck);
    attachModuleRoadmap(roadmapCheck, { initialDb: db, autoFetch: false });
    const mod1Card = roadmapCheck.querySelector<HTMLElement>(
      '[data-module-card="theory-101"]',
    );
    const quizLink = mod1Card?.querySelector<HTMLAnchorElement>(
      ".learning-start-quiz",
    );
    expect(quizLink?.tagName).toBe("A");
    expect(quizLink?.textContent).toBe("Abschluss-Quiz starten");
    expect(
      mod1Card?.querySelector('[data-roadmap-stat="quiz"]')?.textContent,
    ).toBe("Quiz 0/1");
  });

  it("aktualisiert Dashboard und Roadmap nach bestandenem Fastlane-Quiz inklusive Freischaltung von Modul 2", () => {
    const db = structuredClone(seedDb);
    db.questions = db.questions.filter((q) =>
      q.moduleId !== "theory-101" || q.targetLane !== "exercise" ||
      ["q-101-ex-1", "q-101-ex-2"].includes(q.id),
    );
    const dashboardEl = document.createElement("section");
    const roadmapEl = document.createElement("section");
    const stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    stepperEl.dataset.mode = "fastlane";
    document.body.append(dashboardEl, roadmapEl, stepperEl);

    attachProgressDashboard(dashboardEl, {
      initialDb: db,
      autoFetch: false,
    });
    attachModuleRoadmap(roadmapEl, { initialDb: db, autoFetch: false });
    attachModuleStepper(stepperEl, { initialDb: db, autoFetch: false });

    const mod1Before = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="theory-101"]',
    );
    const mod2Before = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="guitar-102"]',
    );
    expect(mod2Before?.dataset.moduleStatus).toBe("locked");
    expect(
      mod1Before?.querySelector<HTMLElement>(".learning-badge-row")?.hidden,
    ).toBe(true);
    expect(
      mod1Before?.querySelector<HTMLElement>(".learning-open-fastlane")?.hidden,
    ).toBe(true);
    expect(
      mod2Before?.querySelector(".learning-open-lesson")?.tagName,
    ).toBe("A");
    const mod1QuizBtnBefore = mod1Before?.querySelector<HTMLButtonElement>(
      ".learning-start-quiz",
    );
    expect(mod1QuizBtnBefore?.tagName).toBe("BUTTON");
    expect(mod1QuizBtnBefore?.disabled).toBe(true);
    expect(
      dashboardEl
        .querySelector('[data-dashboard-module-bar="theory-101"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");
    expect(
      mod1Before?.querySelector('[data-roadmap-stat="module-overall"]')?.textContent,
    ).toBe("Gesamtfortschritt 0 %");
    expect(
      mod1Before?.querySelector('[data-roadmap-stat="theory"]')?.textContent,
    ).toBe(`Theorie 0/${seedDb.modules[0].theoryBlocks.length}`);
    expect(
      mod1Before
        ?.querySelector('[data-roadmap-stat="theory"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");
    expect(
      mod1Before?.querySelector('[data-roadmap-stat="exercises"]')?.textContent,
    ).toBe("Aufgaben 0/2");
    expect(
      mod1Before
        ?.querySelector('[data-roadmap-stat="exercises"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");
    expect(
      mod1Before?.querySelector('[data-roadmap-stat="quiz"]')?.textContent,
    ).toBe("Quiz 0/1");
    expect(
      mod1Before
        ?.querySelector('[data-roadmap-stat="quiz"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");

    // Frage 1 (Fastlane numeric_input): 880
    const flInput = stepperEl.querySelector<HTMLInputElement>(
      ".learning-numeric-input",
    );
    if (!flInput) throw new Error("Fastlane-Eingabe 1 fehlt");
    flInput.value = "880";
    stepperEl
      .querySelector<HTMLButtonElement>('[data-action="check-quiz-answer"]')
      ?.click();
    stepperEl
      .querySelector<HTMLButtonElement>('[data-action="next-quiz-question"]')
      ?.click();

    // Frage 2 (Fastlane interactive_notation): C4 (6 Schritte unter B4)
    const builder = stepperEl.querySelector<HTMLElement>(
      "[data-notation-builder]",
    );
    if (!builder) throw new Error("Fastlane-NotationBuilder fehlt");
    for (let i = 0; i < 6; i += 1) {
      keyPress(builder, "ArrowDown");
    }
    keyPress(builder, " ");
    stepperEl
      .querySelector<HTMLButtonElement>('[data-action="check-quiz-answer"]')
      ?.click();
    stepperEl
      .querySelector<HTMLButtonElement>('[data-action="next-quiz-question"]')
      ?.click();

    const summary = stepperEl.querySelector<HTMLElement>("[data-quiz-result]");
    expect(summary?.dataset.quizResult).toBe("passed");

    // Dashboard wurde live aktualisiert und Detail-Bereiche bleiben standardmäßig ausgeblendet
    const breakdownGroups = dashboardEl.querySelectorAll<HTMLElement>(
      ".learning-breakdown-group",
    );
    expect(breakdownGroups).toHaveLength(2);
    expect(Array.from(breakdownGroups).every((el) => el.hidden)).toBe(true);
    expect(
      dashboardEl.querySelector<HTMLElement>(".learning-dashboard-module-bars")
        ?.hidden,
    ).toBe(true);
    expect(
      dashboardEl.querySelector<HTMLElement>(".learning-reset-area")?.hidden,
    ).toBe(true);

    const xpValue = dashboardEl.querySelector<HTMLElement>(
      "[data-dashboard-xp]",
    )?.dataset.dashboardXp;
    expect(Number(xpValue)).toBeGreaterThan(0);
    expect(xpValue).toBe(String(126 + db.modules[0].theoryBlocks.reduce(
      (total, block) => total + calculateTheoryBlockXp(block, db.modules[0].theoryBaseXp),
      0,
    )));
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-modules]")
        ?.dataset.dashboardModules,
    ).toBe("1/2");

    expect(
      dashboardEl
        .querySelector('[data-dashboard-module-bar="theory-101"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(
      dashboardEl
        .querySelector('[data-dashboard-module-bar="guitar-102"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");

    // Roadmap hat Modul 2 freigeschaltet und Lektion-öffnen-Link aktiviert
    const mod1After = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="theory-101"]',
    );
    const mod2After = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="guitar-102"]',
    );
    expect(mod1After?.dataset.moduleStatus).toBe("completed");
    expect(
      mod1After?.querySelector('[data-roadmap-stat="module-overall"]')?.textContent,
    ).toBe("Gesamtfortschritt 100 %");
    expect(
      mod1After?.querySelector('[data-roadmap-stat="theory"]')?.textContent,
    ).toBe(`Theorie ${seedDb.modules[0].theoryBlocks.length}/${seedDb.modules[0].theoryBlocks.length}`);
    expect(
      mod1After
        ?.querySelector('[data-roadmap-stat="theory"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(
      mod1After
        ?.querySelector<HTMLElement>(
          '[data-roadmap-stat="theory"] .learning-module-stat-bar-fill',
        )
        ?.style.width,
    ).toBe("100%");
    expect(
      mod1After?.querySelector('[data-roadmap-stat="exercises"]')?.textContent,
    ).toBe("Aufgaben 2/2");
    expect(
      mod1After
        ?.querySelector('[data-roadmap-stat="exercises"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(
      mod1After?.querySelector('[data-roadmap-stat="quiz"]')?.textContent,
    ).toBe("Quiz 1/1");
    expect(
      mod1After
        ?.querySelector('[data-roadmap-stat="quiz"] [role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(
      mod1After?.querySelector(".learning-start-quiz")?.tagName,
    ).toBe("A");
    expect(mod2After?.dataset.moduleStatus).toBe("unlocked");
    expect(
      mod2After?.querySelector<HTMLAnchorElement>(".learning-open-lesson")
        ?.tagName,
    ).toBe("A");
    expect(
      mod2After?.querySelector<HTMLButtonElement>(".learning-start-quiz")
        ?.disabled,
    ).toBe(true);

    // Geschützter Reset setzt XP und Modul-2-Sperre zurück
    dashboardEl
      .querySelector<HTMLButtonElement>('[data-action="request-reset"]')
      ?.click();
    dashboardEl
      .querySelector<HTMLButtonElement>('[data-action="confirm-reset"]')
      ?.click();
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset
        .dashboardXp,
    ).toBe("0");
    expect(
      roadmapEl.querySelector<HTMLElement>('[data-module-card="guitar-102"]')
        ?.dataset.moduleStatus,
    ).toBe("locked");
  });
});
