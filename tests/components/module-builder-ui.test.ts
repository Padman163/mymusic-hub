import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachExerciseBuilderForm,
  attachModuleBuilderForm,
  attachModuleCatalogList,
  MODULES_API_ENDPOINT,
  MODULES_FUNCTION_FALLBACK_ENDPOINT,
  MODULES_HTML_RESPONSE_ERROR,
  createTheoryBlockEditor,
} from "../../src/lib/module-builder-ui";
import type { ModulesDatabase } from "../../src/lib/module-schema";

function mountModuleForm(): HTMLFormElement {
  const form = document.createElement("form");
  form.id = "module-builder-form";
  form.innerHTML = `
    <input id="module-id" name="id" type="text" value="theory-101" />
    <input id="module-order" name="order" type="number" value="1" />
    <input id="module-title" name="title" type="text" value="Schall & Tonsystem" />
    <textarea id="module-description" name="description"></textarea>
    <select id="module-scope" name="scope">
      <option value="theory">Theorie</option>
      <option value="instrument">Instrument</option>
    </select>
    <select id="module-level" name="level">
      <option value="100">100</option>
    </select>
    <select id="module-d-stage" name="dStage">
      <option value="">Keine</option>
      <option value="D1">D1</option>
    </select>
    <div id="module-tags-field"></div>
    <input id="module-has-practice" name="hasPractice" type="checkbox" />
    <input id="module-theory-base-xp" name="theoryBaseXp" type="number" value="30" />
    <input id="module-quiz-easy-min" name="quizEasyMinScore" type="number" value="80" />
    <input id="module-fastlane-min" name="fastlaneMinScore" type="number" value="85" />
    <div id="module-theory-blocks-field"></div>
    <button type="submit">Modul speichern</button>
    <button id="module-edit-cancel" type="button" hidden>Abbrechen</button>
    <p class="form-status" role="status"></p>
  `;
  document.body.append(form);
  return form;
}

function mountExerciseForm(): HTMLFormElement {
  const form = document.createElement("form");
  form.id = "exercise-builder-form";
  form.innerHTML = `
    <select id="exercise-module-id" name="moduleId"></select>
    <select id="exercise-target-lane" name="targetLane">
      <option value="exercise">exercise</option>
      <option value="quiz_easy">quiz_easy</option>
      <option value="fastlane">fastlane</option>
    </select>
    <select id="exercise-question-type" name="questionType">
      <option value="single_choice">single_choice</option>
      <option value="multi_select">multi_select</option>
      <option value="numeric_input">numeric_input</option>
      <option value="interactive_notation">interactive_notation</option>
    </select>
    <textarea id="exercise-prompt" name="prompt"></textarea>
    <section id="exercise-choice-section">
      <div id="exercise-choice-rows"></div>
      <button id="exercise-choice-add" type="button">+ Antwortoption</button>
    </section>
    <section id="exercise-numeric-section" hidden>
      <input id="exercise-numeric-answer" name="numericAnswer" type="text" />
    </section>
    <section id="exercise-notation-section" hidden>
      <select id="notation-clef" name="clef">
        <option value="treble">treble</option>
        <option value="bass">bass</option>
      </select>
      <input id="notation-max-notes" name="maxNotes" type="number" value="1" />
      <select id="notation-lock-duration" name="lockDuration">
        <option value="none">none</option>
        <option value="quarter">quarter</option>
      </select>
      <select id="notation-compact" name="compact">
        <option value="false">false</option>
        <option value="tight">tight</option>
        <option value="wide">wide</option>
      </select>
      <input id="notation-show-duration-picker" name="showDurationPicker" type="checkbox" />
      <input id="notation-show-hints" name="showHints" type="checkbox" checked />
      <input id="notation-expected-pitches" name="expectedPitches" type="text" />
      <input id="notation-expected-durations" name="expectedDurations" type="text" />
      <div id="notation-live-preview"></div>
    </section>
    <textarea id="exercise-explanation" name="explanation"></textarea>
    <input id="exercise-base-xp" name="baseXp" type="number" value="10" />
    <div id="exercise-tags-field"></div>
    <span id="exercise-calculated-xp-detail"></span>
    <span id="exercise-calculated-xp"></span>
    <button type="submit">Aufgabe speichern</button>
    <button id="exercise-edit-cancel" type="button" hidden>Abbrechen</button>
    <p class="form-status" role="status"></p>
  `;
  document.body.append(form);
  return form;
}

function mountCatalogSection(): HTMLElement {
  const section = document.createElement("section");
  section.id = "module-catalog-section";
  section.innerHTML = `
    <button id="module-reload-btn" type="button">Neu laden</button>
    <select id="filter-module-scope">
      <option value="">Alle</option>
      <option value="theory">Theorie</option>
    </select>
    <select id="sort-modules">
      <option value="order_asc">1 -> N</option>
      <option value="order_desc">N -> 1</option>
      <option value="xp_desc">XP</option>
    </select>
    <button id="module-view-toggle" type="button">
      <svg class="list-icon"></svg>
      <svg class="cards-icon" style="display: none"></svg>
    </button>
    <p id="module-list-status"></p>
    <ul id="module-catalog-list" class="contribution-list"></ul>
  `;
  document.body.append(section);
  return section;
}

describe("Modul- & Aufgaben-Builder UI-Komponenten", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("fügt Theorie-Blöcke hinzu, sortiert sie um und entfernt sie im Modul-Formular", () => {
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);

    const addBtn = form.querySelector<HTMLButtonElement>(".theory-block-add");
    expect(addBtn).not.toBeNull();
    addBtn?.click();
    addBtn?.click();

    const rows = form.querySelectorAll<HTMLDivElement>(".theory-block-row");
    expect(rows).toHaveLength(2);

    const titles = form.querySelectorAll<HTMLInputElement>(
      ".theory-block-title",
    );
    const markdowns = form.querySelectorAll<HTMLTextAreaElement>(
      ".theory-block-markdown",
    );
    titles[0].value = "Schwingung";
    markdowns[0].value = "Frequenz $f = 440\\text{ Hz}$";
    expect(form.querySelector(".theory-block-visual")).toBeNull();
    expect(form.querySelector(".theory-block-props")).toBeNull();

    titles[1].value = "Obertöne";
    markdowns[1].value = "Ganzzahlige Vielfache";

    rows[1].querySelector<HTMLButtonElement>(".theory-block-up")?.click();

    const reordered = controller.theoryBlockEditor.items();
    expect(reordered?.map((b) => [b.order, b.title])).toEqual([
      [1, "Obertöne"],
      [2, "Schwingung"],
    ]);

    form.querySelector<HTMLButtonElement>(".theory-block-remove")?.click();
    expect(controller.theoryBlockEditor.items()).toHaveLength(1);
    expect(controller.theoryBlockEditor.items()?.[0]?.title).toBe("Schwingung");
  });

  it("überführt bisherige Notation in den Text und erhält andere alte Visualisierungen", () => {
    const editor = createTheoryBlockEditor([
      {
        id: "n", order: 1, title: "Noten", markdownContent: "Vorher",
        visualComponent: "Notation",
        visualPropsJson: '{"clef":"treble","notes":[{"step":2,"duration":"quarter"}]}',
      },
      {
        id: "f", order: 2, title: "Griffbrett", markdownContent: "Text",
        visualComponent: "FretboardClickable",
        visualPropsJson: '{"readOnly":true}',
      },
    ]);
    const blocks = editor.items();
    expect(blocks?.[0].markdownContent).toContain('<Notation clef={"treble"} notes={');
    expect(blocks?.[0].visualComponent).toBeUndefined();
    expect(blocks?.[1].visualComponent).toBe("FretboardClickable");
    expect(blocks?.[1].visualPropsJson).toBe('{"readOnly":true}');
    editor.element.querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => {
        if (button.textContent === "Bisherige Visualisierung entfernen") button.click();
      });
    expect(editor.items()?.[1].visualComponent).toBeUndefined();
  });

  it("übernimmt identische Notation aus Text und alten Props nur einmal", () => {
    const editor = createTheoryBlockEditor([{
      id: "n", order: 1, title: "Noten",
      markdownContent: 'Text\n\n<Notation clef="treble" notes={[]} />',
      visualComponent: "Notation",
      visualPropsJson: '{"notes":[],"clef":"treble"}',
    }]);
    expect(editor.items()?.[0].markdownContent.match(/<Notation/g)).toHaveLength(1);
    expect(editor.items()?.[0].visualComponent).toBeUndefined();
  });

  it("blendet bei interactive_notation die NotationBuilder-Felder und die Live-Vorschau ein", () => {
    const emptyDb: ModulesDatabase = { modules: [], questions: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(emptyDb), { status: 200 })),
    );

    const form = mountExerciseForm();
    attachExerciseBuilderForm(form);

    const typeSelect = form.querySelector<HTMLSelectElement>(
      "#exercise-question-type",
    );
    const choiceSection = form.querySelector<HTMLElement>(
      "#exercise-choice-section",
    );
    const numericSection = form.querySelector<HTMLElement>(
      "#exercise-numeric-section",
    );
    const notationSection = form.querySelector<HTMLElement>(
      "#exercise-notation-section",
    );
    const preview = form.querySelector<HTMLElement>("#notation-live-preview");

    expect(choiceSection?.hidden).toBe(false);
    expect(notationSection?.hidden).toBe(true);

    if (!typeSelect) throw new Error("questionType select fehlt");
    typeSelect.value = "interactive_notation";
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(choiceSection?.hidden).toBe(true);
    expect(numericSection?.hidden).toBe(true);
    expect(notationSection?.hidden).toBe(false);
    expect(preview?.querySelector("svg.notation-staff")).not.toBeNull();

    const durationPickerToggle = form.querySelector<HTMLInputElement>(
      "#notation-show-duration-picker",
    );
    if (!durationPickerToggle) throw new Error("durationPicker checkbox fehlt");
    durationPickerToggle.checked = true;
    durationPickerToggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      preview?.querySelector(".notation-builder-duration-picker"),
    ).not.toBeNull();
  });

  it("berechnet die Aufgaben-XP live anhand von Tag-Multiplikator und Ziel-Lane", () => {
    const emptyDb: ModulesDatabase = { modules: [], questions: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(emptyDb), { status: 200 })),
    );

    const form = mountExerciseForm();
    attachExerciseBuilderForm(form);

    const xpOut = form.querySelector<HTMLElement>("#exercise-calculated-xp");
    const laneSelect = form.querySelector<HTMLSelectElement>(
      "#exercise-target-lane",
    );
    const notensystemTag = form.querySelector<HTMLInputElement>(
      'input[name="exerciseTags"][value="Notensystem"]',
    );

    expect(xpOut?.textContent).toBe("10 XP");
    expect(notensystemTag).not.toBeNull();
    if (!notensystemTag || !laneSelect) {
      throw new Error("Tag- oder Lane-Steuerung fehlt");
    }

    notensystemTag.checked = true;
    notensystemTag.dispatchEvent(new Event("change", { bubbles: true }));
    expect(xpOut?.textContent).toBe("15 XP");

    laneSelect.value = "fastlane";
    laneSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(xpOut?.textContent).toBe("38 XP");
  });

  it("stellt im Modul-Katalog die Zusammenfassung, Ansichts-Umschaltung und Lane-Filter bereit", async () => {
    const sampleDb: ModulesDatabase = {
      modules: [
        {
          id: "theory-101",
          order: 1,
          title: "Schall & Frequenz",
          description: "Physik des Klangs",
          scope: "theory",
          level: 100,
          dStage: "D1",
          tags: ["Allgemein"],
          hasPractice: false,
          theoryBaseXp: 30,
          quizEasyMinScore: 0.8,
          fastlaneMinScore: 0.85,
          theoryBlocks: [
            {
              id: "tb-1",
              order: 1,
              title: "Kammerton A",
              markdownContent: "$440\\text{ Hz}$",
            },
          ],
          createdAt: "2026-11-16T00:00:00.000Z",
          updatedAt: "2026-11-16T00:00:00.000Z",
        },
      ],
      questions: [
        {
          id: "q-1",
          moduleId: "theory-101",
          targetLane: "exercise",
          questionType: "numeric_input",
          prompt: "Welche Frequenz hat A4?",
          correctAnswers: ["440"],
          explanation: "Kammerton A liegt bei 440 Hz.",
          baseXp: 10,
          tags: ["Allgemein"],
        },
        {
          id: "q-2",
          moduleId: "theory-101",
          targetLane: "fastlane",
          questionType: "interactive_notation",
          prompt: "Setze G4 im Violinschlüssel.",
          correctAnswers: [],
          notationTask: { clef: "treble", expectedPitches: ["G4"] },
          explanation: "Zweite Linie von unten.",
          baseXp: 25,
          tags: ["Notensystem"],
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(sampleDb), { status: 200 })),
    );

    const section = mountCatalogSection();
    const controller = attachModuleCatalogList(section);
    controller.renderDatabase(sampleDb);

    expect(section.textContent).toContain("1. Schall & Frequenz");
    expect(section.textContent).toContain("Theorie-Blöcke: 1");
    expect(section.textContent).toContain("Gesamt: 78 XP");

    const toggle = section.querySelector<HTMLButtonElement>("#module-view-toggle");
    const list = section.querySelector<HTMLUListElement>("#module-catalog-list");
    toggle?.click();
    expect(list?.dataset.view).toBe("list");

    const laneFilter = section.querySelector<HTMLSelectElement>(
      ".module-question-lane-filter",
    );
    expect(laneFilter).not.toBeNull();
    if (laneFilter) {
      laneFilter.value = "fastlane";
      laneFilter.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(section.querySelectorAll(".module-question-item")).toHaveLength(1);
    expect(section.querySelector(".module-question-prompt")?.textContent).toBe(
      "Setze G4 im Violinschlüssel.",
    );
  });

  it("fängt HTML-Fehlerseiten (<!DOCTYPE ...) bei Katalog-Reload und Formular-Submit sauber ab und nutzt Fallback-Endpunkte", async () => {
    const htmlNotFound = () =>
      new Response("<!DOCTYPE html><html><body>404 Not Found</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });

    vi.stubGlobal("fetch", vi.fn(htmlNotFound));

    const section = mountCatalogSection();
    const catalog = attachModuleCatalogList(section);
    await catalog.reload();

    const catalogStatus = section.querySelector<HTMLElement>(
      "#module-list-status",
    );
    expect(catalogStatus?.textContent).toBe(MODULES_HTML_RESPONSE_ERROR);
    expect(catalogStatus?.textContent).not.toContain("Unexpected token");

    const form = mountModuleForm();
    attachModuleBuilderForm(form);
    const submitEvent = new Event("submit", { cancelable: true });
    form.dispatchEvent(submitEvent);
    await vi.waitFor(() => {
      const formStatus = form.querySelector<HTMLElement>(".form-status");
      expect(formStatus?.textContent).toBe(MODULES_HTML_RESPONSE_ERROR);
      expect(formStatus?.textContent).not.toContain("Unexpected token");
    });

    const fallbackDb: ModulesDatabase = { modules: [], questions: [] };
    const fetchWithFallback = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === MODULES_API_ENDPOINT) {
        return htmlNotFound();
      }
      if (url === MODULES_FUNCTION_FALLBACK_ENDPOINT) {
        return new Response(JSON.stringify(fallbackDb), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unerwartete URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchWithFallback);

    await catalog.reload();
    expect(catalogStatus?.textContent).toBe("Noch keine Lernmodule gespeichert.");
    expect(fetchWithFallback).toHaveBeenCalledTimes(2);
  });
});
