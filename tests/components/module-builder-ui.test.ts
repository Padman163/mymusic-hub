import { afterEach, describe, expect, it, vi } from "vitest";
import seedDb from "../../data/modules.json";
import {
  attachExerciseBuilderForm,
  attachModuleBuilderForm,
  attachModuleCatalogList,
  attachQuizSettingsForm,
  MODULES_API_ENDPOINT,
  MODULES_FUNCTION_FALLBACK_ENDPOINT,
  MODULES_HTML_RESPONSE_ERROR,
  MODULE_DETAIL_PATH,
  createTheoryBlockEditor,
  createXpTagPicker,
} from "../../src/lib/module-builder-ui";
import type { ModulesDatabase } from "../../src/lib/module-schema";

function mountModuleForm(): HTMLFormElement {
  const form = document.createElement("form");
  form.id = "module-builder-form";
  form.innerHTML = `
    <details id="module-general-info"><summary>Allgemeine Informationen</summary>
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
    </details>
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
      <option value="leicht">leicht</option>
      <option value="mittel">mittel</option>
      <option value="schwer">schwer</option>
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
        <option value="tight">Kompakt</option>
        <option value="wide" selected>Standard</option>
        <option value="false">Breit</option>
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
      <svg class="list-icon" style="display: none"></svg>
      <svg class="cards-icon"></svg>
    </button>
    <p id="module-list-status"></p>
    <ul id="module-catalog-list" class="contribution-list" data-view="list"></ul>
  `;
  document.body.append(section);
  return section;
}

describe("Modul- & Aufgaben-Builder UI-Komponenten", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("erstellt neue Modul-IDs automatisch und behält bestehende IDs beim Bearbeiten", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(form.querySelector(".form-status")?.textContent).toBe("Modul wurde gespeichert."));
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(first.id).toMatch(/^mod-[0-9a-f-]{36}$/);
    expect(first.order).toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");

    controller.loadModule(seedDb.modules[0] as ModulesDatabase["modules"][number]);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const edited = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(edited.id).toBe("theory-101");
    expect(edited.order).toBeUndefined();
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT");
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
    expect(Array.from(rows).every((row) => !row.querySelector("details")?.open)).toBe(true);

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

  it("gruppiert ausgewählte Theorieblöcke, speichert den Abschnittstitel und verschiebt die Gruppe zusammen", () => {
    const editor = createTheoryBlockEditor([
      { id: "a", order: 1, title: "A", markdownContent: "" },
      { id: "b", order: 2, title: "B", markdownContent: "" },
      { id: "c", order: 3, title: "C", markdownContent: "" },
    ]);
    document.body.append(editor.element);

    const rows = Array.from(
      editor.element.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );
    for (const index of [0, 2]) {
      const checkbox = rows[index].querySelector<HTMLInputElement>(
        ".theory-block-select",
      );
      if (!checkbox) throw new Error("Auswahlfeld fehlt");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
    }

    const groupButton = editor.element.querySelector<HTMLButtonElement>(
      ".theory-block-group-selected",
    );
    expect(groupButton?.disabled).toBe(false);
    groupButton?.click();

    const groupTitle = editor.element.querySelector<HTMLInputElement>(
      ".theory-group-title",
    );
    if (!groupTitle) throw new Error("Gruppentitel fehlt");
    expect(groupTitle.value).toBe("A & C");
    const groupCard = editor.element.querySelector<HTMLDivElement>(
      ".theory-block-group",
    );
    expect(groupCard).not.toBeNull();
    expect(groupCard?.querySelectorAll(".theory-block-row")).toHaveLength(2);
    expect(rows[0].parentElement).toBe(groupCard);
    expect(rows[2].parentElement).toBe(groupCard);
    expect(rows[0].dataset.groupPosition).toBe("first");
    expect(rows[2].dataset.groupPosition).toBe("last");
    expect(rows[1].dataset.groupPosition).toBeUndefined();
    expect(rows[0].querySelector<HTMLLabelElement>(".theory-block-select-label")?.hidden).toBe(true);
    expect(rows[2].querySelector<HTMLLabelElement>(".theory-block-select-label")?.hidden).toBe(true);
    expect(rows[1].querySelector<HTMLLabelElement>(".theory-block-select-label")?.hidden).toBe(false);
    groupTitle.value = "Grundlagen";
    groupTitle.dispatchEvent(new Event("input"));

    editor.element
      .querySelector<HTMLButtonElement>(".theory-group-down")
      ?.click();

    expect(editor.items()?.map(({ title, groupTitle: section }) => [
      title,
      section,
    ])).toEqual([
      ["B", undefined],
      ["A", "Grundlagen"],
      ["C", "Grundlagen"],
    ]);
    expect(editor.contentOrder().map(({ id }) => id)).toEqual(["b", "a", "c"]);

    const firstGroupBlock = editor.element.querySelector<HTMLDivElement>(
      '.theory-block-row[data-block-id="a"]',
    );
    firstGroupBlock
      ?.querySelector<HTMLButtonElement>(".theory-block-remove")
      ?.click();
    expect(editor.items()?.map(({ title, groupTitle: section }) => [
      title,
      section,
    ])).toEqual([
      ["B", undefined],
      ["C", "Grundlagen"],
    ]);
    expect(rows[2].dataset.groupPosition).toBe("single");
  });

  it("verwendet bei mehreren Blöcken ihre Titel als Gruppennamen und zeigt die Auswahl nach Auflösen wieder an", () => {
    const editor = createTheoryBlockEditor([
      { id: "a", order: 1, title: " Eins ", markdownContent: "" },
      { id: "b", order: 2, title: "Zwei", markdownContent: "" },
      { id: "c", order: 3, title: "Drei", markdownContent: "" },
    ]);
    document.body.append(editor.element);
    const rows = Array.from(
      editor.element.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );
    for (const row of rows) {
      const checkbox = row.querySelector<HTMLInputElement>(".theory-block-select");
      if (!checkbox) throw new Error("Auswahlfeld fehlt");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
    }
    editor.element.querySelector<HTMLButtonElement>(".theory-block-group-selected")?.click();
    expect(editor.element.querySelector<HTMLInputElement>(".theory-group-title")?.value).toBe("Eins, Zwei & Drei");
    expect(rows.map((row) => row.dataset.groupPosition)).toEqual(["first", "middle", "last"]);
    expect(editor.items()?.map((block) => block.groupTitle)).toEqual([
      "Eins, Zwei & Drei", "Eins, Zwei & Drei", "Eins, Zwei & Drei",
    ]);

    editor.element.querySelector<HTMLButtonElement>(".theory-group-ungroup")?.click();
    expect(rows.map((row) => row.dataset.groupPosition)).toEqual([undefined, undefined, undefined]);
    expect(rows.every((row) => {
      const label = row.querySelector<HTMLLabelElement>(".theory-block-select-label");
      const checkbox = row.querySelector<HTMLInputElement>(".theory-block-select");
      return label && !label.hidden && checkbox && !checkbox.disabled;
    })).toBe(true);
  });

  it("zeigt gespeicherte Gruppen auch nach erneutem Laden als zusammenhängend an", () => {
    const editor = createTheoryBlockEditor([
      { id: "a", order: 1, title: "A", markdownContent: "", groupId: "g", groupTitle: "Mein Abschnitt" },
      { id: "b", order: 2, title: "B", markdownContent: "", groupId: "g", groupTitle: "Mein Abschnitt" },
    ]);
    const rows = Array.from(
      editor.element.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );
    expect(rows.map((row) => row.dataset.groupPosition)).toEqual(["first", "last"]);
    expect(rows.every((row) => row.querySelector<HTMLLabelElement>(".theory-block-select-label")?.hidden)).toBe(true);
    expect(editor.element.querySelector<HTMLInputElement>(".theory-group-title")?.value).toBe("Mein Abschnitt");
  });

  it("gruppiert Theorieblöcke und Übungen gemeinsam und speichert die Gruppe", async () => {
    const db = seedDb as unknown as ModulesDatabase;
    const exercise = db.questions.find((q) => q.id === "q-101-ex-1");
    if (!exercise) throw new Error("Testübung fehlt");
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => init?.method === "PUT"
      ? new Response("{}", { status: 200 })
      : new Response(JSON.stringify(db), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
    vi.stubGlobal("fetch", fetchMock);
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    const mod = {
      ...db.modules[0],
      theoryBlocks: [db.modules[0].theoryBlocks[0]],
      contentOrder: undefined,
    };
    controller.loadModule(mod, [exercise]);

    const theoryRow = form.querySelector<HTMLElement>(".theory-block-row");
    const exerciseRow = form.querySelector<HTMLElement>(".module-exercise-row");
    theoryRow?.querySelector<HTMLInputElement>(".theory-block-select")?.click();
    exerciseRow?.querySelector<HTMLInputElement>(".theory-block-select")?.click();
    form.querySelector<HTMLButtonElement>(".theory-block-group-selected")?.click();

    const grouped = controller.theoryBlockEditor.contentOrder();
    expect(grouped).toHaveLength(2);
    expect(grouped[0].groupId).toBeTruthy();
    expect(grouped[1]).toMatchObject({
      kind: "exercise",
      id: exercise.id,
      groupId: grouped[0].groupId,
      groupTitle: grouped[0].groupTitle,
    });

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true),
    );
    const saveCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const saved = JSON.parse(String(saveCall?.[1]?.body));
    expect(saved.contentOrder).toEqual(grouped);
  });

  it("lädt gespeicherte gemischte Gruppen mit der Übung im Abschnitt", () => {
    const db = seedDb as unknown as ModulesDatabase;
    const exercise = db.questions.find((q) => q.id === "q-101-ex-1");
    const block = db.modules[0].theoryBlocks[0];
    if (!exercise || !block) throw new Error("Testinhalte fehlen");
    const groupId = "group-mixed";
    const groupTitle = "Grundlagen";
    const contentOrder = [
      { kind: "theory" as const, id: block.id, groupId, groupTitle },
      { kind: "exercise" as const, id: exercise.id, groupId, groupTitle },
    ];
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    controller.loadModule({
      ...db.modules[0],
      theoryBlocks: [{ ...block, groupId, groupTitle }],
      contentOrder,
    }, [exercise]);

    const theoryRow = form.querySelector<HTMLDivElement>(".theory-block-row");
    const exerciseRow = form.querySelector<HTMLDivElement>(".module-exercise-row");
    const groupCard = form.querySelector<HTMLDivElement>(".theory-block-group");
    expect(theoryRow?.dataset.groupPosition).toBe("first");
    expect(exerciseRow?.dataset).toMatchObject({
      groupId,
      groupTitle,
      groupPosition: "last",
    });
    expect(theoryRow?.nextElementSibling).toBe(exerciseRow);
    expect(theoryRow?.parentElement).toBe(groupCard);
    expect(exerciseRow?.parentElement).toBe(groupCard);
    expect(groupCard?.querySelectorAll(".theory-block-row, .module-exercise-row"))
      .toHaveLength(2);
    expect(exerciseRow?.querySelector(".theory-group-editor-heading")).toBeNull();
    expect(groupCard?.querySelector(".theory-group-summary")?.textContent).toBe(
      `Abschnitt · ${groupTitle}`,
    );
    expect(groupCard?.querySelector(".theory-group-editor-actions")?.textContent)
      .toContain("−");
    expect(controller.theoryBlockEditor.contentOrder()).toEqual(contentOrder);
  });

  it("klappt Abschnittsgruppen wie normale Abschnitte ein und aus", () => {
    const editor = createTheoryBlockEditor([
      { id: "a", order: 1, title: "A", markdownContent: "", groupId: "g", groupTitle: "Abschnitt" },
      { id: "b", order: 2, title: "B", markdownContent: "", groupId: "g", groupTitle: "Abschnitt" },
      { id: "c", order: 3, title: "C", markdownContent: "" },
    ]);
    document.body.append(editor.element);

    const rows = Array.from(
      editor.element.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );
    const details = editor.element.querySelector<HTMLDetailsElement>(
      ".theory-block-group .theory-group-details",
    );
    if (!details) throw new Error("Abschnittsgruppe fehlt");
    expect(details.open).toBe(false);
    expect(rows.slice(0, 2).every((row) =>
      row.dataset.groupCollapsed === "true"
    )).toBe(true);

    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(rows.slice(0, 2).every((row) =>
      row.dataset.groupCollapsed === undefined
    )).toBe(true);
    expect(editor.contentOrder().map(({ id }) => id)).toEqual(["a", "b", "c"]);

    editor.element
      .querySelector<HTMLButtonElement>(".theory-group-down")
      ?.click();
    expect(editor.contentOrder().map(({ id }) => id)).toEqual(["c", "a", "b"]);

    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    expect(rows[0].dataset.groupCollapsed).toBe("true");
    expect(rows[1].dataset.groupCollapsed).toBe("true");
    expect(rows[2].dataset.groupCollapsed).toBeUndefined();
    expect(editor.contentOrder().map(({ id }) => id)).toEqual(["c", "a", "b"]);
  });

  it("klappt allgemeine Informationen standardmäßig ein und öffnet sie bei ungültigem Titel", () => {
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    const info = form.querySelector<HTMLDetailsElement>("#module-general-info");
    const title = form.querySelector<HTMLInputElement>("#module-title");
    expect(info?.open).toBe(false);
    title?.dispatchEvent(new Event("invalid"));
    expect(info?.open).toBe(true);
    controller.resetForm();
    expect(info?.open).toBe(false);
  });

  it("zeigt gespeicherte Theorie-Blöcke kompakt und aktualisiert ihre Titel", () => {
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    controller.loadModule(seedDb.modules[0] as ModulesDatabase["modules"][number]);

    const details = form.querySelector<HTMLDetailsElement>(".theory-block-details");
    const title = details?.querySelector<HTMLInputElement>(".theory-block-title");
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toContain(title?.value);

    if (!details || !title) throw new Error("Theorie-Block fehlt");
    details.open = true;
    title.value = "Neuer Titel";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    expect(details.querySelector("summary")?.textContent).toBe("Theorie 1 · Neuer Titel");
    expect(controller.theoryBlockEditor.items()?.[0].title).toBe("Neuer Titel");
  });

  it("öffnet einen zugeklappten Block mit ungültigem Titel beim Speichern", () => {
    const editor = createTheoryBlockEditor([
      { id: "tb-1", order: 1, title: "", markdownContent: "" },
    ]);
    document.body.append(editor.element);
    const details = editor.element.querySelector<HTMLDetailsElement>("details");
    expect(details?.open).toBe(false);
    expect(editor.items()).toBeNull();
    expect(details?.open).toBe(true);
  });

  it("öffnet einen zugeklappten Theorieblock bei ungültigen XP", () => {
    const editor = createTheoryBlockEditor([
      { id: "tb-1", order: 1, title: "Test", markdownContent: "" },
    ]);
    document.body.append(editor.element);
    const details = editor.element.querySelector<HTMLDetailsElement>("details");
    const xp = editor.element.querySelector<HTMLInputElement>(".theory-block-xp");
    expect(details?.open).toBe(false);
    xp?.dispatchEvent(new Event("invalid"));
    expect(details?.open).toBe(true);
  });

  it("berechnet Block-XP aus eigenem Tag und Basiswert und speichert sie", () => {
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    controller.theoryBlockEditor.addBlock({ title: "Töne" });
    const row = form.querySelector<HTMLElement>(".theory-block-row");
    if (!row) throw new Error("Theorie-Block fehlt");
    const xp = row.querySelector<HTMLInputElement>(".theory-block-xp");
    const tag = row.querySelector<HTMLInputElement>('input[value="Notensystem"]');
    const result = row.querySelector(".theory-block-calculated-xp");
    if (!xp || !tag) throw new Error("Block-XP-Felder fehlen");
    tag.checked = true;
    tag.dispatchEvent(new Event("change"));
    expect(result?.textContent).toBe("Berechnete XP: 45");
    xp.value = "20";
    xp.dispatchEvent(new Event("input"));
    expect(result?.textContent).toBe("Berechnete XP: 30");
    expect(controller.theoryBlockEditor.items()?.[0]).toMatchObject({
      baseXp: 20,
      tags: ["Notensystem"],
    });
  });

  it("sortiert Übungen zwischen Theorieblöcke und lädt die gespeicherte Reihenfolge", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    const db = seedDb as unknown as ModulesDatabase;
    const exercise = db.questions.find((q) => q.id === "q-101-ex-1");
    const quiz = db.questions.find((q) => q.targetLane === "mittel");
    if (!exercise || !quiz) throw new Error("Testfragen fehlen");
    const mod = { ...db.modules[0], theoryBlocks: db.modules[0].theoryBlocks.slice(0, 2), contentOrder: undefined };
    controller.loadModule(mod, [exercise, quiz]);
    const row = form.querySelector<HTMLElement>(".module-exercise-row");
    expect(row?.querySelector("summary")?.textContent).toContain(exercise.prompt);
    expect(form.querySelectorAll(".module-exercise-row")).toHaveLength(1);
    row?.querySelector<HTMLButtonElement>(".theory-block-up")?.click();
    const expected = [
      { kind: "theory", id: mod.theoryBlocks[0].id },
      { kind: "exercise", id: exercise.id },
      {
        kind: "theory",
        id: mod.theoryBlocks[1].id,
        groupId: mod.theoryBlocks[1].groupId,
        groupTitle: mod.theoryBlocks[1].groupTitle,
      },
    ];
    expect(controller.theoryBlockEditor.contentOrder()).toEqual(expected);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(saved.contentOrder).toEqual(expected);
    await vi.waitFor(() => expect(form.querySelector(".form-status")?.textContent).toBe("Modul wurde aktualisiert."));
    controller.loadModule({ ...mod, contentOrder: saved.contentOrder }, [exercise, quiz]);
    expect(controller.theoryBlockEditor.contentOrder()).toEqual(expected);
    document.dispatchEvent(new CustomEvent("modules:updated", {
      detail: { questions: [quiz] },
    }));
    expect(form.querySelectorAll(".module-exercise-row")).toHaveLength(0);
    controller.resetForm();
    expect(controller.theoryBlockEditor.contentOrder()).toEqual([]);
  });

  it("bearbeitet aufgeklappte Übungen direkt in der Modul-Blockliste", async () => {
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    const db = seedDb as unknown as ModulesDatabase;
    const exercise = db.questions.find((q) => q.id === "q-101-ex-1");
    if (!exercise) throw new Error("Testübung fehlt");
    controller.loadModule(db.modules[0], [exercise]);

    const row = form.querySelector<HTMLElement>(".module-exercise-row");
    const editor = row?.querySelector<HTMLElement>(".module-exercise-editor");
    const prompt = editor?.querySelector<HTMLTextAreaElement>("textarea");
    const answer = editor?.querySelector<HTMLInputElement>(
      ".module-exercise-answers input",
    );
    const explanation = editor?.querySelectorAll<HTMLTextAreaElement>("textarea")[1];
    if (!row || !prompt || !answer || !explanation) {
      throw new Error("Inline-Editor für Übung fehlt");
    }
    row.querySelector<HTMLDetailsElement>("details")!.open = true;
    prompt.value = "Neue Aufgabenstellung";
    answer.value = "900 Hz";
    explanation.value = "Neue Erklärung";
    editor.querySelector<HTMLButtonElement>(".module-exercise-save")?.click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT");
    expect(saved).toMatchObject({
      entity: "question",
      id: exercise.id,
      prompt: "Neue Aufgabenstellung",
      correctAnswers: ["900 Hz"],
      explanation: "Neue Erklärung",
    });
    await vi.waitFor(() =>
      expect(form.querySelector(".module-exercise-status")?.textContent).toBe(
        "Übung wurde aktualisiert.",
      ),
    );
    expect(form.querySelector(".module-exercise-row")?.textContent).toContain(
      "Neue Aufgabenstellung",
    );
  });

  it("löscht Übungen nur nach Bestätigung und zeigt Fehler an", async () => {
    const db = structuredClone(seedDb) as unknown as ModulesDatabase;
    const exercise = db.questions.find((q) => q.id === "q-101-ex-1");
    if (!exercise) throw new Error("Testfrage fehlt");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ error: "Fehler beim Löschen" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(db), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const form = mountModuleForm();
    const controller = attachModuleBuilderForm(form);
    controller.loadModule(db.modules[0], [exercise]);
    form.querySelector<HTMLButtonElement>(".module-exercise-remove")?.click();
    expect(fetchMock).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    form.querySelector<HTMLButtonElement>(".module-exercise-remove")?.click();
    await vi.waitFor(() => expect(form.querySelector(".form-status")?.textContent).toBe("Fehler beim Löschen"));
    expect(form.querySelector(".module-exercise-row")).not.toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ entity: "question", id: exercise.id });
    const title = form.querySelector<HTMLInputElement>("#module-title");
    if (!title) throw new Error("Modultitel fehlt");
    title.value = "Ungespeicherter Titel";
    db.questions = db.questions.filter((q) => q.id !== exercise.id);
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "DELETE"
        ? new Response("{}", { status: 200 })
        : new Response(JSON.stringify(db), { status: 200 }),
    );
    form.querySelector<HTMLButtonElement>(".module-exercise-remove")?.click();
    await vi.waitFor(() => expect(
      Array.from(form.querySelectorAll<HTMLElement>(".module-exercise-row"))
        .some((row) => row.dataset.blockId === exercise.id),
    ).toBe(false));
    expect(title.value).toBe("Ungespeicherter Titel");
  });

  it("lädt die Modul-Detailseite anhand der URL", async () => {
    const db = structuredClone(seedDb) as unknown as ModulesDatabase;
    const originalUrl = window.location.href;
    window.history.replaceState(null, "", `?id=${encodeURIComponent(db.modules[0].id)}`);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify(init?.method === "PUT" ? {} : db), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const form = mountModuleForm();
    form.dataset.moduleDetail = "true";
    attachModuleBuilderForm(form);
    await vi.waitFor(() => expect(form.querySelector<HTMLInputElement>("#module-title")?.value).toBe(db.modules[0].title));
    expect(form.querySelectorAll(".module-exercise-row").length).toBe(
      db.questions.filter((q) => q.moduleIds.includes(db.modules[0].id) && q.targetLane === "leicht").length,
    );
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(form.querySelector(".form-status")?.textContent).toBe("Modul wurde aktualisiert."));
    expect(form.querySelector<HTMLInputElement>("#module-title")?.value).toBe(db.modules[0].title);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true);
    window.history.replaceState(null, "", originalUrl);
  });

  it("bietet nur Tags über Faktor 1 an und bewahrt vorhandene andere Tags", () => {
    const picker = createXpTagPicker({ name: "tags", legend: "Tags" });
    expect(picker.selectedTags()).toEqual([]);
    expect(picker.element.querySelector('input[value="Allgemein"]')).toBeNull();
    expect(picker.element.querySelector('input[value="Violinschlüssel"]')).toBeNull();
    expect(picker.element.querySelector('input[value="Notensystem"]')).not.toBeNull();
    picker.setSelectedTags(["Allgemein", "Altes Thema", "Notensystem"]);
    expect(picker.selectedTags()).toEqual(["Allgemein", "Altes Thema", "Notensystem"]);
    expect(picker.element.textContent).toContain("Bisherige Tags bleiben erhalten");
    picker.clear();
    expect(picker.selectedTags()).toEqual([]);
  });

  it("lädt und speichert globale Bestehensgrenzen nur nach Bestätigung", async () => {
    let db: ModulesDatabase = { modules: [], questions: [] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        db = { ...db, quizSettings: { ...body.settings, revision: 1 } };
      }
      return new Response(JSON.stringify(db), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const form = document.createElement("form");
    form.innerHTML = `
      <input id="settings-quiz-min" type="number" />
      <input id="settings-fastlane-min" type="number" />
      <button type="submit"></button><button type="button" id="settings-reload"></button>
      <p class="form-status"></p>`;
    document.body.append(form);
    attachQuizSettingsForm(form);
    await vi.waitFor(() => expect(form.querySelector<HTMLInputElement>("#settings-quiz-min")?.value).toBe("80"));
    const quiz = form.querySelector<HTMLInputElement>("#settings-quiz-min");
    if (!quiz) throw new Error("Quiz-Einstellung fehlt");
    quiz.value = "90";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    confirm.mockReturnValue(true);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(db.quizSettings?.quizEasyMinScore).toBe(0.9));
    expect(db.quizSettings).toEqual({ quizEasyMinScore: 0.9, fastlaneMinScore: 0.85, revision: 1 });
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

    laneSelect.value = "schwer";
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
          practiceBlocks: [],
          createdAt: "2026-11-16T00:00:00.000Z",
          updatedAt: "2026-11-16T00:00:00.000Z",
        },
      ],
      questions: [
        {
          id: "q-1",
          moduleIds: ["theory-101"],
          targetLane: "leicht",
          questionType: "numeric_input",
          prompt: "Welche Frequenz hat A4?",
          correctAnswers: ["440"],
          explanation: "Kammerton A liegt bei 440 Hz.",
          baseXp: 10,
          tags: ["Allgemein"],
        },
        {
          id: "q-2",
          moduleIds: ["theory-101"],
          targetLane: "schwer",
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
    expect(list?.dataset.view).toBe("list");
    toggle?.click();
    expect(list?.dataset.view).toBe("cards");
    toggle?.click();
    expect(list?.dataset.view).toBe("list");

    const laneFilter = section.querySelector<HTMLSelectElement>(
      ".module-question-lane-filter",
    );
    expect(laneFilter).not.toBeNull();
    if (laneFilter) {
      laneFilter.value = "schwer";
      laneFilter.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(section.querySelectorAll(".module-question-item")).toHaveLength(1);
    expect(section.querySelector(".module-question-prompt")?.textContent).toBe(
      "Setze G4 im Violinschlüssel.",
    );
  });

  it("verschiebt Module in der Übersicht und sperrt Pfeile bei anderer Sortierung", async () => {
    const initial = structuredClone(seedDb) as unknown as ModulesDatabase;
    const reordered = structuredClone(initial);
    [reordered.modules[0], reordered.modules[1]] = [reordered.modules[1], reordered.modules[0]];
    reordered.modules.forEach((mod, index) => { mod.order = index + 1; });
    let current = initial;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") current = reordered;
      return new Response(JSON.stringify(current), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const section = mountCatalogSection();
    const controller = attachModuleCatalogList(section);
    controller.renderDatabase(initial);
    expect(section.querySelector<HTMLButtonElement>('[data-module-id="theory-101"] .module-move-up')?.disabled).toBe(true);
    section.querySelector<HTMLButtonElement>('[data-module-id="theory-101"] .module-move-down')?.click();
    await vi.waitFor(() => {
      expect(section.querySelector("#module-catalog-list > li")?.getAttribute("data-module-id")).toBe("guitar-102");
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      entity: "module-order", id: "theory-101", neighborId: "guitar-102", direction: "down",
    });
    const sort = section.querySelector<HTMLSelectElement>("#sort-modules");
    if (!sort) throw new Error("Sortierung fehlt");
    sort.value = "xp_desc";
    sort.dispatchEvent(new Event("change"));
    expect(Array.from(section.querySelectorAll<HTMLButtonElement>(".module-move-up, .module-move-down")).every((button) => button.disabled)).toBe(true);
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

  it("verlinkt Module auf ihre Detailseite und öffnet Fragen im Aufgaben-Reiter", () => {
    const db = structuredClone(seedDb) as unknown as ModulesDatabase;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(db), { status: 200 })),
    );

    const tabs = document.createElement("starlight-tabs");
    const tabLabels = ["Übersicht", "Theorie", "Aufgaben", "Einstellungen"];
    const tabButtons = tabLabels.map((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        for (const other of tabButtons) {
          other.setAttribute("aria-selected", other === btn ? "true" : "false");
        }
      });
      tabs.append(btn);
      return btn;
    });
    document.body.append(tabs);

    const section = mountCatalogSection();
    const catalog = attachModuleCatalogList(section);
    catalog.renderDatabase(db);

    const exerciseForm = mountExerciseForm();
    attachExerciseBuilderForm(exerciseForm);

    const editLink = section.querySelector<HTMLAnchorElement>(".contribution-edit");
    expect(editLink?.getAttribute("href")).toBe(
      `${MODULE_DETAIL_PATH}?id=${encodeURIComponent(db.modules[0].id)}`,
    );

    section.querySelector<HTMLButtonElement>(".module-question-edit")?.click();
    expect(tabButtons.map((btn) => btn.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
      "false",
    ]);
    expect(
      exerciseForm.querySelector<HTMLTextAreaElement>("#exercise-prompt")?.value,
    ).toBe(db.questions[0].prompt);
  });
});
