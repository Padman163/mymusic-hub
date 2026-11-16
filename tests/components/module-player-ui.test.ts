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
} from "../../src/lib/module-player-ui";

const seedDb = rawSeedDb as unknown as ModulesDatabase;

function keyPress(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("Schüler-UI (Dashboard, Roadmap, Stepper & Quiz/Fastlane-Runner)", () => {
  afterEach(() => {
    clearLearningProgress();
    document.body.replaceChildren();
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
    const dashboardEl = document.createElement("section");
    const stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    stepperEl.dataset.mode = "normal";
    document.body.append(dashboardEl, stepperEl);

    attachProgressDashboard(dashboardEl, {
      initialDb: seedDb,
      autoFetch: false,
    });
    attachModuleStepper(stepperEl, { initialDb: seedDb, autoFetch: false });

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
    const completeTheoryBtn = stepperEl.querySelector<HTMLButtonElement>(
      '[data-action="complete-theory"]',
    );
    expect(completeTheoryBtn).not.toBeNull();
    completeTheoryBtn?.click();

    expect(theoryStep?.dataset.stepState).toBe("completed");
    expect(exerciseStep?.dataset.stepState).toBe("unlocked");
    expect(quizStep?.dataset.stepState).toBe("locked");
    expect(
      stepperEl.querySelectorAll('[data-action="check-exercise"]'),
    ).toHaveLength(2);
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset
        .dashboardXp,
    ).toBe("45");

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
  });

  it("aktualisiert Dashboard und Roadmap nach bestandenem Fastlane-Quiz inklusive Freischaltung von Modul 2", () => {
    const dashboardEl = document.createElement("section");
    const roadmapEl = document.createElement("section");
    const stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    stepperEl.dataset.mode = "fastlane";
    document.body.append(dashboardEl, roadmapEl, stepperEl);

    attachProgressDashboard(dashboardEl, {
      initialDb: seedDb,
      autoFetch: false,
    });
    attachModuleRoadmap(roadmapEl, { initialDb: seedDb, autoFetch: false });
    attachModuleStepper(stepperEl, { initialDb: seedDb, autoFetch: false });

    const mod2Before = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="guitar-102"]',
    );
    expect(mod2Before?.dataset.moduleStatus).toBe("locked");
    expect(
      mod2Before?.querySelector(".learning-open-lesson")?.tagName,
    ).toBe("BUTTON");
    expect(
      mod2Before?.querySelector(".learning-open-fastlane")?.tagName,
    ).toBe("A");

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

    // Dashboard wurde live aktualisiert
    const xpValue = dashboardEl.querySelector<HTMLElement>(
      "[data-dashboard-xp]",
    )?.dataset.dashboardXp;
    expect(Number(xpValue)).toBeGreaterThan(0);
    expect(xpValue).toBe("171");
    expect(
      dashboardEl.querySelector<HTMLElement>("[data-dashboard-modules]")
        ?.dataset.dashboardModules,
    ).toBe("1/2");

    // Roadmap hat Modul 2 freigeschaltet und Lektion-öffnen-Link aktiviert
    const mod1After = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="theory-101"]',
    );
    const mod2After = roadmapEl.querySelector<HTMLElement>(
      '[data-module-card="guitar-102"]',
    );
    expect(mod1After?.dataset.moduleStatus).toBe("completed");
    expect(mod2After?.dataset.moduleStatus).toBe("unlocked");
    expect(
      mod2After?.querySelector<HTMLAnchorElement>(".learning-open-lesson")
        ?.tagName,
    ).toBe("A");
    expect(
      mod2After?.querySelector('[data-stage-pill="practice"]')?.textContent,
    ).toContain("3. Praxis");

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
