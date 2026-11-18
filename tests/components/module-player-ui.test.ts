import { afterEach, describe, expect, it, vi } from "vitest";
import { createModulesTestDatabase } from "../fixtures/modules";
import {
  clearLearningProgress,
  completeTheoryBlock,
  createInitialProgress,
  loadLearningProgress,
  saveLearningProgress,
} from "../../src/lib/learning-progress";
import {
  validateModuleInput,
  validateQuestionInput,
} from "../../src/lib/module-store";
import {
  attachModuleRoadmap,
  attachModuleQuizRunner,
  attachModuleStepper,
  attachProgressDashboard,
  evaluateQuestionAnswer,
  renderTheoryMarkdown,
} from "../../src/lib/module-player-ui";
import {
  calculateQuestionXp,
  calculateTheoryBlockXp,
} from "../../src/lib/xp-tags";
import {
  getTheoryDrumPatternError,
  parseTheoryDrumPattern,
} from "../../src/lib/module-theory-notation";

const seedDb = createModulesTestDatabase();

function keyPress(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("Schüler-UI (Dashboard, Roadmap, Stepper & Quiz/Fastlane-Runner)", () => {
  afterEach(() => {
    clearLearningProgress();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("ersetzt eingebettete Module durch einen leeren Live-Katalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify({ modules: [], questions: [] }), {
            status: 200,
          }),
      ),
    );
    const dashboard = document.createElement("section");
    const roadmap = document.createElement("section");
    const stepper = document.createElement("section");
    stepper.dataset.moduleId = seedDb.modules[0].id;
    document.body.append(dashboard, roadmap, stepper);

    attachProgressDashboard(dashboard, { initialDb: seedDb });
    attachModuleRoadmap(roadmap, { initialDb: seedDb });
    attachModuleStepper(stepper, { initialDb: seedDb });

    await vi.waitFor(() => {
      expect(
        dashboard.querySelector<HTMLElement>("[data-dashboard-modules]")
          ?.dataset.dashboardModules,
      ).toBe("0/0");
      expect(roadmap.querySelector("[data-module-card]")).toBeNull();
      expect(roadmap.textContent).toContain("noch keine Lernmodule");
      expect(stepper.textContent).toContain("Kein passendes Lernmodul gefunden");
    });
  });

  it("entfernt gelöschte Module bei einem teilweise geleerten Live-Katalog", async () => {
    const liveDb = structuredClone(seedDb);
    liveDb.modules = [liveDb.modules[1]];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () => new Response(JSON.stringify(liveDb), { status: 200 }),
      ),
    );
    const dashboard = document.createElement("section");
    const roadmap = document.createElement("section");
    document.body.append(dashboard, roadmap);

    attachProgressDashboard(dashboard, { initialDb: seedDb });
    attachModuleRoadmap(roadmap, { initialDb: seedDb });

    await vi.waitFor(() => {
      expect(
        dashboard.querySelector<HTMLElement>("[data-dashboard-modules]")
          ?.dataset.dashboardModules,
      ).toBe("0/1");
      expect(
        roadmap.querySelector(`[data-module-card="${seedDb.modules[0].id}"]`),
      ).toBeNull();
      expect(
        roadmap.querySelector(`[data-module-card="${seedDb.modules[1].id}"]`),
      ).not.toBeNull();
    });
  });

  it("schließt eine Übung nach drei Fehlversuchen mit Lösung, Erklärung und einmaligen XP ab", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    mod.contentOrder = [{ kind: "exercise", id: "q-101-ex-1" }];
    const exercise = db.questions.find(({ id }) => id === "q-101-ex-1");
    if (!exercise) throw new Error("Übung fehlt");
    exercise.title = "Kammerton";
    exercise.simpleHint = "Vergleiche die Tonhöhen.";
    exercise.strongHint = "Überlege, wie sich die Frequenz bei einer Oktave ändert.";
    const root = document.createElement("section");
    root.dataset.moduleId = mod.id;
    document.body.append(root);
    attachModuleStepper(root, { initialDb: db, autoFetch: false });

    expect(root.querySelector(".learning-lesson-heading")?.textContent).toBe("Aufgabe: Kammerton");
    expect(root.querySelector("[data-question-card] .learning-card-header strong")?.textContent)
      .toBe(exercise.prompt);
    const input = root.querySelector<HTMLInputElement>(".learning-numeric-input");
    const check = root.querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
    const next = root.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]');
    if (!input || !check || !next) throw new Error("Übung fehlt");
    check.click();
    expect(root.textContent).toContain("Bitte gib zuerst eine Antwort ein.");
    input.value = "440";
    check.click();
    expect(root.textContent).toContain("2 Versuche übrig");
    expect(root.textContent).not.toContain(exercise.simpleHint);
    expect(root.textContent).not.toContain(exercise.strongHint);
    expect(root.textContent).not.toContain(exercise.explanation);
    expect(root.textContent).not.toContain("Richtige Antwort:");
    expect(next.disabled).toBe(true);
    check.click();
    expect(root.textContent).toContain("1 Versuch übrig");
    expect(root.textContent).toContain(exercise.simpleHint);
    const strongerHint = root.querySelector<HTMLDetailsElement>(".learning-feedback details");
    expect(strongerHint?.open).toBe(false);
    expect(strongerHint?.querySelector("summary")?.textContent)
      .toBe("Stärkeren Hinweis anzeigen");
    expect(strongerHint?.querySelector("p")?.textContent).toBe(exercise.strongHint);
    expect(root.textContent).not.toContain(exercise.explanation);
    expect(root.textContent).not.toContain("Richtige Antwort:");
    input.value = "";
    check.click();
    expect(root.textContent).toContain("Bitte gib zuerst eine Antwort ein.");
    expect(root.textContent).toContain("1 Versuch übrig");
    expect(root.contains(strongerHint ?? null)).toBe(true);
    expect(loadLearningProgress(db.modules).totalXp).toBe(0);
    input.value = "440";
    check.click();
    expect(root.textContent).toContain("Richtige Antwort: 880");
    expect(root.textContent).toContain("Frequenzverhältnis 2:1");
    expect(check.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(loadLearningProgress(db.modules).totalXp).toBe(10);
    check.click();
    expect(loadLearningProgress(db.modules).totalXp).toBe(10);

    next.click();
    root.querySelector<HTMLButtonElement>('[data-action="previous-lesson-section"]')?.click();
    const repeatInput = root.querySelector<HTMLInputElement>(".learning-numeric-input");
    const repeatCheck = root.querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
    if (!repeatInput || !repeatCheck) throw new Error("Wiederholte Übung fehlt");
    expect(repeatInput.disabled).toBe(true);
    expect(repeatCheck.disabled).toBe(true);
    expect(root.textContent).toContain("Lösung: 880");
    repeatCheck.click();
    expect(loadLearningProgress(db.modules).totalXp).toBe(10);
  });

  it.each([
    { answer: "880", attempts: 1 },
    { answer: "440", attempts: 3 },
  ])(
    "sperrt den Rücksprung bis zum Aufgabenabschluss ($attempts Versuch(e))",
    ({ answer, attempts }) => {
      const db = structuredClone(seedDb);
      const mod = db.modules[0];
      mod.theoryBlocks = [mod.theoryBlocks[0]];
      db.questions = db.questions.filter(
        (question) => question.id === "q-101-ex-1",
      );
      mod.contentOrder = [
        { kind: "theory", id: mod.theoryBlocks[0].id },
        { kind: "exercise", id: "q-101-ex-1" },
      ];
      const root = document.createElement("section");
      root.dataset.moduleId = mod.id;
      document.body.append(root);
      attachModuleStepper(root, { initialDb: db, autoFetch: false });

      const markRead = root.querySelector<HTMLButtonElement>(
        '[data-action="complete-theory-block"]',
      );
      if (!markRead) throw new Error("Theorieabschnitt fehlt");
      markRead.click();
      const next = root.querySelector<HTMLButtonElement>(
        '[data-action="next-lesson-section"]',
      );
      if (!next || next.disabled) throw new Error("Aufgabenabschnitt fehlt");
      next.click();

      const previous = root.querySelector<HTMLButtonElement>(
        '[data-action="previous-lesson-section"]',
      );
      const getPreviousStep = () =>
        root.querySelector<HTMLButtonElement>(
          '.learning-lesson-step[data-step-index="0"]',
        );
      const input = root.querySelector<HTMLInputElement>(
        ".learning-numeric-input",
      );
      const check = root.querySelector<HTMLButtonElement>(
        '[data-action="check-exercise"]',
      );
      if (!previous || !getPreviousStep() || !input || !check) {
        throw new Error("Aufgabennavigation fehlt");
      }
      expect(previous.disabled).toBe(true);
      expect(getPreviousStep()?.disabled).toBe(true);

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        input.value = answer;
        check.click();
        if (attempt < attempts - 1) {
          expect(previous.disabled).toBe(true);
          expect(getPreviousStep()?.disabled).toBe(true);
        }
      }

      expect(previous.disabled).toBe(false);
      const previousStep = getPreviousStep();
      if (!previousStep) throw new Error("Schritt-Navigation fehlt");
      expect(previousStep.disabled).toBe(false);
      previousStep.click();
      expect(root.querySelector('[data-step="theory"]')).not.toBeNull();
    },
  );

  it("sperrt den Rücksprung bis eine Praxisaufgabe als erledigt markiert ist", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    mod.theoryBlocks = [mod.theoryBlocks[0]];
    mod.practiceBlocks = [
      { id: "practice-1", title: "Praxis", markdownContent: "Übung." },
    ];
    db.questions = [];
    mod.contentOrder = [
      { kind: "theory", id: mod.theoryBlocks[0].id },
      { kind: "practice", id: "practice-1" },
    ];
    const root = document.createElement("section");
    root.dataset.moduleId = mod.id;
    document.body.append(root);
    attachModuleStepper(root, { initialDb: db, autoFetch: false });

    root
      .querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]')
      ?.click();
    root
      .querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')
      ?.click();
    const previous = root.querySelector<HTMLButtonElement>(
      '[data-action="previous-lesson-section"]',
    );
    const completePractice = root.querySelector<HTMLButtonElement>(
      '[data-action="complete-practice"]',
    );
    if (!previous || !completePractice) {
      throw new Error("Praxisaufgabe fehlt");
    }
    expect(previous.disabled).toBe(true);
    completePractice.click();
    expect(previous.disabled).toBe(false);
  });

  it("merkt sich richtig gelöste Aufgaben bis zum Lernfortschritts-Reset", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const firstRunner = document.createElement("div");
    document.body.append(firstRunner);
    attachModuleQuizRunner(firstRunner, {
      module: mod,
      db,
      mode: "leicht",
      exerciseId: "q-101-ex-1",
    });

    const input = firstRunner.querySelector<HTMLInputElement>(
      ".learning-numeric-input",
    );
    const check = firstRunner.querySelector<HTMLButtonElement>(
      '[data-action="check-exercise"]',
    );
    if (!input || !check) throw new Error("Übung fehlt");
    input.value = "880";
    check.click();
    expect(check.disabled).toBe(true);

    const restoredRunner = document.createElement("div");
    document.body.append(restoredRunner);
    attachModuleQuizRunner(restoredRunner, {
      module: mod,
      db,
      mode: "leicht",
      exerciseId: "q-101-ex-1",
    });
    const restoredInput = restoredRunner.querySelector<HTMLInputElement>(
      ".learning-numeric-input",
    );
    const restoredCheck = restoredRunner.querySelector<HTMLButtonElement>(
      '[data-action="check-exercise"]',
    );
    if (!restoredInput || !restoredCheck) throw new Error("Übung fehlt");
    expect(restoredInput.disabled).toBe(true);
    expect(restoredInput.value).toBe("880");
    expect(restoredCheck.disabled).toBe(true);
    expect(restoredRunner.textContent).toContain("Lösung: 880");

    clearLearningProgress();
    const resetRunner = document.createElement("div");
    document.body.append(resetRunner);
    attachModuleQuizRunner(resetRunner, {
      module: mod,
      db,
      mode: "leicht",
      exerciseId: "q-101-ex-1",
    });
    expect(
      resetRunner.querySelector<HTMLInputElement>(".learning-numeric-input")
        ?.disabled,
    ).toBe(false);
    expect(
      resetRunner.querySelector<HTMLButtonElement>(
        '[data-action="check-exercise"]',
      )?.disabled,
    ).toBe(false);
  });

  it("stellt gespeicherte Auswahl- und Notationsantworten sichtbar wieder her", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const choice = db.questions.find((item) => item.id === "q-101-ex-1");
    const notation = db.questions.find((item) => item.id === "q-101-ex-2");
    if (!choice || !notation) throw new Error("Übungen fehlen");
    choice.questionType = "multi_select";
    choice.options = ["A", "B", "C"];
    choice.correctAnswers = ["A", "B"];
    notation.notationTask = {
      clef: "treble",
      maxNotes: 2,
      expectedPitches: ["C4", "D4"],
      expectedDurations: ["quarter", "quarter"],
    };

    const firstRunner = document.createElement("div");
    document.body.append(firstRunner);
    attachModuleQuizRunner(firstRunner, { module: mod, db, mode: "leicht" });
    const initialCards =
      firstRunner.querySelectorAll<HTMLElement>("[data-question-card]");
    const initialChoices = initialCards[0].querySelectorAll<HTMLInputElement>(
      ".learning-choice-input",
    );
    initialChoices.forEach((input) => {
      input.checked = input.value === "A" || input.value === "B";
    });
    initialCards[0]
      .querySelector<HTMLButtonElement>('[data-action="check-exercise"]')
      ?.click();
    const initialBuilder = initialCards[1].querySelector<HTMLElement>(
      "[data-notation-builder]",
    );
    if (!initialBuilder) throw new Error("Notationsaufgabe fehlt");
    initialBuilder.dataset.placedNotes = JSON.stringify(["C4", "D4"]);
    initialBuilder.dataset.placedDuration = "quarter";
    initialCards[1]
      .querySelector<HTMLButtonElement>('[data-action="check-exercise"]')
      ?.click();

    const root = document.createElement("div");
    document.body.append(root);
    attachModuleQuizRunner(root, { module: mod, db, mode: "leicht" });

    const cards = root.querySelectorAll<HTMLElement>("[data-question-card]");
    const choiceInputs = cards[0].querySelectorAll<HTMLInputElement>(
      ".learning-choice-input",
    );
    expect(
      Array.from(choiceInputs)
        .filter((input) => input.checked)
        .map((input) => input.value),
    ).toEqual(["A", "B"]);
    expect(Array.from(choiceInputs).every((input) => input.disabled)).toBe(true);

    const builder = cards[1].querySelector<HTMLElement>(
      "[data-notation-builder]",
    );
    if (!builder) throw new Error("Notationsaufgabe fehlt");
    expect(JSON.parse(builder.dataset.placedNotes ?? "[]")).toEqual([
      "C4",
      "D4",
    ]);
    expect(JSON.parse(builder.dataset.placedSteps ?? "[]")).toEqual([-2, -1]);
  });

  it("zeigt bei Auswahl- und Notationsübungen die tatsächlich erwarteten Lösungen", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const choice = db.questions.find((item) => item.id === "q-101-ex-1");
    const notation = db.questions.find((item) => item.id === "q-101-ex-2");
    if (!choice || !notation) throw new Error("Übungen fehlen");
    choice.questionType = "multi_select";
    choice.options = ["A", "B", "C"];
    choice.correctAnswers = ["A", "B"];
    notation.notationTask = {
      clef: "treble",
      expectedPitches: ["C4", "D4"],
      expectedDurations: ["quarter", "half"],
    };
    notation.correctAnswers = [];
    notation.explanation = "";
    const root = document.createElement("div");
    document.body.append(root);
    attachModuleQuizRunner(root, { module: mod, db, mode: "leicht" });
    const cards = root.querySelectorAll<HTMLElement>("[data-question-card]");
    const option = cards[0].querySelector<HTMLInputElement>('input[value="C"]');
    const choiceCheck = cards[0].querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
    const builder = cards[1].querySelector<HTMLElement>("[data-notation-builder]");
    const notationCheck = cards[1].querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
    if (!option || !choiceCheck || !builder || !notationCheck) throw new Error("Eingaben fehlen");
    option.checked = true;
    builder.dataset.placedNotes = '["G4"]';
    for (let i = 0; i < 3; i += 1) {
      choiceCheck.click();
      notationCheck.click();
    }
    expect(cards[0].textContent).toContain("Richtige Antwort: A, B");
    expect(cards[1].textContent).toContain("Tonhöhen: C4, D4; Notenwerte: quarter, half");
    expect(cards[1].textContent).toContain("Keine Erklärung hinterlegt.");
  });

  it("vergütet eine richtige Antwort im dritten Versuch ohne Lösungsanzeige", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const root = document.createElement("div");
    document.body.append(root);
    attachModuleQuizRunner(root, { module: mod, db, mode: "leicht", exerciseId: "q-101-ex-1" });
    const input = root.querySelector<HTMLInputElement>(".learning-numeric-input");
    const check = root.querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
    if (!input || !check) throw new Error("Übung fehlt");
    input.value = "440";
    check.click();
    check.click();
    input.value = "880";
    check.click();
    expect(root.textContent).toContain("Richtig!");
    expect(root.textContent).not.toContain("Richtige Antwort:");
    expect(loadLearningProgress(db.modules).totalXp).toBe(10);
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

  it("parst statische DrumPattern-Props und weist ungültige Props oder Code zurück", () => {
    const markdown =
      '<DrumPattern steps={4} continuous={true} patternData={[{ name: "Kick", note: "C1", color: "#ef4444", activeSteps: [0, 2], eventPositions: [1.5], cellLabels: ["K", "", "K", ""] }]} />';
    const parsed = parseTheoryDrumPattern(markdown, 0);
    expect(parsed.props).toMatchObject({
      steps: 4,
      continuous: true,
      patternData: [{
        name: "Kick",
        activeSteps: [0, 2],
        eventPositions: [1.5],
        cellLabels: ["K", "", "K", ""],
      }],
    });
    expect(markdown.slice(parsed.end)).toBe("");
    expect(getTheoryDrumPatternError('<DrumPattern steps={0} />')).toContain(
      "steps muss eine ganze Zahl",
    );
    expect(
      getTheoryDrumPatternError("<DrumPattern interactive={window.alert(1)} />"),
    ).toContain("Nur feste Werte");
    const staticArithmetic = parseTheoryDrumPattern(
      '<DrumPattern steps={16} patternData={[{ name: "Triolen", note: "12×", color: "#facc15", activeSteps: [], eventPositions: [0, 4 / 3, 8 / 3, 4] }]} />',
      0,
    );
    expect(staticArithmetic.props.patternData?.[0].eventPositions).toEqual([
      0,
      4 / 3,
      8 / 3,
      4,
    ]);
    expect(getTheoryDrumPatternError("`<DrumPattern steps={0} />`")).toBeNull();
    expect(
      getTheoryDrumPatternError("<!-- <DrumPattern steps={0} /> -->"),
    ).toBeNull();
  });

  it("rendert DrumPattern-Props samt Event-Markern und bindet die Interaktion", () => {
    const root = document.createElement("section");
    root.innerHTML =
      '<div hidden data-visual-template="DrumPattern"><div class="studio-one-pattern astro-test"></div></div>';
    root.append(
      renderTheoryMarkdown(
        '<DrumPattern steps={4} continuous={true} showVelocity={true} patternData={[{ name: "Kick", note: "C1", color: "#ef4444", activeSteps: [0, 2], cellLabels: ["K", "", "K", ""], eventPositions: [1.5], eventLabels: ["+"] }]} />',
        root,
      ),
    );
    const pattern = root.querySelector<HTMLElement>(
      '.studio-one-pattern[data-continuous="true"]',
    );
    if (!pattern) throw new Error("DrumPattern fehlt");
    const cells = pattern.querySelectorAll<HTMLElement>(".step-cell");
    expect(pattern.dataset.continuous).toBe("true");
    expect(pattern.classList.contains("astro-test")).toBe(true);
    expect(cells[0].querySelector(".step-cell-label")?.textContent).toBe("K");
    expect(pattern.querySelector(".event-marker")?.textContent).toBe("+");
    expect(
      (pattern.querySelector(".event-marker") as HTMLElement).style.getPropertyValue(
        "--event-step",
      ),
    ).toBe("1.5");
    expect(pattern.querySelector(".velocity-row")).not.toBeNull();
    cells[0].click();
    expect(cells[0].classList.contains("active")).toBe(false);
  });

  it("rendert Markdown, verschachteltes Inline-KaTeX und beide Display-Formate", () => {
    const container = document.createElement("div");
    container.append(renderTheoryMarkdown([
      "## Frequenz",
      "Ein erster Absatz.",
      String.raw`* **Kammerton $A_4$:** 440 $\text{Hz}$`,
      String.raw`* Schreibweisen: $a'$, $\sharp$ und $\flat$`,
      "",
      "$$f = 440$$",
      "",
      "$$",
      "f_2 = 2 f_1",
      "$$",
      "",
      "Ein zweiter Absatz.",
    ].join("\n")));
    expect(container.querySelector("h2")?.textContent).toBe("Frequenz");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("strong .katex")).not.toBeNull();
    expect(container.querySelectorAll("li .katex")).toHaveLength(5);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
    expect(container.textContent).not.toContain("$");
    expect(container.lastElementChild?.textContent).toBe("Ein zweiter Absatz.");
  });

  it("rendert die Fermate als zugängliches SVG statt als unbekannten KaTeX-Befehl", () => {
    const container = document.createElement("div");
    container.append(renderTheoryMarkdown("Fermate ($\\fermata$)"));
    const fermata = container.querySelector<SVGSVGElement>(
      ".learning-fermata-symbol",
    );

    expect(fermata?.getAttribute("role")).toBe("img");
    expect(fermata?.getAttribute("aria-label")).toBe("Fermate");
    expect(fermata?.querySelector("path")).not.toBeNull();
    expect(fermata?.querySelector("circle")).not.toBeNull();
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.textContent).not.toContain("\\fermata");
  });

  it("rendert statische Inline-SVG-Figuren und entfernt aktive oder nicht erlaubte SVG-Inhalte", () => {
    const container = document.createElement("div");
    container.append(renderTheoryMarkdown([
      '<figure onclick="alert(1)">',
      '  <svg viewBox="0 0 720 250" role="img" aria-labelledby="wave-title wave-description" onload="alert(1)" style="background:url(javascript:alert(1))">',
      '    <title id="wave-title">Schwingungen</title>',
      '    <desc id="wave-description">Zwei Wellen im Vergleich.</desc>',
      '    <line x1="190" y1="48" x2="650" y2="48" stroke="#64748b" stroke-dasharray="4 5" />',
      '    <text x="12" y="53" fill="currentColor" font-size="16" text-anchor="middle">Langsam</text>',
      '    <path d="M190 48 Q305 8 420 48 T650 48" fill="none" stroke="#38bdf8" stroke-width="4" />',
      '    <path d="M0 0" fill="url(javascript:alert(1))" />',
      '    <script>alert(1)</script>',
      '    <foreignObject><iframe src="https://example.com" onload="alert(1)"></iframe></foreignObject>',
      "  </svg>",
      "  <figcaption>Statische SVG-Figur.</figcaption>",
      "</figure>",
    ].join("\n")));

    const figure = container.querySelector("figure");
    const svg = figure?.querySelector("svg");
    expect(figure?.querySelector("figcaption")?.textContent).toBe("Statische SVG-Figur.");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 720 250");
    expect(svg?.getAttribute("aria-labelledby")).toBe(
      "user-content-wave-title user-content-wave-description",
    );
    expect(svg?.querySelector("line")?.getAttribute("stroke-dasharray")).toBe("4 5");
    expect(svg?.querySelector("text")?.getAttribute("font-size")).toBe("16");
    expect(svg?.querySelector("path")?.getAttribute("stroke-width")).toBe("4");
    expect(svg?.querySelectorAll("path")[1]?.hasAttribute("fill")).toBe(false);
    expect(figure?.hasAttribute("onclick")).toBe(false);
    expect(svg?.hasAttribute("onload")).toBe(false);
    expect(svg?.hasAttribute("style")).toBe(false);
    expect(svg?.querySelector("script, foreignObject, iframe")).toBeNull();
  });

  it("bettet die passende Keyboard-Vorlage ein und lässt Codebeispiele unverändert", () => {
    const root = document.createElement("div");
    root.innerHTML = '<template data-visual-template="NotationKeyboard" data-show-brace="false" data-right-bar-style="single"><div class="keyboard-notation"></div></template>';
    root.append(renderTheoryMarkdown([
      "~~~md",
      "<NotationKeyboard />",
      "~~~",
      "",
      "<NotationKeyboard showBrace={false} rightBarStyle='single' />",
      "",
      "<NotationKeyboard showBrace={window.alert(1)} />",
    ].join("\n"), root));
    expect(root.querySelector("pre code")?.textContent).toContain("<NotationKeyboard />");
    expect(root.querySelectorAll(":scope > .keyboard-notation")).toHaveLength(1);
    expect(root.querySelector(".learning-notation-error")?.textContent).toContain("Nur feste Werte");
  });

  it("zeigt eine alte Visualisierung nicht doppelt, wenn dieselbe Notation bereits im Text steht", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    db.modules[0].theoryBlocks[0].markdownContent =
      'Text\n\n<Notation clef="treble" notes={[]} />';
    db.modules[0].theoryBlocks[0].visualComponent = "Notation";
    db.modules[0].theoryBlocks[0].visualPropsJson = '{"notes":[],"clef":"treble"}';
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    expect(root.querySelector(".learning-theory-block")?.querySelectorAll("svg.notation-staff")).toHaveLength(1);
    expect(root.textContent).not.toContain("<Notation");
  });

  it("rendert gruppierte Theorieblöcke als benannten Lernabschnitt", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    db.modules[0].theoryBlocks[0].groupId = "group-basics";
    db.modules[0].theoryBlocks[0].groupTitle = "Grundlagen";
    db.modules[0].theoryBlocks[1].groupId = "group-basics";
    db.modules[0].theoryBlocks[1].groupTitle = "Grundlagen";

    attachModuleStepper(root, { initialDb: db, autoFetch: false });

    const group = root.querySelector(".learning-theory-group");
    expect(group?.querySelector(".learning-lesson-heading")?.textContent).toBe("101: Grundlagen");
    expect(group?.querySelectorAll(".learning-theory-block")).toHaveLength(2);
    const groupXp = db.modules[0].theoryBlocks
      .slice(0, 2)
      .reduce(
        (total, block) =>
          total + calculateTheoryBlockXp(block, db.modules[0].theoryBaseXp),
        0,
      );
    expect(group?.querySelector(".learning-theory-heading .learning-xp-badge")?.textContent)
      .toBe(`${groupXp} XP`);
    expect(group?.querySelector(".learning-theory-heading")?.firstElementChild?.tagName)
      .toBe("H3");
  });

  it("zeigt gruppierte Übungen gemeinsam mit Theorie und wartet auf beide Abschlüsse", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const block = mod.theoryBlocks[0];
    const question = db.questions.find((item) => item.id === "q-101-ex-1");
    if (!question) throw new Error("Gruppenübung fehlt");
    question.title = "Kammerton";
    mod.contentOrder = [
      {
        kind: "theory",
        id: block.id,
        groupId: "mixed-group",
        groupTitle: "Grundlagen",
      },
      {
        kind: "exercise",
        id: question.id,
        groupId: "mixed-group",
        groupTitle: "Grundlagen",
      },
    ];

    attachModuleStepper(root, { initialDb: db, autoFetch: false });

    const group = root.querySelector(".learning-content-group");
    expect(group?.querySelector(".learning-lesson-heading")?.textContent).toBe("101: Grundlagen");
    expect(group?.querySelector(".learning-theory-block")).not.toBeNull();
    const exerciseCard = group?.querySelector('[data-question-card="q-101-ex-1"]');
    expect(exerciseCard?.querySelector(".learning-card-header strong")?.textContent)
      .toBe("Aufgabe: Kammerton");
    expect(exerciseCard?.textContent).toContain(question.prompt);
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="next-lesson-section"]',
    );
    expect(next?.disabled).toBe(true);

    root.querySelector<HTMLButtonElement>(
      '[data-action="complete-theory-block"]',
    )?.click();
    expect(next?.disabled).toBe(true);
    const input = group?.querySelector<HTMLInputElement>(
      '[data-question-card="q-101-ex-1"] .learning-numeric-input',
    );
    const answerButton = group?.querySelector<HTMLButtonElement>(
      '[data-question-card="q-101-ex-1"] [data-action="check-exercise"]',
    );
    if (!input || !answerButton) throw new Error("Gruppenübung fehlt");
    input.value = "880";
    answerButton.click();
    expect(next?.disabled).toBe(false);
  });

  it("zeigt XP für einzelne Theorieblöcke rechts neben dem Titel", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    const [block, other] = mod.theoryBlocks;
    delete block.groupId;
    delete block.groupTitle;
    block.title = "Theorie 1 101.1: Schall, Frequenz & Klangfarbe";
    mod.level = 200;
    mod.contentOrder = [{ kind: "theory", id: block.id }, { kind: "theory", id: other.id }];
    block.order = 99;

    attachModuleStepper(root, { initialDb: db, autoFetch: false });

    const heading = root.querySelector(".learning-theory-block .learning-theory-heading");
    expect(heading?.querySelector(".learning-xp-badge")?.textContent)
      .toBe(`${calculateTheoryBlockXp(block, db.modules[0].theoryBaseXp)} XP`);
    expect(heading?.firstElementChild?.textContent).toBe("201: Schall, Frequenz & Klangfarbe");
    expect(root.querySelector(".learning-lesson-step")?.textContent).toBe("201: Schall, Frequenz & Klangfarbe");
  });

  it("vergütet beim Abschluss einer teilweise erledigten Gruppe nur offene Blöcke", () => {
    const root = document.createElement("section");
    root.dataset.moduleId = "theory-101";
    document.body.append(root);
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    for (const block of mod.theoryBlocks.slice(0, 2)) {
      block.groupId = "group-basics";
      block.groupTitle = "Grundlagen";
    }
    const state = completeTheoryBlock(createInitialProgress(db.modules), mod, mod.theoryBlocks[0].id);
    saveLearningProgress(state);
    const dashboard = document.createElement("section");
    document.body.append(dashboard);
    attachProgressDashboard(dashboard, { initialDb: db, autoFetch: false });
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    root.querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]')?.click();
    const expected = mod.theoryBlocks.slice(0, 2).reduce(
      (sum, block) => sum + calculateTheoryBlockXp(block, mod.theoryBaseXp), 0,
    );
    expect(dashboard.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset.dashboardXp).toBe(String(expected));
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

  it.each([
    ["Mit welcher Frequenz (in Hz) schwingt der Ton?", ["880"], "Hz"],
    ["Mit welcher Frequenz schwingt der Ton?", ["880 Hz"], "Hz"],
    ["Wie viele Schläge dauert der Ton?", ["880"], null],
    ["Mit welcher Frequenz schwingt der Ton?", ["880 Hz", "0,88 kHz"], null],
  ] as const)(
    "zeigt eine eindeutige feste Einheit für %s (Antworten: %j)",
    (prompt, correctAnswers, unit) => {
      const db = structuredClone(seedDb);
      const mod = db.modules[0];
      const question = db.questions.find(({ id }) => id === "q-101-ex-1");
      if (!question) throw new Error("Zahlenfrage fehlt");
      question.prompt = prompt;
      question.correctAnswers = [...correctAnswers];
      const root = document.createElement("section");
      document.body.append(root);
      const render = () =>
        attachModuleQuizRunner(root, {
          module: mod,
          db,
          mode: "leicht",
          exerciseId: question.id,
        });
      render();

      const input = root.querySelector<HTMLInputElement>(".learning-numeric-input");
      const check = root.querySelector<HTMLButtonElement>('[data-action="check-exercise"]');
      if (!input || !check) throw new Error("Zahleneingabe fehlt");
      expect(input.value).toBe("");
      expect(root.querySelector(".learning-numeric-unit")?.textContent ?? null)
        .toBe(unit);
      if (unit) {
        expect(input.nextElementSibling?.textContent).toBe(unit);
        expect(evaluateQuestionAnswer(question, { kind: "numeric", value: "880 kHz" }).correct)
          .toBe(false);
      }

      input.value = "880";
      check.click();
      expect(root.querySelector(".learning-feedback")?.getAttribute("data-outcome"))
        .toBe("correct");
      render();
      expect(root.querySelector<HTMLInputElement>(".learning-numeric-input")?.value)
        .toBe(unit ? "880" : correctAnswers[0]);
    },
  );

  it("enthält valide Lernmodul-Fixtures", () => {
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

  it("führt in gemischter Reihenfolge durch Übungen und Gruppen und setzt nach dem Neuladen fort", () => {
    const db = structuredClone(seedDb);
    db.questions = db.questions.filter((q) =>
      q.moduleIds[0] !== "theory-101" || q.targetLane !== "leicht" ||
      ["q-101-ex-1", "q-101-ex-2"].includes(q.id),
    );
    const mod = db.modules[0];
    for (const block of mod.theoryBlocks.slice(0, 2)) {
      block.groupId = "g";
      block.groupTitle = "Grundlagen";
    }
    delete mod.theoryBlocks[2].groupId;
    delete mod.theoryBlocks[2].groupTitle;
    mod.contentOrder = [
      { kind: "exercise", id: "q-101-ex-1" },
      { kind: "theory", id: mod.theoryBlocks[0].id },
      { kind: "theory", id: mod.theoryBlocks[1].id },
      { kind: "exercise", id: "q-101-ex-2" },
      { kind: "theory", id: mod.theoryBlocks[2].id },
    ];
    const dashboardEl = document.createElement("section");
    let stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    document.body.append(dashboardEl, stepperEl);
    attachProgressDashboard(dashboardEl, { initialDb: db, autoFetch: false });
    attachModuleStepper(stepperEl, { initialDb: db, autoFetch: false });

    expect(stepperEl.querySelector(".learning-lesson-counter")?.textContent).toBe("Abschnitt 1 / 5");
    const steps = stepperEl.querySelectorAll<HTMLButtonElement>(".learning-lesson-step");
    expect(steps).toHaveLength(5);
    expect(Array.from(steps).every((step) => step.disabled)).toBe(true);
    expect(stepperEl.querySelectorAll(".learning-quiz-card")).toHaveLength(1);
    expect(stepperEl.querySelector(".learning-theory-block")).toBeNull();
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(true);
    const ex1Card = stepperEl.querySelector<HTMLElement>(
      '[data-question-card="q-101-ex-1"]',
    );
    const ex1Xp = ex1Card?.querySelector<HTMLElement>(".learning-xp-badge");
    expect(ex1Xp?.closest(".learning-card-header")?.lastElementChild).toBe(ex1Xp);
    expect(ex1Xp?.classList.contains("has-xp")).toBe(false);
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
    expect(feedback?.textContent).toContain("2 Versuche übrig");
    expect(feedback?.textContent).not.toContain("Frequenzverhältnis 2:1");
    expect(ex1Xp?.classList.contains("has-xp")).toBe(false);
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(true);

    ex1Input.value = "880 Hz";
    ex1Btn.click();
    expect(feedback?.dataset.outcome).toBe("correct");
    expect(ex1Xp?.classList.contains("has-xp")).toBe(true);
    expect(ex1Xp?.textContent).toMatch(/^\d+ XP$/);
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(false);
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-step-index="0"]')?.disabled).toBe(false);
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-step-index="1"]')?.disabled).toBe(true);
    expect(stepperEl.querySelector('[data-question-card="q-101-ex-1"]')).not.toBeNull();
    expect(dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset.dashboardXp).toBe("10");

    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(stepperEl.querySelector(".learning-lesson-counter")?.textContent).toBe("Abschnitt 2 / 5");
    stepperEl.querySelector<HTMLButtonElement>('[data-step-index="0"]')?.click();
    expect(stepperEl.querySelector('[data-question-card="q-101-ex-1"]')).not.toBeNull();
    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(stepperEl.querySelector(".learning-theory-group")).not.toBeNull();

    stepperEl.remove();
    stepperEl = document.createElement("section");
    stepperEl.dataset.moduleId = "theory-101";
    document.body.append(stepperEl);
    attachModuleStepper(stepperEl, { initialDb: db, autoFetch: false });
    expect(stepperEl.querySelector(".learning-lesson-counter")?.textContent).toBe("Abschnitt 2 / 5");
    expect(stepperEl.querySelector(".learning-theory-group .learning-lesson-heading")?.textContent).toBe("102: Grundlagen");
    expect(stepperEl.querySelector('[data-step-index="1"]')?.textContent).toBe("102: Grundlagen");
    expect(stepperEl.querySelectorAll(".learning-theory-group .learning-theory-block")).toHaveLength(2);
    expect(stepperEl.querySelector(".katex")).not.toBeNull();
    expect(stepperEl.querySelector("svg.notation-staff")).not.toBeNull();
    const readButton = stepperEl.querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]');
    expect(readButton?.textContent).toBe("Abschnitt gelesen");
    readButton?.click();
    const groupXp = mod.theoryBlocks.slice(0, 2).reduce(
      (sum, block) => sum + calculateTheoryBlockXp(block, mod.theoryBaseXp), 0,
    );
    expect(dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset.dashboardXp).toBe(String(10 + groupXp));
    stepperEl.querySelector<HTMLButtonElement>('[data-action="previous-lesson-section"]')?.click();
    expect(stepperEl.querySelector('[data-question-card="q-101-ex-1"]')).not.toBeNull();
    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]')?.disabled).toBe(true);
    expect(dashboardEl.querySelector<HTMLElement>("[data-dashboard-xp]")?.dataset.dashboardXp).toBe(String(10 + groupXp));
    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
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
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(false);
    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(stepperEl.querySelector('[data-step="theory"]')).not.toBeNull();
    expect(stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(true);
    stepperEl.querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]')?.click();
    stepperEl.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(stepperEl.querySelector('[data-step="quiz"]')).not.toBeNull();

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
    expect(quizLink?.textContent).toBe("Quiz starten");
    expect(
      mod1Card?.querySelector('[data-roadmap-stat="quiz"]')?.textContent,
    ).toBe("Quiz 0/1");
  });

  it("fügt fehlende Inhalte aus einer veralteten Reihenfolge an und behandelt Gruppen als Einheit", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    for (const block of mod.theoryBlocks.slice(0, 2)) {
      block.groupId = "group-basics";
      block.groupTitle = "Grundlagen";
    }
    db.questions = db.questions.filter(
      (q) => q.moduleIds[0] !== mod.id || q.targetLane !== "leicht" || q.id === "q-101-ex-1",
    );
    mod.contentOrder = [
      { kind: "theory", id: mod.theoryBlocks[1].id },
      { kind: "exercise", id: "removed-question" },
      { kind: "exercise", id: "q-101-ex-1" },
    ];
    const root = document.createElement("section");
    root.dataset.moduleId = mod.id;
    document.body.append(root);
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    expect(root.querySelector(".learning-lesson-counter")?.textContent).toBe("Abschnitt 1 / 4");
    expect(root.querySelectorAll(".learning-theory-group .learning-theory-block")).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('[data-action="complete-theory-block"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(root.querySelector('[data-question-card="q-101-ex-1"]')).not.toBeNull();
  });

  it("überspringt leere Theorie und Übungen und lässt den Praxisteil vor dem Quiz abschließen", () => {
    const db = structuredClone(seedDb);
    const mod = db.modules[0];
    mod.practiceBlocks = [
      { id: "pb-1", title: "Am Instrument üben", markdownContent: "Spiele den Ton A." },
    ];
    mod.theoryBlocks = [];
    mod.contentOrder = [];
    db.questions = db.questions.filter(
      (q) => q.moduleIds[0] !== mod.id || q.targetLane !== "leicht",
    );
    const root = document.createElement("section");
    root.dataset.moduleId = mod.id;
    document.body.append(root);
    attachModuleStepper(root, { initialDb: db, autoFetch: false });
    expect(root.querySelector(".learning-lesson-counter")?.textContent).toBe("Abschnitt 1 / 2");
    expect(root.querySelector('[data-step="practice"]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-action="complete-practice"]')?.click();
    expect(root.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-action="next-lesson-section"]')?.click();
    expect(root.querySelector('[data-step="quiz"] .learning-quiz-card')).not.toBeNull();
  });

  it("aktualisiert Dashboard und Roadmap nach bestandenem Fastlane-Quiz inklusive Freischaltung von Modul 2", () => {
    const db = structuredClone(seedDb);
    db.questions = db.questions.filter((q) =>
      q.moduleIds[0] !== "theory-101" || q.targetLane !== "leicht" ||
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
    const expectedXp =
      db.modules[0].theoryBlocks.reduce(
        (total, block) =>
          total + calculateTheoryBlockXp(block, db.modules[0].theoryBaseXp),
        0,
      ) +
      db.questions
        .filter((question) => question.moduleIds.includes(db.modules[0].id))
        .reduce(
          (total, question) =>
            total + calculateQuestionXp(question.baseXp, question.tags),
          0,
        );
    expect(xpValue).toBe(String(expectedXp));
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

    const reset = mod1After?.querySelector<HTMLButtonElement>(
      '.learning-start-quiz + [data-action="request-reset"]',
    );
    const confirmation = mod1After?.querySelector<HTMLElement>(
      ".learning-reset-confirm",
    );
    const cancel = confirmation?.querySelector<HTMLButtonElement>(
      '[data-action="cancel-reset"]',
    );
    const confirm = confirmation?.querySelector<HTMLButtonElement>(
      '[data-action="confirm-reset"]',
    );
    if (!reset || !confirmation || !cancel || !confirm) {
      throw new Error("Reset neben der Quizaktion fehlt");
    }

    expect(confirmation.hidden).toBe(true);
    reset.click();
    expect(confirmation.hidden).toBe(false);
    expect(loadLearningProgress(db.modules).totalXp).toBe(expectedXp);
    cancel.click();
    expect(confirmation.hidden).toBe(true);
    expect(loadLearningProgress(db.modules).totalXp).toBe(expectedXp);

    reset.click();
    confirm.click();
    expect(loadLearningProgress(db.modules).totalXp).toBe(0);
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
