import { addIcon } from "./contribution-types.ts";
import {
  DEFAULT_QUIZ_SETTINGS,
  getDefaultBaseXpForLane,
  isDStage,
  isModuleScope,
  isQuestionType,
  isQuizSettings,
  isTargetLane,
  type LearningModule,
  type ModuleQuestion,
  type ModuleScope,
  type ModulesDatabase,
  NOTATION_DURATIONS,
  type NotationBuilderTaskConfig,
  type NotationTaskDuration,
  type QuestionType,
  type TargetLane,
  type TheoryBlock,
} from "./module-schema.ts";
import {
  createEmptyModulesDatabase,
  getModuleSummary,
  type UpsertModuleInput,
  type UpsertQuestionInput,
  validateModuleInput,
  validateQuestionInput,
} from "./module-store.ts";
import { notationToMarkdown } from "./module-theory-notation.ts";
import {
  attachNotationBuilder,
  DEFAULT_BUILDER_DURATIONS,
  DEFAULT_NOTATION_STEP,
  DURATION_SVG_DATA,
  describeBuilderState,
  type NotationBuilderConfig,
  renderNotationBuilderSvg,
} from "./notation-builder.ts";
import { type Duration, durationLabels } from "./rhythm.ts";
import {
  BASE_XP_DEFAULTS,
  calculateQuestionXp,
  getAvailableTags,
  TAG_DEFINITIONS,
} from "./xp-tags.ts";

export const MODULES_API_ENDPOINT = "/api/modules";
export const MODULES_FUNCTION_FALLBACK_ENDPOINT = "/.netlify/functions/modules";
export const MODULES_HTML_RESPONSE_ERROR =
  "Die Modul-API ist unter dieser Adresse nicht erreichbar (HTML-Antwort statt JSON). Bitte Dev-Server prüfen.";

const SCOPE_LABELS: Record<ModuleScope, string> = {
  theory: "Theorie",
  instrument: "Instrument",
  production: "Produktion",
  band: "Band",
};

const LANE_LABELS: Record<TargetLane, string> = {
  exercise: "Übung",
  quiz_easy: "Quiz Einfach",
  fastlane: "Fastlane-Test",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Eine richtige Antwort",
  multi_select: "Mehrere richtige Antworten",
  numeric_input: "Zahleneingabe",
  interactive_notation: "Interaktive Notation",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorMessage(result: unknown, fallback: string): string {
  if (
    isRecord(result) &&
    typeof result.error === "string" &&
    result.error.trim().length > 0
  ) {
    return result.error;
  }
  return fallback;
}

function parseModulesResponse(data: unknown): ModulesDatabase {
  if (
    !isRecord(data) ||
    !Array.isArray(data.modules) ||
    !Array.isArray(data.questions) ||
    (data.quizSettings !== undefined && !isQuizSettings(data.quizSettings))
  ) {
    throw new Error("Die Moduldaten haben ein ungültiges Format.");
  }
  return {
    modules: data.modules as LearningModule[],
    questions: data.questions as ModuleQuestion[],
    ...(data.quizSettings !== undefined
      ? { quizSettings: data.quizSettings }
      : {}),
  };
}

interface ParsedApiAttempt {
  response: Response;
  payload: unknown;
  isJson: boolean;
  isHtml: boolean;
}

async function fetchAndParseResponse(
  endpoint: string,
  init?: RequestInit,
): Promise<ParsedApiAttempt> {
  const response = await fetch(endpoint, init);
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const contentType = response.headers.get("content-type") ?? "";
  const looksLikeHtml =
    contentType.toLowerCase().includes("text/html") || trimmed.startsWith("<");

  if (!trimmed || looksLikeHtml) {
    return {
      response,
      payload: null,
      isJson: false,
      isHtml: looksLikeHtml,
    };
  }

  try {
    return {
      response,
      payload: JSON.parse(trimmed) as unknown,
      isJson: true,
      isHtml: false,
    };
  } catch {
    return {
      response,
      payload: null,
      isJson: false,
      isHtml: false,
    };
  }
}

/**
 * Sendet eine Anfrage an den Modul-API-Endpunkt, parst JSON sicher ohne ungefangene
 * HTML-Parse-Fehler und fällt bei 404-/HTML-Antworten auf die Netlify-Function-URL zurück.
 */
async function requestModulesApi(
  init?: RequestInit,
): Promise<{ response: Response; payload: unknown; isJson: boolean }> {
  let attempt = await fetchAndParseResponse(MODULES_API_ENDPOINT, init);

  if (!attempt.isJson && (attempt.isHtml || attempt.response.status === 404)) {
    const fallbackAttempt = await fetchAndParseResponse(
      MODULES_FUNCTION_FALLBACK_ENDPOINT,
      init,
    );
    if (fallbackAttempt.isJson || !attempt.isHtml) {
      attempt = fallbackAttempt;
    }
  }

  if (!attempt.isJson && attempt.isHtml) {
    throw new Error(MODULES_HTML_RESPONSE_ERROR);
  }

  return {
    response: attempt.response,
    payload: attempt.payload,
    isJson: attempt.isJson,
  };
}

async function sendModulesRequest(
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  fallbackError: string,
): Promise<unknown> {
  const { response, payload } = await requestModulesApi({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, fallbackError));
  }
  return payload;
}

async function fetchModulesDatabase(): Promise<ModulesDatabase> {
  const { response, payload } = await requestModulesApi({ cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        "Die Moduldaten konnten derzeit nicht geladen werden.",
      ),
    );
  }
  return parseModulesResponse(payload);
}

function switchStarlightTab(tabIndex: number): void {
  const tabsContainer = document.querySelector("starlight-tabs");
  if (!tabsContainer) return;
  const tabButtons =
    tabsContainer.querySelectorAll<HTMLElement>('[role="tab"]');
  const target = tabButtons[tabIndex];
  if (target) {
    target.click();
  }
}

function parseNotationDuration(
  value: string,
): NotationTaskDuration | undefined {
  return NOTATION_DURATIONS.find((dur) => dur === value);
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  errorMessage: string,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(errorMessage);
  }
  return el;
}

export interface XpTagPickerController {
  element: HTMLFieldSetElement;
  selectedTags(): string[];
  setSelectedTags(tags: readonly string[]): void;
  clear(): void;
  setDisabled(disabled: boolean): void;
}

/** Erzeugt eine Multi-Select-Tag-Auswahl mit Anzeige des XP-Multiplikators. */
export function createXpTagPicker(options: {
  name: string;
  legend: string;
  defaultTags?: readonly string[];
  onChange?: (selected: string[]) => void;
}): XpTagPickerController {
  const defaultTags = options.defaultTags ?? [];
  const fieldset = document.createElement("fieldset");
  fieldset.className = "contribution-type-picker xp-tag-picker";

  const legend = document.createElement("legend");
  legend.textContent = options.legend;

  const choices = document.createElement("div");
  choices.className = "contribution-type-choices xp-tag-choices";

  const checkboxes: HTMLInputElement[] = [];
  const availableTags = getAvailableTags().filter(
    (tagName) => TAG_DEFINITIONS[tagName].multiplier > 1,
  );
  const available = new Set(availableTags);
  let retainedTags = defaultTags.filter((tag) => !available.has(tag));

  for (const tagName of availableTags) {
    const def = TAG_DEFINITIONS[tagName];
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = options.name;
    checkbox.value = tagName;
    checkbox.checked = defaultTags.includes(tagName);
    checkbox.addEventListener("change", () => {
      options.onChange?.(selectedTags());
    });

    const chip = document.createElement("span");
    chip.className = "contribution-tag xp-tag-chip";
    chip.dataset.xpTag = tagName;
    chip.title = def.description;
    chip.textContent = `${tagName} (${def.multiplier.toFixed(1)}x)`;

    checkboxes.push(checkbox);
    label.append(checkbox, chip);
    choices.append(label);
  }

  const retainedHint = document.createElement("small");
  retainedHint.className = "field-hint";
  function updateRetainedHint(): void {
    retainedHint.hidden = retainedTags.length === 0;
    retainedHint.textContent = `Bisherige Tags bleiben erhalten: ${retainedTags.join(", ")}.`;
  }
  updateRetainedHint();
  fieldset.append(legend, choices, retainedHint);

  function selectedTags(): string[] {
    return [
      ...retainedTags,
      ...checkboxes.filter((box) => box.checked).map((box) => box.value),
    ];
  }

  function setSelectedTags(tags: readonly string[]): void {
    const wanted = new Set(tags);
    retainedTags = tags.filter((tag) => !available.has(tag));
    for (const box of checkboxes) {
      box.checked = wanted.has(box.value);
    }
    updateRetainedHint();
    options.onChange?.(selectedTags());
  }

  function clear(): void {
    setSelectedTags(defaultTags);
  }

  function setDisabled(disabled: boolean): void {
    fieldset.disabled = disabled;
  }

  return {
    element: fieldset,
    selectedTags,
    setSelectedTags,
    clear,
    setDisabled,
  };
}

export interface TheoryBlockEditorController {
  element: HTMLFieldSetElement;
  addBlock(initial?: Partial<TheoryBlock>): void;
  items(): TheoryBlock[] | null;
  setItems(blocks: readonly TheoryBlock[]): void;
  clear(): void;
  setDisabled(disabled: boolean): void;
}

/** Erzeugt einen dynamischen Editor für sortierbare Theorie-Blöcke. */
export function createTheoryBlockEditor(
  initialBlocks: readonly TheoryBlock[] = [],
): TheoryBlockEditorController {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "checklist-editor theory-block-editor";

  const legend = document.createElement("legend");
  legend.textContent = "Theorie-Blöcke";

  const rows = document.createElement("div");
  rows.className = "theory-block-rows";
  const legacyVisuals = new WeakMap<HTMLDivElement, Partial<TheoryBlock>>();

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "theory-block-add";
  addButton.textContent = "+ Theorie-Block hinzufügen";

  function syncRowOrder(): void {
    const rowElements = Array.from(
      rows.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );
    rowElements.forEach((row, index) => {
      const label = row.querySelector<HTMLElement>(".theory-block-order-label");
      if (label) {
        label.textContent = `Block ${index + 1}`;
      }
      const upButton = row.querySelector<HTMLButtonElement>(".theory-block-up");
      const downButton =
        row.querySelector<HTMLButtonElement>(".theory-block-down");
      if (upButton) upButton.disabled = index === 0;
      if (downButton) downButton.disabled = index === rowElements.length - 1;
    });
  }

  function moveRow(row: HTMLDivElement, direction: -1 | 1): void {
    if (direction === -1 && row.previousElementSibling) {
      rows.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
      rows.insertBefore(row.nextElementSibling, row);
    }
    syncRowOrder();
  }

  function addBlock(initial: Partial<TheoryBlock> = {}): void {
    initial = notationToMarkdown(initial);
    const row = document.createElement("div");
    row.className = "theory-block-row";
    if (initial.visualComponent && initial.visualComponent !== "none") {
      legacyVisuals.set(row, {
        visualComponent: initial.visualComponent,
        visualPropsJson: initial.visualPropsJson,
      });
    }
    row.dataset.blockId =
      initial.id?.trim() ||
      `tb-${rows.childElementCount + 1}-${crypto.randomUUID().slice(0, 6)}`;

    const rowHeader = document.createElement("div");
    rowHeader.className = "theory-block-row-header";

    const orderLabel = document.createElement("span");
    orderLabel.className = "theory-block-order-label";

    const controls = document.createElement("div");
    controls.className = "theory-block-controls";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.className = "theory-block-up";
    upButton.textContent = "↑";
    upButton.title = "Block nach oben verschieben";
    upButton.setAttribute("aria-label", "Theorie-Block nach oben verschieben");
    upButton.addEventListener("click", () => moveRow(row, -1));

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.className = "theory-block-down";
    downButton.textContent = "↓";
    downButton.title = "Block nach unten verschieben";
    downButton.setAttribute(
      "aria-label",
      "Theorie-Block nach unten verschieben",
    );
    downButton.addEventListener("click", () => moveRow(row, 1));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "checklist-remove theory-block-remove";
    removeButton.textContent = "×";
    removeButton.title = "Block entfernen";
    removeButton.setAttribute("aria-label", "Theorie-Block entfernen");
    removeButton.addEventListener("click", () => {
      row.remove();
      syncRowOrder();
    });

    controls.append(upButton, downButton, removeButton);
    rowHeader.append(orderLabel, controls);

    const titleLabel = document.createElement("label");
    titleLabel.className = "field";
    const titleCaption = document.createElement("span");
    titleCaption.textContent = "Block-Titel";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "theory-block-title";
    titleInput.placeholder = "z. B. Frequenz & Tonhöhe";
    titleInput.value = initial.title ?? "";
    titleLabel.append(titleCaption, titleInput);

    const markdownLabel = document.createElement("label");
    markdownLabel.className = "field";
    const markdownCaption = document.createElement("span");
    markdownCaption.textContent = "Inhalt (Markdown, KaTeX & Notation)";
    const markdownInput = document.createElement("textarea");
    markdownInput.className = "theory-block-markdown";
    markdownInput.rows = 4;
    markdownInput.placeholder =
      "Erklärungstext. Formeln mit $f = 440\\text{ Hz}$ oder $$...$$ einfügen.";
    markdownInput.value = initial.markdownContent ?? "";
    const katexHint = document.createElement("small");
    katexHint.className = "field-hint";
    katexHint.textContent =
      'Formeln mit $...$ oder $$...$$; Notation direkt im Text: <Notation clef="treble" notes={[]} />.';
    markdownLabel.append(markdownCaption, markdownInput, katexHint);
    row.append(rowHeader, titleLabel, markdownLabel);
    if (legacyVisuals.has(row)) {
      const legacyHint = document.createElement("small");
      legacyHint.className = "field-hint";
      legacyHint.textContent = `Bisherige Visualisierung (${initial.visualComponent}) bleibt erhalten.`;
      const removeVisual = document.createElement("button");
      removeVisual.type = "button";
      removeVisual.textContent = "Bisherige Visualisierung entfernen";
      removeVisual.addEventListener("click", () => {
        legacyVisuals.delete(row);
        legacyHint.remove();
        removeVisual.remove();
      });
      row.append(legacyHint, removeVisual);
    }
    rows.append(row);
    syncRowOrder();
  }

  addButton.addEventListener("click", () => {
    addBlock();
    const lastTitle = rows.querySelector<HTMLInputElement>(
      ".theory-block-row:last-child .theory-block-title",
    );
    lastTitle?.focus();
  });

  function items(): TheoryBlock[] | null {
    const result: TheoryBlock[] = [];
    const rowElements = Array.from(
      rows.querySelectorAll<HTMLDivElement>(".theory-block-row"),
    );

    for (let index = 0; index < rowElements.length; index += 1) {
      const row = rowElements[index];
      const titleInput = row.querySelector<HTMLInputElement>(
        ".theory-block-title",
      );
      const markdownInput = row.querySelector<HTMLTextAreaElement>(
        ".theory-block-markdown",
      );
      if (!titleInput || !markdownInput) {
        throw new Error("Die Felder eines Theorie-Blocks sind unvollständig.");
      }

      const title = titleInput.value.trim();
      if (!title) {
        titleInput.setCustomValidity(
          "Bitte gib einen Titel für den Theorie-Block ein.",
        );
        titleInput.reportValidity();
        titleInput.setCustomValidity("");
        return null;
      }

      result.push({
        id: row.dataset.blockId?.trim() || `tb-${index + 1}`,
        order: index + 1,
        title,
        markdownContent: markdownInput.value,
        ...legacyVisuals.get(row),
      });
    }

    return result;
  }

  function setItems(blocks: readonly TheoryBlock[]): void {
    rows.replaceChildren();
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    for (const block of sorted) {
      addBlock(block);
    }
    syncRowOrder();
  }

  function clear(): void {
    rows.replaceChildren();
    syncRowOrder();
  }

  function setDisabled(disabled: boolean): void {
    fieldset.disabled = disabled;
  }

  if (initialBlocks.length > 0) {
    setItems(initialBlocks);
  }

  fieldset.append(legend, rows, addButton);

  return {
    element: fieldset,
    addBlock,
    items,
    setItems,
    clear,
    setDisabled,
  };
}

export interface ModuleBuilderFormController {
  loadModule(mod: LearningModule): void;
  resetForm(): void;
  theoryBlockEditor: TheoryBlockEditorController;
  tagPicker: XpTagPickerController;
}

export function attachQuizSettingsForm(form: HTMLFormElement): void {
  const message = "Felder der Quiz-Einstellungen fehlen.";
  const quizInput = requireElement<HTMLInputElement>(
    form,
    "#settings-quiz-min",
    message,
  );
  const fastlaneInput = requireElement<HTMLInputElement>(
    form,
    "#settings-fastlane-min",
    message,
  );
  const saveButton = requireElement<HTMLButtonElement>(
    form,
    'button[type="submit"]',
    message,
  );
  const reloadButton = requireElement<HTMLButtonElement>(
    form,
    "#settings-reload",
    message,
  );
  const status = requireElement<HTMLElement>(form, ".form-status", message);
  let settings = { ...DEFAULT_QUIZ_SETTINGS };
  let loaded = false;

  async function reload(): Promise<void> {
    loaded = false;
    saveButton.disabled = true;
    reloadButton.disabled = true;
    status.textContent = "Einstellungen werden geladen …";
    try {
      const db = await fetchModulesDatabase();
      settings = { ...(db.quizSettings ?? DEFAULT_QUIZ_SETTINGS) };
      quizInput.value = String(settings.quizEasyMinScore * 100);
      fastlaneInput.value = String(settings.fastlaneMinScore * 100);
      loaded = true;
      status.textContent = "Einstellungen geladen.";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Einstellungen konnten nicht geladen werden.";
    } finally {
      saveButton.disabled = !loaded;
      reloadButton.disabled = false;
    }
  }

  reloadButton.addEventListener("click", () => {
    void reload();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loaded) return;
    const quiz = Number(quizInput.value);
    const fastlane = Number(fastlaneInput.value);
    if (
      !quizInput.value.trim() ||
      !fastlaneInput.value.trim() ||
      !Number.isFinite(quiz) ||
      quiz < 0 ||
      quiz > 100 ||
      !Number.isFinite(fastlane) ||
      fastlane < 0 ||
      fastlane > 100
    ) {
      status.textContent =
        "Bitte gib für beide Grenzen einen Wert zwischen 0 und 100 ein.";
      return;
    }
    const next = {
      quizEasyMinScore: quiz / 100,
      fastlaneMinScore: fastlane / 100,
      revision: settings.revision,
    };
    if (
      next.quizEasyMinScore === settings.quizEasyMinScore &&
      next.fastlaneMinScore === settings.fastlaneMinScore
    ) {
      status.textContent = "Die Einstellungen sind unverändert.";
      return;
    }
    if (
      !window.confirm(
        "Die Änderung setzt beim nächsten Laden den gesamten Lernfortschritt einschließlich XP in allen Browsern zurück. Fortfahren?",
      )
    )
      return;
    saveButton.disabled = true;
    reloadButton.disabled = true;
    status.textContent = "Einstellungen werden gespeichert …";
    try {
      const result = await sendModulesRequest(
        "PUT",
        { entity: "quiz-settings", settings: next },
        "Einstellungen konnten nicht gespeichert werden.",
      );
      const db = parseModulesResponse(result);
      if (!db.quizSettings)
        throw new Error(
          "Die gespeicherten Einstellungen fehlen in der Antwort.",
        );
      settings = db.quizSettings;
      status.textContent =
        "Einstellungen gespeichert. Lernstände werden beim nächsten Laden zurückgesetzt.";
      document.dispatchEvent(
        new CustomEvent("modules:updated", { bubbles: true, detail: db }),
      );
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Einstellungen konnten nicht gespeichert werden.";
    } finally {
      saveButton.disabled = false;
      reloadButton.disabled = false;
    }
  });
  void reload();
}

/** Initialisiert die Logik für das Modul-Builder-Formular. */
export function attachModuleBuilderForm(
  form: HTMLFormElement,
): ModuleBuilderFormController {
  if (form.dataset.moduleBuilderAttached === "true") {
    throw new Error("ModuleBuilderForm wurde bereits initialisiert.");
  }
  form.dataset.moduleBuilderAttached = "true";

  const msg = "Felder des Modul-Builder-Formulars fehlen.";
  const titleInput = requireElement<HTMLInputElement>(
    form,
    "#module-title",
    msg,
  );
  const descriptionInput = requireElement<HTMLTextAreaElement>(
    form,
    "#module-description",
    msg,
  );
  const scopeSelect = requireElement<HTMLSelectElement>(
    form,
    "#module-scope",
    msg,
  );
  const levelSelect = requireElement<HTMLSelectElement>(
    form,
    "#module-level",
    msg,
  );
  const dStageSelect = requireElement<HTMLSelectElement>(
    form,
    "#module-d-stage",
    msg,
  );
  const tagsContainer = requireElement<HTMLDivElement>(
    form,
    "#module-tags-field",
    msg,
  );
  const hasPracticeInput = requireElement<HTMLInputElement>(
    form,
    "#module-has-practice",
    msg,
  );
  const theoryBaseXpInput = requireElement<HTMLInputElement>(
    form,
    "#module-theory-base-xp",
    msg,
  );
  const blocksContainer = requireElement<HTMLDivElement>(
    form,
    "#module-theory-blocks-field",
    msg,
  );
  const submitButton = requireElement<HTMLButtonElement>(
    form,
    'button[type="submit"]',
    msg,
  );
  const cancelButton = requireElement<HTMLButtonElement>(
    form,
    "#module-edit-cancel",
    msg,
  );
  const status = requireElement<HTMLParagraphElement>(
    form,
    ".form-status",
    msg,
  );

  const tagPicker = createXpTagPicker({
    name: "moduleTags",
    legend: "Tags & XP-Faktor",
  });
  tagsContainer.append(tagPicker.element);

  const theoryBlockEditor = createTheoryBlockEditor();
  blocksContainer.append(theoryBlockEditor.element);

  let editingModuleId: string | null = null;
  let newModuleId: string | null = null;

  function setBusy(busy: boolean): void {
    const controls = [
      titleInput,
      descriptionInput,
      scopeSelect,
      levelSelect,
      dStageSelect,
      hasPracticeInput,
      theoryBaseXpInput,
      submitButton,
      cancelButton,
    ];
    for (const control of controls) {
      if (control) control.disabled = busy;
    }
    tagPicker.setDisabled(busy);
    theoryBlockEditor.setDisabled(busy);
  }

  function resetForm(): void {
    editingModuleId = null;
    newModuleId = null;
    form.reset();
    if (theoryBaseXpInput) {
      theoryBaseXpInput.value = String(BASE_XP_DEFAULTS.theoryBlock);
    }
    tagPicker.clear();
    theoryBlockEditor.clear();
    if (submitButton) submitButton.textContent = "Modul speichern";
    if (cancelButton) cancelButton.hidden = true;
  }

  function loadModule(mod: LearningModule): void {
    editingModuleId = mod.id;
    newModuleId = null;
    titleInput.value = mod.title;
    descriptionInput.value = mod.description;
    scopeSelect.value = mod.scope;
    levelSelect.value = String(mod.level);
    dStageSelect.value = mod.dStage ?? "";
    hasPracticeInput.checked = mod.hasPractice;
    theoryBaseXpInput.value = String(mod.theoryBaseXp);
    tagPicker.setSelectedTags(mod.tags);
    theoryBlockEditor.setItems(mod.theoryBlocks);
    submitButton.textContent = "Modul-Änderungen speichern";
    cancelButton.hidden = false;
    status.textContent = `Bearbeitungsmodus: „${mod.title}“ geladen.`;
    titleInput.focus();
  }

  cancelButton.addEventListener("click", () => {
    resetForm();
    status.textContent = "Bearbeitung abgebrochen.";
  });

  document.addEventListener("module:edit", (event) => {
    if (event instanceof CustomEvent && isRecord(event.detail)) {
      const candidate = event.detail.module;
      if (isRecord(candidate) && typeof candidate.id === "string") {
        loadModule(candidate as unknown as LearningModule);
        switchStarlightTab(1);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const theoryBlocks = theoryBlockEditor.items();
    if (!theoryBlocks) return;

    const scopeValue = scopeSelect.value;
    const dStageValue = dStageSelect.value;
    const moduleId =
      editingModuleId ?? newModuleId ?? `mod-${crypto.randomUUID()}`;
    if (!editingModuleId) newModuleId = moduleId;
    const payload: UpsertModuleInput & { entity: "module" } = {
      entity: "module",
      id: moduleId,
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      scope: isModuleScope(scopeValue) ? scopeValue : "theory",
      level: Number(levelSelect.value),
      ...(isDStage(dStageValue) ? { dStage: dStageValue } : {}),
      tags: tagPicker.selectedTags(),
      hasPractice: hasPracticeInput.checked,
      theoryBaseXp: Number(theoryBaseXpInput.value),
      theoryBlocks,
    };

    const validation = validateModuleInput(payload);
    if (!validation.valid) {
      status.textContent = validation.errors.join(" ");
      return;
    }

    const isUpdate = editingModuleId !== null;
    status.textContent = "Modul wird gespeichert …";
    setBusy(true);

    try {
      const result = await sendModulesRequest(
        isUpdate ? "PUT" : "POST",
        payload,
        "Das Modul konnte nicht gespeichert werden.",
      );

      resetForm();
      status.textContent = isUpdate
        ? "Modul wurde aktualisiert."
        : "Modul wurde gespeichert.";
      document.dispatchEvent(
        new CustomEvent("modules:updated", { bubbles: true, detail: result }),
      );
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Das Modul konnte wegen eines unerwarteten Fehlers nicht gespeichert werden.";
    } finally {
      setBusy(false);
    }
  });

  return {
    loadModule,
    resetForm,
    theoryBlockEditor,
    tagPicker,
  };
}

export interface ExerciseBuilderFormController {
  setModules(modules: readonly LearningModule[]): void;
  loadQuestion(question: ModuleQuestion): void;
  resetForm(): void;
  refreshCalculatedXp(): number;
  refreshNotationPreview(): void;
  tagPicker: XpTagPickerController;
}

function buildLivePreviewElement(
  config: NotationBuilderConfig,
  showHints: boolean,
): HTMLElement {
  const maxNotes = Math.max(1, config.maxNotes ?? 1);
  const cursorStep = config.initialStep ?? DEFAULT_NOTATION_STEP;
  const placedNotes = Array.from({ length: maxNotes }, () => null);
  const activeDuration: Duration =
    typeof config.lockDuration === "string"
      ? config.lockDuration
      : (config.initialDuration ?? "quarter");
  const isCompact = Boolean(config.compact);
  const clef = config.clef ?? "treble";

  const root = document.createElement("div");
  root.className = "notation-component notation-builder not-content";
  if (isCompact) root.classList.add("is-compact");
  root.tabIndex = 0;
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", "Vorschau interaktive Notenaufgabe");
  root.dataset.notationBuilder = "";
  root.dataset.builderConfig = JSON.stringify(config);

  if (config.showDurationPicker) {
    const toolbar = document.createElement("div");
    toolbar.className = "notation-builder-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Notenwert auswählen");

    const label = document.createElement("span");
    label.className = "notation-builder-toolbar-label";
    label.textContent = "Notenwert:";

    const picker = document.createElement("div");
    picker.className = "notation-builder-duration-picker";
    picker.setAttribute("role", "radiogroup");

    for (const dur of DEFAULT_BUILDER_DURATIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "notation-builder-duration-btn";
      if (dur === activeDuration) btn.classList.add("is-active");
      btn.dataset.duration = dur;
      btn.setAttribute("aria-label", durationLabels[dur]);
      btn.setAttribute(
        "aria-pressed",
        dur === activeDuration ? "true" : "false",
      );
      btn.title = durationLabels[dur];

      const svgData = DURATION_SVG_DATA[dur];
      btn.innerHTML = `<svg class="notation-builder-duration-icon" viewBox="${svgData.viewBox}" aria-hidden="true" focusable="false"><path d="${svgData.d}" transform="scale(1, -1)" fill="currentColor" /></svg>`;
      picker.append(btn);
    }

    toolbar.append(label, picker);
    root.append(toolbar);
  }

  const body = document.createElement("div");
  body.className = "notation-builder-body";

  const stage = document.createElement("div");
  stage.className = "notation-builder-stage";
  stage.innerHTML = renderNotationBuilderSvg({
    config,
    cursorStep,
    placedNotes,
    activeSlot: 0,
  });
  body.append(stage);

  if (isCompact && showHints) {
    const sideHints = document.createElement("div");
    sideHints.className = "notation-builder-side-hints";
    const hintParts = [
      ...(maxNotes > 1 ? ["←/→: Position"] : []),
      "↑/↓: Tonhöhe",
      "Leertaste: Note setzen",
      ...(config.showDurationPicker && !config.lockDuration
        ? ["Num 1: Notenwert"]
        : []),
      "Entf: Löschen",
    ];
    for (const text of hintParts) {
      const span = document.createElement("span");
      span.className = "notation-builder-hint-item";
      span.textContent = text;
      sideHints.append(span);
    }
    body.append(sideHints);
  }

  root.append(body);

  if (!isCompact && showHints) {
    const footer = document.createElement("div");
    footer.className = "notation-builder-footer";
    const hints = document.createElement("span");
    hints.className = "notation-builder-hints";
    hints.textContent = `${maxNotes > 1 ? "←/→: Position · " : ""}↑/↓: Tonhöhe · Leertaste: Note setzen${config.showDurationPicker && !config.lockDuration ? " · Num 1: Notenwert" : ""} · Entf: Löschen`;
    footer.append(hints);
    root.append(footer);
  }

  const initialState = describeBuilderState({
    cursorStep,
    placedNotes,
    activeSlot: 0,
    maxNotes,
    clef,
    activeDuration,
  });
  root.dataset.cursorStep = String(initialState.cursorStep);
  root.dataset.cursorNote = initialState.currentNote;
  attachNotationBuilder(root);
  return root;
}

/** Initialisiert die Logik für das Aufgaben- & Quiz-Builder-Formular. */
export function attachExerciseBuilderForm(
  form: HTMLFormElement,
): ExerciseBuilderFormController {
  if (form.dataset.exerciseBuilderAttached === "true") {
    throw new Error("ExerciseBuilderForm wurde bereits initialisiert.");
  }
  form.dataset.exerciseBuilderAttached = "true";

  const msg = "Felder des Aufgaben-Builder-Formulars fehlen.";
  const moduleSelect = requireElement<HTMLSelectElement>(
    form,
    "#exercise-module-id",
    msg,
  );
  const laneSelect = requireElement<HTMLSelectElement>(
    form,
    "#exercise-target-lane",
    msg,
  );
  const typeSelect = requireElement<HTMLSelectElement>(
    form,
    "#exercise-question-type",
    msg,
  );
  const promptInput = requireElement<HTMLTextAreaElement>(
    form,
    "#exercise-prompt",
    msg,
  );
  const choiceSection = requireElement<HTMLElement>(
    form,
    "#exercise-choice-section",
    msg,
  );
  const choiceRows = requireElement<HTMLDivElement>(
    form,
    "#exercise-choice-rows",
    msg,
  );
  const choiceAddButton = requireElement<HTMLButtonElement>(
    form,
    "#exercise-choice-add",
    msg,
  );
  const numericSection = requireElement<HTMLElement>(
    form,
    "#exercise-numeric-section",
    msg,
  );
  const numericAnswerInput = requireElement<HTMLInputElement>(
    form,
    "#exercise-numeric-answer",
    msg,
  );
  const notationSection = requireElement<HTMLElement>(
    form,
    "#exercise-notation-section",
    msg,
  );
  const notationClefSelect = requireElement<HTMLSelectElement>(
    form,
    "#notation-clef",
    msg,
  );
  const notationMaxNotesInput = requireElement<HTMLInputElement>(
    form,
    "#notation-max-notes",
    msg,
  );
  const notationLockDurationSelect = requireElement<HTMLSelectElement>(
    form,
    "#notation-lock-duration",
    msg,
  );
  const notationCompactSelect = requireElement<HTMLSelectElement>(
    form,
    "#notation-compact",
    msg,
  );
  const notationShowDurationPicker = requireElement<HTMLInputElement>(
    form,
    "#notation-show-duration-picker",
    msg,
  );
  const notationShowHints = requireElement<HTMLInputElement>(
    form,
    "#notation-show-hints",
    msg,
  );
  const notationExpectedPitchesInput = requireElement<HTMLInputElement>(
    form,
    "#notation-expected-pitches",
    msg,
  );
  const notationExpectedDurationsInput = requireElement<HTMLInputElement>(
    form,
    "#notation-expected-durations",
    msg,
  );
  const notationPreviewHost = requireElement<HTMLDivElement>(
    form,
    "#notation-live-preview",
    msg,
  );
  const explanationInput = requireElement<HTMLTextAreaElement>(
    form,
    "#exercise-explanation",
    msg,
  );
  const baseXpInput = requireElement<HTMLInputElement>(
    form,
    "#exercise-base-xp",
    msg,
  );
  const tagsContainer = requireElement<HTMLDivElement>(
    form,
    "#exercise-tags-field",
    msg,
  );
  const calculatedXpOutput = requireElement<HTMLElement>(
    form,
    "#exercise-calculated-xp",
    msg,
  );
  const calculatedXpDetail = requireElement<HTMLElement>(
    form,
    "#exercise-calculated-xp-detail",
    msg,
  );
  const submitButton = requireElement<HTMLButtonElement>(
    form,
    'button[type="submit"]',
    msg,
  );
  const cancelButton = requireElement<HTMLButtonElement>(
    form,
    "#exercise-edit-cancel",
    msg,
  );
  const status = requireElement<HTMLParagraphElement>(
    form,
    ".form-status",
    msg,
  );

  let availableModules: LearningModule[] = [];
  let editingQuestionId: string | null = null;
  let baseXpManuallyEdited = false;

  const tagPicker = createXpTagPicker({
    name: "exerciseTags",
    legend: "Tags & XP-Faktor",
    onChange: () => {
      refreshCalculatedXp();
    },
  });
  tagsContainer.append(tagPicker.element);

  function addChoiceRow(text = "", checked = false): void {
    const row = document.createElement("div");
    row.className = "checklist-row exercise-choice-row";

    const selector = document.createElement("input");
    selector.className = "exercise-choice-correct";
    selector.type = typeSelect.value === "multi_select" ? "checkbox" : "radio";
    selector.name = "exerciseChoiceCorrect";
    selector.checked = checked;
    selector.setAttribute("aria-label", "Als richtige Lösung markieren");

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "exercise-choice-text";
    textInput.placeholder = "Antwortoption eingeben";
    textInput.value = text;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "checklist-remove exercise-choice-remove";
    removeBtn.textContent = "×";
    removeBtn.title = "Option entfernen";
    removeBtn.setAttribute("aria-label", "Antwortoption entfernen");
    removeBtn.addEventListener("click", () => {
      row.remove();
    });

    row.append(selector, textInput, removeBtn);
    choiceRows.append(row);
  }

  function syncChoiceInputModes(): void {
    const isMulti = typeSelect.value === "multi_select";
    const inputs = choiceRows.querySelectorAll<HTMLInputElement>(
      ".exercise-choice-correct",
    );
    let foundFirstChecked = false;
    inputs.forEach((input) => {
      input.type = isMulti ? "checkbox" : "radio";
      if (!isMulti && input.checked) {
        if (foundFirstChecked) {
          input.checked = false;
        } else {
          foundFirstChecked = true;
        }
      }
    });
  }

  function syncQuestionTypeSections(): void {
    const qType = typeSelect.value;
    const isChoice = qType === "single_choice" || qType === "multi_select";
    const isNumeric = qType === "numeric_input";
    const isNotation = qType === "interactive_notation";

    choiceSection.hidden = !isChoice;
    numericSection.hidden = !isNumeric;
    notationSection.hidden = !isNotation;

    if (isChoice) {
      syncChoiceInputModes();
      if (choiceRows.childElementCount === 0) {
        addChoiceRow("", true);
        addChoiceRow("", false);
      }
    }
    if (isNotation) {
      refreshNotationPreview();
    }
  }

  function readNotationConfigFromFields(): NotationBuilderTaskConfig {
    const clef = notationClefSelect.value === "bass" ? "bass" : "treble";
    const maxNotesRaw = Number(notationMaxNotesInput.value);
    const maxNotes = Number.isFinite(maxNotesRaw)
      ? Math.max(1, Math.min(8, Math.round(maxNotesRaw)))
      : 1;
    const lockDurationRaw = notationLockDurationSelect.value;
    const lockDuration =
      lockDurationRaw === "none"
        ? undefined
        : parseNotationDuration(lockDurationRaw);
    const compactRaw = notationCompactSelect.value;
    const compact: NotationBuilderTaskConfig["compact"] =
      compactRaw === "tight" || compactRaw === "wide" ? compactRaw : false;
    const expectedPitches = notationExpectedPitchesInput.value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const expectedDurations = notationExpectedDurationsInput.value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return {
      clef,
      maxNotes,
      ...(lockDuration !== undefined ? { lockDuration } : {}),
      showDurationPicker: notationShowDurationPicker.checked,
      compact,
      showHints: notationShowHints.checked,
      ...(expectedPitches.length > 0 ? { expectedPitches } : {}),
      ...(expectedDurations.length > 0 ? { expectedDurations } : {}),
    };
  }

  function refreshNotationPreview(): void {
    const taskConfig = readNotationConfigFromFields();
    const previewConfig: NotationBuilderConfig = {
      clef: taskConfig.clef,
      maxNotes: taskConfig.maxNotes ?? 1,
      ...(taskConfig.lockDuration !== undefined
        ? { lockDuration: taskConfig.lockDuration }
        : {}),
      showDurationPicker: taskConfig.showDurationPicker ?? false,
      compact: taskConfig.compact ?? false,
    };
    const previewEl = buildLivePreviewElement(
      previewConfig,
      taskConfig.showHints ?? false,
    );
    notationPreviewHost.replaceChildren(previewEl);
  }

  function refreshCalculatedXp(): number {
    const rawBase = Number(baseXpInput.value);
    const baseXp = Number.isFinite(rawBase) && rawBase >= 0 ? rawBase : 0;
    const tags = tagPicker.selectedTags();
    const totalXp = calculateQuestionXp(baseXp, tags);
    calculatedXpOutput.textContent = `${totalXp} XP`;
    const factor =
      baseXp > 0
        ? `${(totalXp / baseXp).toFixed(2).replace(/\.00$/, "")}x`
        : "1x";
    calculatedXpDetail.textContent = `Basis ${baseXp} XP · Faktor ${factor}`;
    return totalXp;
  }

  function setModules(modules: readonly LearningModule[]): void {
    availableModules = [...modules].sort((a, b) => a.order - b.order);
    const previousValue = moduleSelect.value;
    moduleSelect.replaceChildren();

    if (availableModules.length === 0) {
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent =
        "Noch keine Module vorhanden – bitte zuerst Modul anlegen";
      moduleSelect.append(emptyOpt);
      return;
    }

    for (const mod of availableModules) {
      const option = document.createElement("option");
      option.value = mod.id;
      option.textContent = `${mod.order}: ${mod.title} (${mod.id})`;
      moduleSelect.append(option);
    }

    if (
      previousValue &&
      availableModules.some((mod) => mod.id === previousValue)
    ) {
      moduleSelect.value = previousValue;
    }
  }

  function setBusy(busy: boolean): void {
    const controls = [
      moduleSelect,
      laneSelect,
      typeSelect,
      promptInput,
      choiceAddButton,
      numericAnswerInput,
      notationClefSelect,
      notationMaxNotesInput,
      notationLockDurationSelect,
      notationCompactSelect,
      notationShowDurationPicker,
      notationShowHints,
      notationExpectedPitchesInput,
      notationExpectedDurationsInput,
      explanationInput,
      baseXpInput,
      submitButton,
      cancelButton,
    ];
    for (const control of controls) {
      control.disabled = busy;
    }
    tagPicker.setDisabled(busy);
  }

  function resetForm(): void {
    editingQuestionId = null;
    baseXpManuallyEdited = false;
    const prevModule = moduleSelect.value;
    form.reset();
    if (prevModule && availableModules.some((m) => m.id === prevModule)) {
      moduleSelect.value = prevModule;
    }
    laneSelect.value = "exercise";
    typeSelect.value = "single_choice";
    baseXpInput.value = String(BASE_XP_DEFAULTS.exercise);
    choiceRows.replaceChildren();
    addChoiceRow("", true);
    addChoiceRow("", false);
    tagPicker.clear();
    submitButton.textContent = "Aufgabe speichern";
    cancelButton.hidden = true;
    syncQuestionTypeSections();
    refreshCalculatedXp();
  }

  function loadQuestion(question: ModuleQuestion): void {
    editingQuestionId = question.id;
    baseXpManuallyEdited = true;
    if (
      question.moduleId &&
      !availableModules.some((mod) => mod.id === question.moduleId)
    ) {
      const option = document.createElement("option");
      option.value = question.moduleId;
      option.textContent = question.moduleId;
      moduleSelect.append(option);
    }
    moduleSelect.value = question.moduleId;
    laneSelect.value = question.targetLane;
    typeSelect.value = question.questionType;
    promptInput.value = question.prompt;
    explanationInput.value = question.explanation;
    baseXpInput.value = String(question.baseXp);
    tagPicker.setSelectedTags(question.tags);

    choiceRows.replaceChildren();
    if (
      question.questionType === "single_choice" ||
      question.questionType === "multi_select"
    ) {
      const correctSet = new Set(question.correctAnswers);
      for (const optionText of question.options ?? []) {
        addChoiceRow(optionText, correctSet.has(optionText));
      }
    } else if (question.questionType === "numeric_input") {
      numericAnswerInput.value = question.correctAnswers[0] ?? "";
    } else if (
      question.questionType === "interactive_notation" &&
      question.notationTask
    ) {
      const task = question.notationTask;
      notationClefSelect.value = task.clef;
      notationMaxNotesInput.value = String(task.maxNotes ?? 1);
      notationLockDurationSelect.value =
        typeof task.lockDuration === "string" ? task.lockDuration : "none";
      notationCompactSelect.value =
        task.compact === "tight" || task.compact === "wide"
          ? task.compact
          : "false";
      notationShowDurationPicker.checked = Boolean(task.showDurationPicker);
      notationShowHints.checked = Boolean(task.showHints);
      notationExpectedPitchesInput.value = (task.expectedPitches ?? []).join(
        ", ",
      );
      notationExpectedDurationsInput.value = (
        task.expectedDurations ?? []
      ).join(", ");
    }

    submitButton.textContent = "Aufgaben-Änderungen speichern";
    cancelButton.hidden = false;
    syncQuestionTypeSections();
    refreshCalculatedXp();
    status.textContent = `Bearbeitungsmodus: Aufgabe „${question.prompt.slice(0, 48)}“ geladen.`;
    promptInput.focus();
  }

  choiceAddButton.addEventListener("click", () => {
    addChoiceRow("", false);
    const lastInput = choiceRows.querySelector<HTMLInputElement>(
      ".exercise-choice-row:last-child .exercise-choice-text",
    );
    lastInput?.focus();
  });

  laneSelect.addEventListener("change", () => {
    if (!baseXpManuallyEdited && isTargetLane(laneSelect.value)) {
      baseXpInput.value = String(getDefaultBaseXpForLane(laneSelect.value));
    }
    refreshCalculatedXp();
  });

  baseXpInput.addEventListener("input", () => {
    baseXpManuallyEdited = true;
    refreshCalculatedXp();
  });

  typeSelect.addEventListener("change", () => {
    syncQuestionTypeSections();
  });

  for (const control of [
    notationClefSelect,
    notationMaxNotesInput,
    notationLockDurationSelect,
    notationCompactSelect,
    notationShowDurationPicker,
    notationShowHints,
  ]) {
    control.addEventListener("change", refreshNotationPreview);
    control.addEventListener("input", refreshNotationPreview);
  }

  cancelButton.addEventListener("click", () => {
    resetForm();
    status.textContent = "Bearbeitung abgebrochen.";
  });

  document.addEventListener("question:edit", (event) => {
    if (event instanceof CustomEvent && isRecord(event.detail)) {
      if (Array.isArray(event.detail.modules)) {
        setModules(event.detail.modules as LearningModule[]);
      }
      const candidate = event.detail.question;
      if (isRecord(candidate) && typeof candidate.id === "string") {
        loadQuestion(candidate as unknown as ModuleQuestion);
        switchStarlightTab(2);
      }
    }
  });

  async function loadAvailableModules(): Promise<void> {
    if (typeof fetch !== "function") return;
    try {
      const db = await fetchModulesDatabase();
      setModules(db.modules);
    } catch {
      // Im Offline- oder unkonfigurierten Zustand bleibt bestehende Auswahl erhalten
    }
  }

  document.addEventListener("modules:updated", (event) => {
    if (
      event instanceof CustomEvent &&
      isRecord(event.detail) &&
      Array.isArray(event.detail.modules)
    ) {
      setModules(event.detail.modules as LearningModule[]);
    } else {
      void loadAvailableModules();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const targetLane: TargetLane = isTargetLane(laneSelect.value)
      ? laneSelect.value
      : "exercise";
    const questionType: QuestionType = isQuestionType(typeSelect.value)
      ? typeSelect.value
      : "single_choice";

    let options: string[] | undefined;
    let correctAnswers: string[] = [];
    let notationTask: NotationBuilderTaskConfig | undefined;

    if (questionType === "single_choice" || questionType === "multi_select") {
      const rows = Array.from(
        choiceRows.querySelectorAll<HTMLDivElement>(".exercise-choice-row"),
      );
      options = [];
      for (const row of rows) {
        const textEl = row.querySelector<HTMLInputElement>(
          ".exercise-choice-text",
        );
        const checkEl = row.querySelector<HTMLInputElement>(
          ".exercise-choice-correct",
        );
        const text = textEl?.value.trim() ?? "";
        if (!text) continue;
        options.push(text);
        if (checkEl?.checked) {
          correctAnswers.push(text);
        }
      }
    } else if (questionType === "numeric_input") {
      const ans = numericAnswerInput.value.trim();
      correctAnswers = ans ? [ans] : [];
    } else if (questionType === "interactive_notation") {
      notationTask = readNotationConfigFromFields();
    }

    const questionId =
      editingQuestionId ?? `q-${crypto.randomUUID().slice(0, 8)}`;
    const payload: UpsertQuestionInput & { entity: "question" } = {
      entity: "question",
      id: questionId,
      moduleId: moduleSelect.value.trim(),
      targetLane,
      questionType,
      prompt: promptInput.value.trim(),
      ...(options !== undefined ? { options } : {}),
      correctAnswers,
      ...(notationTask !== undefined ? { notationTask } : {}),
      explanation: explanationInput.value.trim(),
      baseXp: Number(baseXpInput.value),
      tags: tagPicker.selectedTags(),
    };

    const validationList =
      availableModules.length > 0
        ? availableModules
        : moduleSelect.value.trim()
          ? [{ id: moduleSelect.value.trim() } as LearningModule]
          : [];
    const validation = validateQuestionInput(payload, validationList);
    if (!validation.valid) {
      status.textContent = validation.errors.join(" ");
      return;
    }

    const isUpdate = editingQuestionId !== null;
    status.textContent = "Aufgabe wird gespeichert …";
    setBusy(true);

    try {
      const result = await sendModulesRequest(
        isUpdate ? "PUT" : "POST",
        payload,
        "Die Aufgabe konnte nicht gespeichert werden.",
      );

      resetForm();
      status.textContent = isUpdate
        ? "Aufgabe wurde aktualisiert."
        : "Aufgabe wurde gespeichert.";
      document.dispatchEvent(
        new CustomEvent("modules:updated", { bubbles: true, detail: result }),
      );
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Die Aufgabe konnte wegen eines unerwarteten Fehlers nicht gespeichert werden.";
    } finally {
      setBusy(false);
    }
  });

  syncQuestionTypeSections();
  refreshCalculatedXp();
  void loadAvailableModules();

  return {
    setModules,
    loadQuestion,
    resetForm,
    refreshCalculatedXp,
    refreshNotationPreview,
    tagPicker,
  };
}

export interface ModuleCatalogListController {
  reload(): Promise<void>;
  renderDatabase(db: ModulesDatabase): void;
}

/** Initialisiert die Katalog- und Verwaltungsansicht für Module und Aufgaben. */
export function attachModuleCatalogList(
  section: HTMLElement,
): ModuleCatalogListController {
  if (section.dataset.moduleCatalogAttached === "true") {
    throw new Error("ModuleCatalogList wurde bereits initialisiert.");
  }
  section.dataset.moduleCatalogAttached = "true";

  const msg = "Elemente der Modul-Übersicht fehlen.";
  const list = requireElement<HTMLUListElement>(
    section,
    "#module-catalog-list",
    msg,
  );
  const status = requireElement<HTMLParagraphElement>(
    section,
    "#module-list-status",
    msg,
  );
  const scopeFilter = requireElement<HTMLSelectElement>(
    section,
    "#filter-module-scope",
    msg,
  );
  const sortSelect = requireElement<HTMLSelectElement>(
    section,
    "#sort-modules",
    msg,
  );
  const viewToggle = requireElement<HTMLButtonElement>(
    section,
    "#module-view-toggle",
    msg,
  );
  const reloadButton = requireElement<HTMLButtonElement>(
    section,
    "#module-reload-btn",
    msg,
  );
  const listIcon = requireElement<SVGElement>(viewToggle, ".list-icon", msg);
  const cardsIcon = requireElement<SVGElement>(viewToggle, ".cards-icon", msg);

  const statusEl = status;
  let currentDb: ModulesDatabase = createEmptyModulesDatabase();
  const menus =
    section.querySelectorAll<HTMLDetailsElement>(".contribution-menu");

  for (const menu of menus) {
    const summary = menu.querySelector("summary");
    summary?.addEventListener("click", () => {
      if (menu.open) return;
      for (const other of menus) {
        if (other !== menu) other.open = false;
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    for (const menu of menus) {
      if (!menu.contains(event.target)) menu.open = false;
    }
  });

  viewToggle.addEventListener("click", () => {
    const isListView = list.dataset.view !== "list";
    list.dataset.view = isListView ? "list" : "cards";
    const label = isListView
      ? "Kartenansicht anzeigen"
      : "Listenansicht anzeigen";
    viewToggle.setAttribute("aria-label", label);
    viewToggle.title = label;
    listIcon.style.display = isListView ? "none" : "";
    cardsIcon.style.display = isListView ? "" : "none";
  });

  async function deleteEntity(
    entity: "module" | "question",
    id: string,
  ): Promise<void> {
    await sendModulesRequest(
      "DELETE",
      { entity, id },
      "Der Eintrag konnte nicht gelöscht werden.",
    );
    await reload();
    document.dispatchEvent(
      new CustomEvent("modules:updated", {
        bubbles: true,
        detail: currentDb,
      }),
    );
  }

  function renderModuleQuestions(
    mod: LearningModule,
    questions: readonly ModuleQuestion[],
  ): HTMLElement {
    const details = document.createElement("details");
    details.className = "module-questions-details";

    const summary = document.createElement("summary");
    summary.textContent = `Aufgaben & Quiz-Fragen (${questions.length})`;

    const body = document.createElement("div");
    body.className = "module-questions-body";

    const filterSelect = document.createElement("select");
    filterSelect.className = "module-question-lane-filter";
    filterSelect.setAttribute(
      "aria-label",
      `Aufgaben für ${mod.title} nach Lernspur filtern`,
    );
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "Alle Lernspuren";
    filterSelect.append(allOpt);
    for (const lane of ["exercise", "quiz_easy", "fastlane"] as const) {
      const opt = document.createElement("option");
      opt.value = lane;
      opt.textContent = LANE_LABELS[lane];
      filterSelect.append(opt);
    }

    const sublist = document.createElement("ul");
    sublist.className = "module-questions-sublist";

    function renderSublist(): void {
      sublist.replaceChildren();
      const laneFilter = filterSelect.value;
      const filtered = questions.filter(
        (q) => !laneFilter || q.targetLane === laneFilter,
      );

      if (filtered.length === 0) {
        const empty = document.createElement("li");
        empty.className = "module-question-empty";
        empty.textContent = "Keine Aufgaben in dieser Lernspur.";
        sublist.append(empty);
        return;
      }

      for (const question of filtered) {
        const qItem = document.createElement("li");
        qItem.className = "module-question-item";

        const qMeta = document.createElement("div");
        qMeta.className = "module-question-meta";

        const laneBadge = document.createElement("span");
        laneBadge.className = "contribution-area module-badge";
        laneBadge.textContent = LANE_LABELS[question.targetLane];

        const typeBadge = document.createElement("span");
        typeBadge.className = "contribution-tag module-badge";
        typeBadge.textContent = QUESTION_TYPE_LABELS[question.questionType];

        const xpBadge = document.createElement("span");
        xpBadge.className = "contribution-tag module-xp-badge";
        xpBadge.textContent = `${calculateQuestionXp(question.baseXp, question.tags)} XP`;

        qMeta.append(laneBadge, typeBadge, xpBadge);

        const qPrompt = document.createElement("p");
        qPrompt.className = "module-question-prompt";
        qPrompt.textContent = question.prompt;

        const qActions = document.createElement("div");
        qActions.className = "module-question-actions";

        const editQBtn = document.createElement("button");
        editQBtn.type = "button";
        editQBtn.className = "contribution-edit module-question-edit";
        editQBtn.textContent = "Bearbeiten";
        editQBtn.addEventListener("click", () => {
          document.dispatchEvent(
            new CustomEvent("question:edit", {
              bubbles: true,
              detail: { question, modules: currentDb.modules },
            }),
          );
        });

        const deleteQBtn = document.createElement("button");
        deleteQBtn.type = "button";
        deleteQBtn.className = "contribution-delete module-question-delete";
        deleteQBtn.textContent = "Löschen";
        deleteQBtn.addEventListener("click", async () => {
          if (!window.confirm("Diese Aufgabe wirklich löschen?")) return;
          deleteQBtn.disabled = true;
          try {
            await deleteEntity("question", question.id);
          } catch (error) {
            statusEl.textContent =
              error instanceof Error
                ? error.message
                : "Aufgabe konnte nicht gelöscht werden.";
            deleteQBtn.disabled = false;
          }
        });

        qActions.append(editQBtn, deleteQBtn);
        qItem.append(qMeta, qPrompt, qActions);
        sublist.append(qItem);
      }
    }

    filterSelect.addEventListener("change", renderSublist);
    renderSublist();
    body.append(filterSelect, sublist);
    details.append(summary, body);
    return details;
  }

  function renderDatabase(db: ModulesDatabase): void {
    currentDb = db;
    list.replaceChildren();

    const selectedScope = scopeFilter.value;
    const filtered = db.modules.filter(
      (mod) => !selectedScope || mod.scope === selectedScope,
    );

    const sorted = [...filtered].sort((a, b) => {
      if (sortSelect.value === "order_desc") return b.order - a.order;
      if (sortSelect.value === "xp_desc") {
        const sumA = getModuleSummary(db, a.id)?.totalXp ?? 0;
        const sumB = getModuleSummary(db, b.id)?.totalXp ?? 0;
        return sumB - sumA;
      }
      return a.order - b.order;
    });
    const canReorder = !selectedScope && sortSelect.value === "order_asc";

    for (const [index, mod] of sorted.entries()) {
      const modSummary = getModuleSummary(db, mod.id);
      const modQuestions = db.questions.filter((q) => q.moduleId === mod.id);

      const item = document.createElement("li");
      item.dataset.moduleId = mod.id;

      const header = document.createElement("div");
      header.className = "contribution-card-header";

      const meta = document.createElement("div");
      meta.className = "contribution-meta";

      const scopeTag = document.createElement("span");
      scopeTag.className = "contribution-tag module-badge";
      scopeTag.dataset.tag = mod.scope === "theory" ? "Feature" : "Decision";
      scopeTag.textContent = SCOPE_LABELS[mod.scope];

      const levelBadge = document.createElement("span");
      levelBadge.className = "contribution-area module-badge";
      levelBadge.textContent = mod.dStage
        ? `Level ${mod.level} · ${mod.dStage}`
        : `Level ${mod.level}`;

      const practiceBadge = document.createElement("span");
      practiceBadge.className = "contribution-status module-badge";
      practiceBadge.dataset.status = mod.hasPractice ? "Active" : "New";
      practiceBadge.textContent = mod.hasPractice
        ? "Mit Praxis"
        : "Nur Theorie";

      meta.append(scopeTag, levelBadge, practiceBadge);

      const actions = document.createElement("div");
      actions.className = "contribution-card-actions";

      for (const direction of ["up", "down"] as const) {
        const neighbor = sorted[index + (direction === "up" ? -1 : 1)];
        const moveBtn = document.createElement("button");
        moveBtn.type = "button";
        moveBtn.className = `module-move-${direction}`;
        moveBtn.textContent = direction === "up" ? "↑" : "↓";
        const label = `${mod.title} ${direction === "up" ? "nach oben" : "nach unten"} verschieben`;
        moveBtn.setAttribute("aria-label", label);
        moveBtn.title = canReorder
          ? label
          : "Zum Verschieben alle Bereiche und Reihenfolge 1 → N auswählen.";
        moveBtn.disabled = !canReorder || !neighbor;
        moveBtn.addEventListener("click", async () => {
          if (!neighbor) return;
          const buttons = Array.from(
            list.querySelectorAll<HTMLButtonElement>(
              ".module-move-up, .module-move-down",
            ),
          );
          const disabledStates = buttons.map((button) => button.disabled);
          buttons.forEach((button) => {
            button.disabled = true;
          });
          scopeFilter.disabled = true;
          sortSelect.disabled = true;
          reloadButton.disabled = true;
          status.textContent = `Modul „${mod.title}“ wird verschoben …`;
          try {
            const result = await sendModulesRequest(
              "PUT",
              {
                entity: "module-order",
                id: mod.id,
                neighborId: neighbor.id,
                direction,
              },
              "Das Modul konnte nicht verschoben werden.",
            );
            renderDatabase(parseModulesResponse(result));
            document.dispatchEvent(
              new CustomEvent("modules:updated", {
                bubbles: true,
                detail: result,
              }),
            );
          } catch (error) {
            status.textContent =
              error instanceof Error
                ? error.message
                : "Das Modul konnte nicht verschoben werden.";
            buttons.forEach((button, buttonIndex) => {
              button.disabled = disabledStates[buttonIndex];
            });
          } finally {
            scopeFilter.disabled = false;
            sortSelect.disabled = false;
            reloadButton.disabled = false;
          }
        });
        actions.append(moveBtn);
      }

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "contribution-edit";
      editBtn.title = "Modul bearbeiten";
      editBtn.setAttribute("aria-label", `${mod.title} bearbeiten`);
      addIcon(editBtn, [
        "M12 20h9",
        "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z",
      ]);
      editBtn.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("module:edit", {
            bubbles: true,
            detail: { module: mod },
          }),
        );
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "contribution-delete";
      deleteBtn.title = "Modul löschen";
      deleteBtn.setAttribute("aria-label", `${mod.title} löschen`);
      addIcon(deleteBtn, [
        "M3 6h18",
        "M8 6V4h8v2",
        "M5 6l1 14h12l1-14",
        "M10 10v6",
        "M14 10v6",
      ]);
      deleteBtn.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Modul „${mod.title}“ inklusive aller ${modQuestions.length} zugehörigen Aufgaben wirklich löschen?`,
          )
        ) {
          return;
        }
        deleteBtn.disabled = true;
        status.textContent = `Modul „${mod.title}“ wird gelöscht …`;
        try {
          await deleteEntity("module", mod.id);
        } catch (error) {
          status.textContent =
            error instanceof Error
              ? error.message
              : "Das Modul konnte nicht gelöscht werden.";
          deleteBtn.disabled = false;
        }
      });

      actions.append(editBtn, deleteBtn);
      header.append(meta, actions);

      const title = document.createElement("h2");
      title.textContent = `${mod.order}. ${mod.title}`;

      const description = document.createElement("p");
      description.className = "contribution-description";
      description.textContent = mod.description;
      description.hidden = !mod.description;

      const summaryRow = document.createElement("div");
      summaryRow.className = "module-summary-metrics";
      if (modSummary) {
        const metrics = [
          `Theorie-Blöcke: ${modSummary.theoryBlockCount}`,
          `Übungen: ${modSummary.questionCounts.exercise}`,
          `Quiz Einfach: ${modSummary.questionCounts.quiz_easy}`,
          `Fastlane: ${modSummary.questionCounts.fastlane}`,
          `Gesamt: ${modSummary.totalXp} XP`,
        ];
        for (const metric of metrics) {
          const pill = document.createElement("span");
          pill.className = "module-metric-pill";
          pill.textContent = metric;
          summaryRow.append(pill);
        }
      }

      const footer = document.createElement("div");
      footer.className = "contribution-card-footer";
      const idSpan = document.createElement("span");
      idSpan.textContent = `ID: ${mod.id} · Tags: ${mod.tags.join(", ") || "–"}`;
      footer.append(idSpan);

      const questionsPanel = renderModuleQuestions(mod, modQuestions);
      item.append(
        header,
        title,
        description,
        summaryRow,
        questionsPanel,
        footer,
      );
      list.append(item);
    }

    status.textContent =
      db.modules.length === 0
        ? "Noch keine Lernmodule gespeichert."
        : sorted.length === 0
          ? "Keine Module entsprechen dem gewählten Filter."
          : `${sorted.length} von ${db.modules.length} Modulen (${db.questions.length} Aufgaben gesamt).`;
  }

  async function reload(): Promise<void> {
    status.textContent = "Module werden geladen …";
    try {
      const db = await fetchModulesDatabase();
      renderDatabase(db);
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Die Module konnten nicht geladen werden.";
    }
  }

  scopeFilter.addEventListener("change", () => renderDatabase(currentDb));
  sortSelect.addEventListener("change", () => renderDatabase(currentDb));
  reloadButton.addEventListener("click", () => {
    void reload();
  });
  document.addEventListener("modules:updated", () => {
    void reload();
  });

  void reload();

  return {
    reload,
    renderDatabase,
  };
}
