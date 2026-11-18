import { addIcon } from "./contribution-types.ts";
import {
  DEFAULT_QUIZ_SETTINGS,
  formatExerciseTitle,
  isDStage,
  isModuleScope,
  isQuestionInModule,
  isQuestionType,
  isQuizSettings,
  isTargetLane,
  type LearningModule,
  type ModuleContentReference,
  type ModuleQuestion,
  type ModuleScope,
  type ModulesDatabase,
  NOTATION_DURATIONS,
  type NotationBuilderTaskConfig,
  type NotationTaskDuration,
  normalizeLegacyDatabase,
  type PracticeBlock,
  QUESTION_DIFFICULTIES,
  QUESTION_DIFFICULTY_LABELS,
  QUESTION_TYPES,
  type QuestionDifficulty,
  type QuestionType,
  type TargetLane,
  type TheoryBlock,
} from "./module-schema.ts";
import {
  createEmptyModulesDatabase,
  getModuleSummary,
  type ModuleExerciseRoleChange,
  type UpsertModuleInput,
  type UpsertQuestionInput,
  validateModuleInput,
  validateQuestionInput,
} from "./module-store.ts";
import {
  getTheoryDrumPatternError,
  notationToMarkdown,
} from "./module-theory-notation.ts";
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
import { createXpBadge, updateXpBadge } from "./xp-badge.ts";
import {
  BASE_XP_DEFAULTS,
  calculateModuleQuestionXp,
  calculateTheoryBlockXp,
  getAvailableTags,
  QUESTION_BASE_XP,
  QUESTION_DIFFICULTY_MULTIPLIERS,
  TAG_DEFINITIONS,
} from "./xp-tags.ts";

export const MODULES_API_ENDPOINT = "/api/modules";
export const MODULES_FUNCTION_FALLBACK_ENDPOINT = "/.netlify/functions/modules";
export const MODULE_DETAIL_PATH = "/projektierung/modul-builder/modul/";
export const MODULES_HTML_RESPONSE_ERROR =
  "Die Modul-API ist unter dieser Adresse nicht erreichbar (HTML-Antwort statt JSON). Bitte Dev-Server prüfen.";

const SCOPE_LABELS: Record<ModuleScope, string> = {
  theory: "Theorie",
  instrument: "Instrument",
  production: "Produktion",
  band: "Band",
};

const LANE_LABELS: Record<TargetLane, string> = {
  leicht: "Leicht",
  mittel: "Mittel",
  schwer: "Schwer",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Eine richtige Antwort",
  multi_select: "Mehrere richtige Antworten",
  numeric_input: "Zahleneingabe / Wert",
  interactive_notation: "Interaktive Notation",
};

const BLOCK_ROLE_LABELS = {
  theory: "Theorieteil",
  exercise_intro: "Aufgabenbeschreibung",
  practice: "Praxisaufgabe",
  exercise: "Aufgabe",
} as const;
type BlockEditorRole = keyof typeof BLOCK_ROLE_LABELS;
type BlockEditorKind = Exclude<BlockEditorRole, "exercise_intro">;
type BuilderXpRole = BlockEditorKind | "mixed";
interface BlockRoleDrafts {
  templates: Partial<Record<BlockEditorKind, HTMLDivElement>>;
  exercise?: ModuleQuestion;
  savedExercise?: ModuleQuestion;
}

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
  return normalizeLegacyDatabase({
    modules: data.modules as LearningModule[],
    questions: data.questions as ModuleQuestion[],
    ...(data.quizSettings !== undefined
      ? { quizSettings: data.quizSettings }
      : {}),
  });
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

function createLabeledField(
  labelText: string,
  control: HTMLElement,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "field";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

export interface XpTagPickerController {
  element: HTMLFieldSetElement;
  selectedTags(): string[];
  setSelectedTags(tags: readonly string[]): void;
  clear(): void;
  setDisabled(disabled: boolean): void;
}

function createQuestionDifficultyPicker(
  name: string,
  initial: QuestionDifficulty,
  onChange: () => void,
) {
  const element = document.createElement("fieldset");
  element.className = "contribution-type-picker question-difficulty-picker";
  const legend = document.createElement("legend");
  legend.textContent = "Schwierigkeit";
  const choices = document.createElement("div");
  choices.className = "contribution-type-choices xp-tag-choices";
  let selected = initial;
  const inputs = QUESTION_DIFFICULTIES.map((difficulty) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = difficulty;
    input.checked = difficulty === initial;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      selected = difficulty;
      onChange();
    });
    const chip = document.createElement("span");
    chip.className = "contribution-tag xp-tag-chip";
    chip.textContent = QUESTION_DIFFICULTY_LABELS[difficulty];
    label.append(input, chip);
    choices.append(label);
    return input;
  });
  element.append(legend, choices);
  return {
    element,
    value: () => selected,
    setValue(value: QuestionDifficulty): void {
      selected = value;
      for (const input of inputs) input.checked = input.value === value;
    },
  };
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

  fieldset.append(legend, choices);

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
  addPracticeBlock(initial?: Partial<PracticeBlock>): void;
  items(): TheoryBlock[] | null;
  practiceItems(): PracticeBlock[] | null;
  setCreateExerciseHandler(handler: () => ModuleQuestion): void;
  setItems(blocks: readonly TheoryBlock[]): void;
  setPracticeBlocks(blocks: readonly PracticeBlock[]): void;
  setExercises(
    questions: readonly ModuleQuestion[],
    order?: readonly ModuleContentReference[],
  ): void;
  removeExercise(id: string): void;
  addExercise(question: ModuleQuestion): void;
  exerciseUpdates(): ModuleQuestion[];
  exerciseRoleChanges(): ModuleExerciseRoleChange[];
  markRoleChangesSaved(): void;
  markExercisesSaved(exercises: readonly ModuleQuestion[]): void;
  isDraftExercise(id: string): boolean;
  draftExercises(): ModuleQuestion[];
  contentOrder(): ModuleContentReference[];
  clear(): void;
  setDisabled(disabled: boolean): void;
  refreshCalculatedXp(): void;
}

/** Erzeugt einen dynamischen Editor für sortierbare Theorie-Blöcke. */
export function createTheoryBlockEditor(
  initialBlocks: readonly TheoryBlock[] = [],
  getDefaultBaseXp: () => number = () => BASE_XP_DEFAULTS.theoryBlock,
  deleteExercise?: (question: ModuleQuestion) => void,
): TheoryBlockEditorController {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "checklist-editor theory-block-editor";

  const legend = document.createElement("legend");
  legend.textContent = "Modulblöcke";

  const rows = document.createElement("div");
  rows.className = "theory-block-rows";
  const readExerciseUpdate = new WeakMap<
    HTMLDivElement,
    () => ModuleQuestion | null
  >();
  const legacyVisuals = new WeakMap<HTMLDivElement, Partial<TheoryBlock>>();
  const blockTags = new WeakMap<HTMLDivElement, XpTagPickerController>();
  const xpByRow = new WeakMap<Element, number>();
  const refreshExerciseXp = new WeakMap<HTMLDivElement, () => void>();
  let exerciseQuestions: ModuleQuestion[] = [];
  const draftExerciseIds = new Set<string>();
  const expandedGroups = new Set<string>();
  const roleDrafts = new WeakMap<HTMLDivElement, BlockRoleDrafts>();
  const inactiveExerciseIds = new Set<string>();
  let previewRenderer: Promise<typeof import("./module-player-ui.ts")> | undefined;

  function updateBuilderXpBadge(
    badge: HTMLElement,
    xp: number,
    role: BuilderXpRole,
  ): void {
    badge.setAttribute("aria-live", "polite");
    badge.dataset.xpRole = role;
    updateXpBadge(badge, xp);
    if (badge.closest("details")?.open) badge.prepend("berechnet: ");
  }

  function createPreviewPanel(ariaLabel: string): HTMLDetailsElement {
    const panel = document.createElement("details");
    panel.className = "module-content-preview";
    panel.setAttribute("aria-label", ariaLabel);
    const summary = document.createElement("summary");
    summary.className = "module-content-preview-summary";
    summary.textContent = "Vorschau";
    const body = document.createElement("div");
    body.className = "module-content-preview-body";
    panel.append(summary, body);
    return panel;
  }

  function getDirectPreview(
    container: HTMLDivElement,
  ): HTMLDetailsElement | undefined {
    return Array.from(container.children).find(
      (child): child is HTMLDetailsElement =>
        child.classList.contains("module-content-preview"),
    );
  }

  function getPreviewLabel(row: HTMLDivElement): string {
    const title =
      row.querySelector<HTMLInputElement>(
        ".theory-block-title, .module-exercise-title",
      )?.value.trim() ?? "";
    const prompt =
      row.querySelector<HTMLTextAreaElement>(".module-exercise-prompt")
        ?.value.trim() ?? "";
    if (row.classList.contains("module-exercise-row")) {
      return formatExerciseTitle(title, prompt);
    }
    if (row.classList.contains("module-practice-row")) {
      return `Praxisaufgabe · ${title || "Neuer Block"}`;
    }
    return row.dataset.blockRole === "exercise_intro"
      ? `Aufgabenbeschreibung · ${title || "Neuer Block"}`
      : `Theorie · ${title || "Neuer Block"}`;
  }

  function updatePreviewSummary(
    panel: HTMLDetailsElement,
    title: string,
  ): void {
    const summary = panel.querySelector<HTMLElement>("summary");
    if (!summary) throw new Error("Der Vorschaubereich hat keine Überschrift.");
    summary.textContent = title;
  }

  function updatePreview(panel: HTMLDetailsElement, row: HTMLDivElement): void {
    const body = panel.querySelector<HTMLElement>(
      ".module-content-preview-body",
    );
    if (!body) throw new Error("Der Inhaltsbereich der Vorschau fehlt.");
    const title =
      row.querySelector<HTMLInputElement>(
        ".theory-block-title, .module-exercise-title",
      )?.value.trim() ?? "";
    const prompt =
      row.querySelector<HTMLTextAreaElement>(".module-exercise-prompt")
        ?.value.trim() ?? "";
    const isExercise = row.classList.contains("module-exercise-row");
    updatePreviewSummary(panel, `Vorschau · ${getPreviewLabel(row)}`);
    const revision = String(Number(panel.dataset.previewRevision ?? "0") + 1);
    panel.dataset.previewRevision = revision;
    body.replaceChildren();

    if (!previewRenderer) {
      previewRenderer = import("./module-player-ui.ts");
    }
    void previewRenderer.then(
      ({
        renderQuestionPrompt,
        renderTheoryMarkdown,
        renderTheoryVisualElement,
      }) => {
        if (
          !panel.isConnected ||
          panel.dataset.previewRevision !== revision
        ) {
          return;
        }
        const article = document.createElement("article");
        article.className = isExercise
          ? "learning-quiz-card"
          : "learning-theory-block";

        if (isExercise) {
          const cardHeader = document.createElement("div");
          cardHeader.className = "learning-card-header";
          const questionTitle = document.createElement("strong");
          questionTitle.textContent = formatExerciseTitle(title, prompt);
          cardHeader.append(questionTitle);
          const type = row.querySelector<HTMLSelectElement>(
            ".question-type-editor select",
          );
          if (type?.selectedOptions[0]?.textContent) {
            const badge = document.createElement("span");
            badge.className = "module-badge";
            badge.textContent = type.selectedOptions[0].textContent;
            cardHeader.append(badge);
          }
          article.append(cardHeader);
          if (prompt) {
            article.append(renderQuestionPrompt(prompt, fieldset));
          }
          const options = Array.from(
            row.querySelectorAll<HTMLInputElement>(".exercise-choice-text"),
          )
            .map((input) => input.value.trim())
            .filter(Boolean);
          if (options.length > 0) {
            const list = document.createElement("div");
            list.className = "learning-quiz-options";
            for (const option of options) {
              const item = document.createElement("div");
              item.className = "learning-quiz-option";
              const text = document.createElement("span");
              text.textContent = option;
              item.append(text);
              list.append(item);
            }
            article.append(list);
          }
          const notationPreview = row.querySelector<HTMLElement>(
            ".notation-live-preview-box",
          );
          if (type?.value === "interactive_notation" && notationPreview) {
            article.append(notationPreview.cloneNode(true));
          }
        } else {
          const markdown =
            row.querySelector<HTMLTextAreaElement>(
              ".theory-block-markdown",
            )?.value ?? "";
          const heading = document.createElement("h3");
          heading.className = "learning-theory-block-title";
          heading.textContent = title || "Neuer Block";
          article.append(heading);
          if (markdown.trim()) {
            const content = document.createElement("div");
            content.className = "learning-theory-markdown";
            content.append(renderTheoryMarkdown(markdown, fieldset));
            article.append(content);
          }
          if (row.classList.contains("theory-block-row")) {
            const visual = renderTheoryVisualElement(
              {
                id: row.dataset.blockId ?? "preview",
                order: 0,
                title,
                markdownContent: markdown,
                ...legacyVisuals.get(row),
              },
              fieldset,
            );
            if (visual) article.append(visual);
          }
        }
        body.replaceChildren(article);
      },
    ).catch((error: unknown) => {
      if (
        !panel.isConnected ||
        panel.dataset.previewRevision !== revision
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const warning = document.createElement("p");
      warning.className = "learning-notation-error";
      warning.textContent = `Vorschau nicht verfügbar: ${message}`;
      body.replaceChildren(warning);
    });
  }

  function updateGroupPreview(
    panel: HTMLDetailsElement,
    members: readonly HTMLDivElement[],
    groupTitle: string,
  ): void {
    const body = panel.querySelector<HTMLElement>(
      ".module-content-preview-body",
    );
    if (!body) throw new Error("Der Gruppen-Vorschaubereich fehlt.");
    const title = groupTitle.trim() || "Neuer Abschnitt";
    updatePreviewSummary(panel, `Abschnitt · ${title}`);
    const heading = document.createElement("h3");
    heading.className = "learning-theory-block-title";
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = `${members.length} ${members.length === 1 ? "Eintrag" : "Einträge"}`;
    body.replaceChildren(heading, description);
  }

  function refreshPreviewForRow(row: HTMLDivElement): void {
    const preview = getDirectPreview(row);
    if (!preview) return;
    updatePreviewSummary(preview, `Vorschau · ${getPreviewLabel(row)}`);
    if (preview.open) updatePreview(preview, row);
  }

  const groupButton = document.createElement("button");
  groupButton.type = "button";
  groupButton.className = "theory-block-group-selected";
  groupButton.textContent = "Auswahl gruppieren";
  groupButton.disabled = true;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "theory-block-add";
  addButton.textContent = "+ Block hinzufügen";
  let createExerciseHandler: (() => ModuleQuestion) | undefined;

  function blockKind(row: HTMLDivElement): BlockEditorKind | undefined {
    if (row.classList.contains("theory-block-row")) return "theory";
    if (row.classList.contains("module-practice-row")) return "practice";
    if (row.classList.contains("module-exercise-row")) return "exercise";
    return undefined;
  }

  function blockXpRole(row: HTMLDivElement): BlockEditorKind {
    if (row.dataset.blockRole === "exercise_intro") return "exercise";
    const kind = blockKind(row);
    if (!kind) throw new Error("Die XP-Anzeige benötigt eine gültige Blockrolle.");
    return kind;
  }

  function showBlockRoleError(row: HTMLDivElement, message: string): void {
    const error = row.querySelector<HTMLElement>(".block-role-error");
    if (!error) throw new Error("Die Fehlermeldung für die Blockrolle fehlt.");
    error.textContent = message;
    error.hidden = !message;
  }

  function setBlockRole(row: HTMLDivElement, role: BlockEditorRole): void {
    row.dataset.blockRole = role;
    for (const input of row.querySelectorAll<HTMLInputElement>(
      ".theory-block-role",
    )) {
      input.checked = input.value === role;
    }
    const picker = blockTags.get(row);
    if (picker) picker.element.hidden = role === "exercise_intro";
  }

  function installBlockRolePicker(
    row: HTMLDivElement,
    role?: BlockEditorRole,
  ): BlockRoleDrafts {
    const state: BlockRoleDrafts = { templates: {} };
    const kind = blockKind(row);
    if (kind) state.templates[kind] = row;
    roleDrafts.set(row, state);
    const picker = document.createElement("fieldset");
    picker.className = "contribution-type-picker theory-block-role-options";
    const legend = document.createElement("legend");
    legend.textContent = "Blockrolle";
    const choices = document.createElement("div");
    choices.className = "contribution-type-choices xp-tag-choices";
    for (const value of Object.keys(BLOCK_ROLE_LABELS) as BlockEditorRole[]) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `block-role-${row.dataset.blockId}`;
      input.value = value;
      input.className = "theory-block-role";
      input.checked = value === role;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        try {
          changeBlockRole(row, value);
        } catch (error) {
          showBlockRoleError(
            row,
            error instanceof Error ? error.message : String(error),
          );
          for (const option of choices.querySelectorAll<HTMLInputElement>(
            "input",
          )) {
            option.checked = option.value === row.dataset.blockRole;
          }
        }
      });
      const badge = document.createElement("span");
      badge.className = "contribution-tag xp-tag-chip";
      badge.textContent = BLOCK_ROLE_LABELS[value];
      label.append(input, badge);
      choices.append(label);
    }
    picker.append(legend, choices);
    const error = document.createElement("p");
    error.className = "block-role-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const host =
      row.querySelector(".theory-block-content, .module-exercise-editor") ?? row;
    host.prepend(picker, error);
    if (role) setBlockRole(row, role);
    return state;
  }

  function changeBlockRole(row: HTMLDivElement, role: BlockEditorRole): void {
    const state = roleDrafts.get(row);
    const id = row.dataset.blockId;
    if (!state || !id) throw new Error("Der Block kann nicht zugeordnet werden.");
    const kind = role === "exercise_intro" ? "theory" : role;
    let target = state.templates[kind];
    if (!target) {
      if (kind === "exercise") {
        if (!createExerciseHandler) {
          throw new Error("Eine Aufgabe benötigt eine Modulzuordnung.");
        }
        const exercise = {
          ...createExerciseHandler(),
          id,
          tags: blockTags.get(row)?.selectedTags() ?? [],
        };
        target = createExerciseRow(exercise);
        state.exercise = exercise;
      } else {
        target = createContentBlock(
          { id, tags: blockTags.get(row)?.selectedTags() ?? [] },
          kind,
        );
      }
      state.templates[kind] = target;
      roleDrafts.set(target, state);
    }
    if (target !== row) {
      const title = row.querySelector<HTMLInputElement>(
        ".theory-block-title, .module-exercise-title",
      );
      const text = row.querySelector<HTMLTextAreaElement>(
        ".theory-block-markdown, .module-exercise-prompt",
      );
      const targetTitle = target.querySelector<HTMLInputElement>(
        ".theory-block-title, .module-exercise-title",
      );
      const targetText = target.querySelector<HTMLTextAreaElement>(
        ".theory-block-markdown, .module-exercise-prompt",
      );
      if (title && targetTitle) targetTitle.value = title.value;
      if (text && targetText) targetText.value = text.value;
      const selected = row.querySelector<HTMLInputElement>(".theory-block-select");
      const targetSelected = target.querySelector<HTMLInputElement>(
        ".theory-block-select",
      );
      if (selected && targetSelected) targetSelected.checked = selected.checked;
      const details = target.querySelector<HTMLDetailsElement>(
        ".theory-block-details",
      );
      const open =
        row.querySelector<HTMLDetailsElement>(".theory-block-details")?.open ??
        true;
      if (details) details.open = open;
      const preview = getDirectPreview(target);
      if (preview) preview.open = open;
      for (const key of ["groupId", "groupTitle", "groupCollapsed"] as const) {
        const value = row.dataset[key];
        if (value !== undefined) target.dataset[key] = value;
        else delete target.dataset[key];
      }
      if (row.classList.contains("module-exercise-row")) {
        inactiveExerciseIds.add(id);
        exerciseQuestions = exerciseQuestions.filter(
          (question) => question.id !== id,
        );
      }
      if (kind === "exercise") {
        if (!state.exercise) throw new Error("Die Aufgabenvorlage fehlt.");
        inactiveExerciseIds.delete(id);
        if (!state.savedExercise) draftExerciseIds.add(id);
        exerciseQuestions.push(state.exercise);
      }
      row.replaceWith(target);
    }
    setBlockRole(target, role);
    showBlockRoleError(target, "");
    renderGroupHeaders();
    syncRowOrder();
    refreshCalculatedXp();
    refreshExerciseXp.get(target)?.();
    refreshPreviewForRow(target);
    if (target !== row) {
      target
        .querySelector<HTMLInputElement>(".theory-block-role:checked")
        ?.focus();
    }
  }

  function removeBlockRow(row: HTMLDivElement): void {
    const state = roleDrafts.get(row);
    const question =
      state?.savedExercise ??
      (blockKind(row) === "exercise" ? state?.exercise : undefined);
    if (question) {
      if (!deleteExercise) {
        showBlockRoleError(
          row,
          "Die Aufgabe kann hier nicht gelöscht werden.",
        );
        return;
      }
      deleteExercise(question);
      return;
    }
    const id = row.dataset.blockId;
    if (id && state?.exercise) {
      removeExercise(id);
      return;
    }
    row.remove();
    renderGroupHeaders();
    syncRowOrder();
  }

  function selectedGroupRows(): HTMLDivElement[] {
    return Array.from(
      rows.querySelectorAll<HTMLDivElement>(
        ".theory-block-row, .module-exercise-row, .module-practice-row",
      ),
    ).filter(
      (row) =>
        row.querySelector<HTMLInputElement>(".theory-block-select")?.checked,
    );
  }

  function updateGroupButton(): void {
    groupButton.disabled = selectedGroupRows().length < 2;
  }

  function allRows(): HTMLDivElement[] {
    return Array.from(
      rows.querySelectorAll<HTMLDivElement>(
        ".theory-block-row, .module-exercise-row, .module-practice-row, .module-block-pending",
      ),
    );
  }

  function rowContainer(row: HTMLDivElement): HTMLDivElement {
    return row.closest<HTMLDivElement>(".theory-block-group") ?? row;
  }

  function refreshGroupXp(group: HTMLElement): void {
    const badge = group.querySelector<HTMLElement>(
      ".theory-group-summary > .learning-xp-badge",
    );
    if (!badge) return;
    const members = Array.from(group.children).filter(
      (child): child is HTMLDivElement =>
        child instanceof HTMLDivElement && blockKind(child) !== undefined,
    );
    const xp = members.reduce(
      (total, child) => total + (xpByRow.get(child) ?? 0),
      0,
    );
    const roles = new Set(members.map(blockXpRole));
    const role =
      roles.size > 1 ? "mixed" : (roles.values().next().value ?? "theory");
    updateBuilderXpBadge(badge, xp, role);
  }

  function renderGroupHeaders(): void {
    const rowElements = allRows();
    rows.replaceChildren();
    const seenGroups = new Set<string>();
    let index = 0;
    while (index < rowElements.length) {
      const row = rowElements[index];
      if (!row) break;
      const groupId = row.dataset.groupId;
      if (!groupId) {
        delete row.dataset.groupPosition;
        delete row.dataset.groupCollapsed;
        rows.append(row);
        refreshPreviewForRow(row);
        index += 1;
        continue;
      }

      const members: HTMLDivElement[] = [];
      while (rowElements[index]?.dataset.groupId === groupId) {
        const member = rowElements[index];
        if (member) {
          members.push(member);
        }
        index += 1;
      }
      seenGroups.add(groupId);
      const expanded = expandedGroups.has(groupId);

      const group = document.createElement("div");
      group.className = "theory-block-group";
      group.dataset.groupId = groupId;
      const groupPreview = createPreviewPanel("Abschnittsvorschau");
      groupPreview.open = expanded;

      const header = document.createElement("div");
      header.className = "theory-group-editor-heading";
      const groupDetails = document.createElement("details");
      groupDetails.className = "theory-group-details";
      groupDetails.open = expanded;
      const groupSummary = document.createElement("summary");
      groupSummary.className = "theory-group-summary";
      const groupTitleText = document.createElement("span");
      groupTitleText.className = "theory-group-summary-title";
      groupTitleText.textContent = `Abschnitt · ${row.dataset.groupTitle ?? ""}`;
      groupSummary.append(groupTitleText, " ", createXpBadge());
      groupDetails.append(groupSummary);

      const label = document.createElement("label");
      label.className = "field";
      const caption = document.createElement("span");
      const count = members.length;
      caption.textContent = `Abschnittstitel · ${count} ${count === 1 ? "Eintrag" : "Einträge"}`;
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "theory-group-title";
      titleInput.required = true;
      titleInput.value = row.dataset.groupTitle ?? "";
      titleInput.addEventListener("input", () => {
        for (const member of members) {
          member.dataset.groupTitle = titleInput.value;
        }
        groupTitleText.textContent = `Abschnitt · ${titleInput.value}`;
        updateGroupPreview(groupPreview, members, titleInput.value);
      });
      label.append(caption, titleInput);
      groupDetails.append(label);
      groupDetails.addEventListener("toggle", () => {
        const isExpanded = groupDetails.open;
        refreshGroupXp(group);
        if (isExpanded) expandedGroups.add(groupId);
        else expandedGroups.delete(groupId);
        groupPreview.open = isExpanded;
        for (const member of members) {
          if (isExpanded) delete member.dataset.groupCollapsed;
          else member.dataset.groupCollapsed = "true";
        }
      });
      groupPreview.addEventListener("toggle", () => {
        if (groupDetails.open !== groupPreview.open) {
          groupDetails.open = groupPreview.open;
        }
      });

      const actions = document.createElement("div");
      actions.className = "theory-group-editor-actions";

      const moveUpButton = document.createElement("button");
      moveUpButton.type = "button";
      moveUpButton.className = "theory-group-up";
      moveUpButton.textContent = "↑";
      moveUpButton.title = "Gruppe nach oben verschieben";
      moveUpButton.setAttribute("aria-label", "Gruppe nach oben verschieben");
      moveUpButton.addEventListener("click", () => moveRow(row, -1));

      const moveDownButton = document.createElement("button");
      moveDownButton.type = "button";
      moveDownButton.className = "theory-group-down";
      moveDownButton.textContent = "↓";
      moveDownButton.title = "Gruppe nach unten verschieben";
      moveDownButton.setAttribute(
        "aria-label",
        "Gruppe nach unten verschieben",
      );
      moveDownButton.addEventListener("click", () => moveRow(row, 1));

      const ungroupButton = document.createElement("button");
      ungroupButton.type = "button";
      ungroupButton.className = "checklist-remove theory-group-ungroup";
      ungroupButton.textContent = "−";
      ungroupButton.title = "Gruppierung lösen";
      ungroupButton.setAttribute("aria-label", "Gruppierung lösen");
      ungroupButton.addEventListener("click", () => {
        expandedGroups.delete(groupId);
        for (const member of members) {
          delete member.dataset.groupId;
          delete member.dataset.groupTitle;
          delete member.dataset.groupCollapsed;
        }
        renderGroupHeaders();
        syncRowOrder();
      });
      actions.append(moveUpButton, moveDownButton, ungroupButton);
      header.append(groupDetails, actions);
      for (const member of members) {
        if (!expanded) member.dataset.groupCollapsed = "true";
        else delete member.dataset.groupCollapsed;
      }
      group.append(header, groupPreview, ...members);
      refreshGroupXp(group);
      rows.append(group);
      for (const member of members) refreshPreviewForRow(member);
      updateGroupPreview(groupPreview, members, titleInput.value);
    }
    for (const groupId of expandedGroups) {
      if (!seenGroups.has(groupId)) expandedGroups.delete(groupId);
    }
  }

  function ungroupRow(row: HTMLDivElement): void {
    const groupId = row.dataset.groupId;
    if (!groupId) return;

    const members = allRows().filter(
      (member) => member.dataset.groupId === groupId,
    );
    if (members.length <= 2) {
      expandedGroups.delete(groupId);
      for (const member of members) {
        delete member.dataset.groupId;
        delete member.dataset.groupTitle;
        delete member.dataset.groupCollapsed;
      }
    } else {
      delete row.dataset.groupId;
      delete row.dataset.groupTitle;
      delete row.dataset.groupCollapsed;
      const group = rowContainer(row);
      rows.insertBefore(row, group.nextSibling);
    }

    renderGroupHeaders();
    syncRowOrder();
  }

  function createUngroupItemButton(row: HTMLDivElement): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "checklist-remove theory-block-ungroup-item";
    button.textContent = "−";
    button.title = "Aus Gruppe lösen";
    button.setAttribute("aria-label", "Aus Gruppe lösen");
    button.hidden = true;
    button.addEventListener("click", () => ungroupRow(row));
    return button;
  }

  function rowUnit(row: HTMLDivElement): HTMLDivElement[] {
    const groupId = row.dataset.groupId;
    if (!groupId) return [row];
    return allRows().filter((member) => member.dataset.groupId === groupId);
  }

  function syncRowOrder(): void {
    const rowElements = allRows();
    let theoryNumber = 0;
    rowElements.forEach((row, index) => {
      const label = row.querySelector<HTMLElement>(".theory-block-order-label");
      if (label) {
        if (row.classList.contains("theory-block-row")) {
          const title = row.querySelector<HTMLInputElement>(
            ".theory-block-title",
          );
          if (row.dataset.blockRole === "exercise_intro") {
            label.textContent = `Aufgabenbeschreibung · ${title?.value.trim() || "Neuer Block"}`;
          } else {
            theoryNumber += 1;
            label.textContent = `Theorie ${theoryNumber} · ${title?.value.trim() || "Neuer Block"}`;
          }
        } else if (row.classList.contains("module-exercise-row")) {
          label.textContent = formatExerciseTitle(
            row.querySelector<HTMLInputElement>(".module-exercise-title")
              ?.value,
            row.querySelector<HTMLTextAreaElement>(".module-exercise-prompt")
              ?.value,
          );
        } else {
          label.textContent = `Praxisaufgabe · ${row.querySelector<HTMLInputElement>(".theory-block-title")?.value.trim() || "Neuer Block"}`;
        }
      }
      const unit = rowUnit(row);
      const firstInUnit = unit[0] === row;
      const lastInUnit = unit[unit.length - 1] === row;
      if (row.dataset.groupId) {
        row.dataset.groupPosition =
          firstInUnit && lastInUnit
            ? "single"
            : firstInUnit
              ? "first"
              : lastInUnit
                ? "last"
                : "middle";
      } else {
        delete row.dataset.groupPosition;
      }
      const upButton = row.querySelector<HTMLButtonElement>(".theory-block-up");
      const downButton =
        row.querySelector<HTMLButtonElement>(".theory-block-down");
      const group = row.dataset.groupId ? rowContainer(row) : null;
      const groupUpButton =
        firstInUnit && group
          ? group.querySelector<HTMLButtonElement>(".theory-group-up")
          : null;
      if (groupUpButton) {
        groupUpButton.disabled = rowElements.indexOf(unit[0]) === 0;
      }
      const groupDownButton =
        firstInUnit && group
          ? group.querySelector<HTMLButtonElement>(".theory-group-down")
          : null;
      if (groupDownButton) {
        groupDownButton.disabled =
          rowElements.indexOf(unit[unit.length - 1]) === rowElements.length - 1;
      }
      if (upButton) {
        upButton.hidden = Boolean(row.dataset.groupId) || !firstInUnit;
        upButton.disabled = index === 0;
        const label = row.dataset.groupId
          ? "Gruppe nach oben verschieben"
          : "Theorie-Block nach oben verschieben";
        upButton.title = label;
        upButton.setAttribute("aria-label", label);
      }
      if (downButton) {
        downButton.hidden = Boolean(row.dataset.groupId) || !lastInUnit;
        downButton.disabled = index === rowElements.length - 1;
        const label = row.dataset.groupId
          ? "Gruppe nach unten verschieben"
          : "Theorie-Block nach unten verschieben";
        downButton.title = label;
        downButton.setAttribute("aria-label", label);
      }
      const select = row.querySelector<HTMLInputElement>(
        ".theory-block-select",
      );
      if (select) {
        select.disabled = Boolean(row.dataset.groupId);
        if (select.disabled) select.checked = false;
        const selectLabel = select.closest<HTMLLabelElement>(
          ".theory-block-select-label",
        );
        if (selectLabel) selectLabel.hidden = select.disabled;
      }
      const ungroupButton = row.querySelector<HTMLButtonElement>(
        ".theory-block-ungroup-item",
      );
      if (ungroupButton) ungroupButton.hidden = !row.dataset.groupId;
      const removeButton = row.querySelector<HTMLButtonElement>(
        ".theory-block-remove, .module-exercise-remove",
      );
      if (removeButton) removeButton.hidden = Boolean(row.dataset.groupId);
    });
    updateGroupButton();
  }

  function moveRow(row: HTMLDivElement, direction: -1 | 1): void {
    const container = rowContainer(row);
    const adjacent =
      direction === -1
        ? container.previousElementSibling
        : container.nextElementSibling;
    if (!(adjacent instanceof HTMLDivElement)) return;
    const anchor = direction === -1 ? adjacent : adjacent.nextElementSibling;
    rows.insertBefore(container, anchor);
    syncRowOrder();
  }

  function refreshCalculatedXp(): void {
    for (const row of rows.querySelectorAll<HTMLDivElement>(
      ".theory-block-row, .module-practice-row",
    )) {
      const input = row.querySelector<HTMLInputElement>(".theory-block-xp");
      const picker = blockTags.get(row);
      if (!input || !picker) continue;
      const defaultXp = row.classList.contains("module-practice-row")
        ? BASE_XP_DEFAULTS.practice
        : getDefaultBaseXp();
      const baseXp = input.value.trim() ? Number(input.value) : defaultXp;
      const xp = calculateTheoryBlockXp(
        {
          baseXp,
          tags: picker.selectedTags(),
          ...(row.dataset.blockRole === "exercise_intro"
            ? { role: "exercise_intro" }
            : {}),
        },
        defaultXp,
      );
      xpByRow.set(row, xp);
      const badge = row.querySelector<HTMLElement>(
        "summary > .learning-xp-badge",
      );
      if (badge) updateBuilderXpBadge(badge, xp, blockXpRole(row));
    }
    for (const group of rows.querySelectorAll<HTMLElement>(
      ".theory-block-group",
    )) {
      refreshGroupXp(group);
    }
  }

  function createContentBlock(
    initial: Partial<TheoryBlock & PracticeBlock> = {},
    kind: "theory" | "practice" = "theory",
  ): HTMLDivElement {
    if (kind === "theory") initial = notationToMarkdown(initial);
    const row = document.createElement("div");
    row.className =
      kind === "theory" ? "theory-block-row" : "module-practice-row";
    if (kind === "theory" && initial.role === "exercise_intro") {
      row.dataset.blockRole = "exercise_intro";
    }
    if (
      kind === "theory" &&
      initial.visualComponent &&
      initial.visualComponent !== "none"
    ) {
      legacyVisuals.set(row, {
        visualComponent: initial.visualComponent,
        visualPropsJson: initial.visualPropsJson,
      });
    }
    row.dataset.blockId =
      initial.id?.trim() ||
      `${kind === "theory" ? "tb" : "pb"}-${rows.childElementCount + 1}-${crypto.randomUUID().slice(0, 6)}`;
    if (kind === "theory" && initial.groupId && initial.groupTitle) {
      row.dataset.groupId = initial.groupId;
      row.dataset.groupTitle = initial.groupTitle;
    }

    const details = document.createElement("details");
    details.className = "theory-block-details";
    const summary = document.createElement("summary");
    const preview = createPreviewPanel("Blockvorschau");
    preview.open = details.open;
    details.addEventListener("toggle", () => {
      preview.open = details.open;
      refreshCalculatedXp();
      if (details.open) updatePreview(preview, row);
    });
    preview.addEventListener("toggle", () => {
      if (details.open !== preview.open) details.open = preview.open;
    });

    const orderLabel = document.createElement("span");
    orderLabel.className = "theory-block-order-label";

    const controls = document.createElement("div");
    controls.className = "theory-block-controls";

    const selectLabel = document.createElement("label");
    selectLabel.className = "theory-block-select-label";
    selectLabel.title = "Theorie-Block zum Gruppieren auswählen";
    const selectCheckbox = document.createElement("input");
    selectCheckbox.type = "checkbox";
    selectCheckbox.className = "theory-block-select";
    selectCheckbox.setAttribute(
      "aria-label",
      "Theorie-Block zum Gruppieren auswählen",
    );
    selectCheckbox.addEventListener("change", updateGroupButton);
    selectLabel.append(selectCheckbox);

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
      removeBlockRow(row);
    });

    controls.append(
      selectLabel,
      upButton,
      downButton,
      createUngroupItemButton(row),
      removeButton,
    );
    summary.append(orderLabel, " ", createXpBadge());

    const titleLabel = document.createElement("label");
    titleLabel.className = "field";
    const titleCaption = document.createElement("span");
    titleCaption.textContent =
      kind === "theory" ? "Block-Titel" : "Titel der Praxisaufgabe";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "theory-block-title";
    titleInput.value = initial.title ?? "";
    titleInput.addEventListener("input", () => {
      syncRowOrder();
      refreshPreviewForRow(row);
    });
    titleLabel.append(titleCaption, titleInput);

    const markdownLabel = document.createElement("label");
    markdownLabel.className = "field";
    const markdownCaption = document.createElement("span");
    markdownCaption.textContent = kind === "theory" ? "Inhalt" : "Beschreibung";
    const markdownInput = document.createElement("textarea");
    markdownInput.className = "theory-block-markdown";
    markdownInput.rows = kind === "theory" ? 12 : 4;
    markdownInput.value = initial.markdownContent ?? "";
    markdownInput.addEventListener("input", () => refreshPreviewForRow(row));
    markdownLabel.append(markdownCaption, markdownInput);
    const xpLabel = document.createElement("label");
    xpLabel.className = "field";
    xpLabel.hidden = true;
    const xpCaption = document.createElement("span");
    xpCaption.textContent =
      kind === "theory" ? "Basis-XP (leer: Modulwert)" : "Basis-XP";
    const xpInput = document.createElement("input");
    xpInput.type = "number";
    xpInput.min = "0";
    xpInput.step = "1";
    xpInput.className = "theory-block-xp";
    xpInput.value =
      initial.baseXp === undefined
        ? kind === "practice"
          ? String(BASE_XP_DEFAULTS.practice)
          : ""
        : String(initial.baseXp);
    xpInput.addEventListener("input", refreshCalculatedXp);
    xpInput.addEventListener("invalid", () => {
      details.open = true;
    });
    xpLabel.append(xpCaption, xpInput);
    const picker = createXpTagPicker({
      name: `${kind}-tags-${row.dataset.blockId}`,
      legend: "Block-Tags",
      defaultTags: initial.tags ?? [],
      onChange: refreshCalculatedXp,
    });
    blockTags.set(row, picker);
    const content = document.createElement("div");
    content.className = "theory-block-content";
    content.append(titleLabel, markdownLabel, xpLabel, picker.element);
    if (legacyVisuals.has(row)) {
      const removeVisual = document.createElement("button");
      removeVisual.type = "button";
      removeVisual.textContent = `Bisherige Visualisierung entfernen (${initial.visualComponent})`;
      removeVisual.addEventListener("click", () => {
        legacyVisuals.delete(row);
        removeVisual.remove();
        refreshPreviewForRow(row);
      });
      content.append(removeVisual);
    }
    details.append(summary, content);
    row.append(details, controls, preview);
    installBlockRolePicker(
      row,
      kind === "theory" ? (initial.role ?? "theory") : "practice",
    );
    return row;
  }

  function appendContentRow(row: HTMLDivElement): void {
    rows.append(row);
    renderGroupHeaders();
    refreshPreviewForRow(row);
    syncRowOrder();
    refreshCalculatedXp();
  }

  function addBlock(initial: Partial<TheoryBlock> = {}): void {
    appendContentRow(createContentBlock(initial, "theory"));
  }

  function addPracticeBlock(initial: Partial<PracticeBlock> = {}): void {
    appendContentRow(createContentBlock(initial, "practice"));
  }

  groupButton.addEventListener("click", () => {
    const selected = selectedGroupRows();
    if (selected.length < 2) return;
    const firstSelectedIndex = Array.from(rows.children).indexOf(selected[0]);
    const insertionIndex = Array.from(rows.children)
      .slice(0, firstSelectedIndex)
      .filter((row) => !selected.includes(row as HTMLDivElement)).length;
    const groupId = `tg-${crypto.randomUUID()}`;
    const titles = selected.map((row) => {
      const title = row
        .querySelector<HTMLInputElement>(".theory-block-title")
        ?.value.trim();
      const exerciseTitle = row
        .querySelector<HTMLInputElement>(".module-exercise-title")
        ?.value.trim();
      const prompt = row
        .querySelector<HTMLTextAreaElement>(".module-exercise-prompt")
        ?.value.trim();
      return title || exerciseTitle || prompt || "Neuer Block";
    });
    const lastTitle = titles.pop();
    const groupTitle = `${titles.join(", ")} & ${lastTitle}`;
    for (const row of selected) {
      row.dataset.groupId = groupId;
      row.dataset.groupTitle = groupTitle;
      const checkbox = row.querySelector<HTMLInputElement>(
        ".theory-block-select",
      );
      if (checkbox) checkbox.checked = false;
    }
    for (const row of selected) row.remove();
    const anchor = rows.children[insertionIndex] ?? null;
    const insertBefore = anchor;
    for (const row of selected) {
      rows.insertBefore(row, insertBefore);
    }
    renderGroupHeaders();
    syncRowOrder();
    groupButton.setAttribute("aria-live", "polite");
    groupButton.textContent = `Gruppe „${groupTitle}“ erstellt`;
    window.setTimeout(() => {
      groupButton.textContent = "Auswahl gruppieren";
      groupButton.removeAttribute("aria-live");
    }, 2500);
  });

  addButton.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "module-block-pending";
    row.dataset.blockId = `block-${crypto.randomUUID()}`;
    installBlockRolePicker(row);
    const controls = document.createElement("div");
    controls.className = "theory-block-controls";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "checklist-remove theory-block-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Block entfernen");
    remove.addEventListener("click", () => removeBlockRow(row));
    controls.append(remove);
    row.append(controls);
    rows.append(row);
    syncRowOrder();
    row.querySelector<HTMLInputElement>(".theory-block-role")?.focus();
  });

  function items(): TheoryBlock[] | null {
    const pending = rows.querySelector<HTMLDivElement>(".module-block-pending");
    if (pending) {
      showBlockRoleError(
        pending,
        "Bitte wähle eine Blockrolle oder entferne den leeren Block.",
      );
      pending.querySelector<HTMLInputElement>(".theory-block-role")?.focus();
      return null;
    }
    const result: TheoryBlock[] = [];
    const validatedGroupTitles = new Set<string>();
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
      const xpInput = row.querySelector<HTMLInputElement>(".theory-block-xp");
      const picker = blockTags.get(row);
      if (!titleInput || !markdownInput || !xpInput || !picker) {
        throw new Error("Die Felder eines Theorie-Blocks sind unvollständig.");
      }

      const title = titleInput.value.trim();
      if (!title) {
        const details = row.querySelector<HTMLDetailsElement>(
          ".theory-block-details",
        );
        if (details) details.open = true;
        titleInput.setCustomValidity(
          "Bitte gib einen Titel für den Theorie-Block ein.",
        );
        titleInput.reportValidity();
        titleInput.setCustomValidity("");
        return null;
      }

      const drumPatternError = getTheoryDrumPatternError(markdownInput.value);
      if (drumPatternError) {
        const details = row.querySelector<HTMLDetailsElement>(
          ".theory-block-details",
        );
        if (details) details.open = true;
        markdownInput.setCustomValidity(drumPatternError);
        markdownInput.reportValidity();
        markdownInput.setCustomValidity("");
        return null;
      }

      const groupId = row.dataset.groupId;
      if (groupId && !validatedGroupTitles.has(groupId)) {
        const groupTitleInput = rowContainer(
          row,
        ).querySelector<HTMLInputElement>(".theory-group-title");
        const groupTitle = row.dataset.groupTitle?.trim() ?? "";
        if (!groupTitle || !groupTitleInput) {
          groupTitleInput?.setCustomValidity(
            "Bitte gib einen Titel für den Abschnitt ein.",
          );
          groupTitleInput?.reportValidity();
          groupTitleInput?.setCustomValidity("");
          return null;
        }
        validatedGroupTitles.add(groupId);
      }

      const baseXp = xpInput.value.trim() ? Number(xpInput.value) : undefined;
      if (baseXp !== undefined && (!Number.isFinite(baseXp) || baseXp < 0)) {
        const details = row.querySelector<HTMLDetailsElement>(
          ".theory-block-details",
        );
        if (details) details.open = true;
        xpInput.setCustomValidity("Bitte gib gültige Basis-XP ab 0 ein.");
        xpInput.reportValidity();
        xpInput.setCustomValidity("");
        return null;
      }

      result.push({
        id: row.dataset.blockId?.trim() || `tb-${index + 1}`,
        order: index + 1,
        title,
        markdownContent: markdownInput.value,
        ...(row.dataset.blockRole === "exercise_intro"
          ? { role: "exercise_intro" as const }
          : {}),
        ...(row.dataset.groupId
          ? {
              groupId: row.dataset.groupId,
              groupTitle: row.dataset.groupTitle?.trim() ?? "",
            }
          : {}),
        ...(baseXp !== undefined ? { baseXp } : {}),
        tags: picker.selectedTags(),
        ...legacyVisuals.get(row),
      });
    }

    return result;
  }

  function setItems(blocks: readonly TheoryBlock[]): void {
    for (const row of rows.querySelectorAll(".theory-block-row")) row.remove();
    expandedGroups.clear();
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    for (const block of sorted) addBlock(block);
    renderGroupHeaders();
    syncRowOrder();
  }

  function practiceItems(): PracticeBlock[] | null {
    const result: PracticeBlock[] = [];
    const rowElements = Array.from(
      rows.querySelectorAll<HTMLDivElement>(".module-practice-row"),
    );
    for (let index = 0; index < rowElements.length; index += 1) {
      const row = rowElements[index];
      const title = row.querySelector<HTMLInputElement>(".theory-block-title");
      const markdown = row.querySelector<HTMLTextAreaElement>(
        ".theory-block-markdown",
      );
      const xp = row.querySelector<HTMLInputElement>(".theory-block-xp");
      const details = row.querySelector<HTMLDetailsElement>("details");
      const picker = blockTags.get(row);
      if (!title || !markdown || !xp || !details || !picker)
        throw new Error("Die Felder einer Praxisaufgabe sind unvollständig.");
      if (!title.value.trim()) {
        details.open = true;
        title.setCustomValidity(
          "Bitte gib einen Titel für die Praxisaufgabe ein.",
        );
        title.reportValidity();
        title.setCustomValidity("");
        return null;
      }
      const baseXp = xp.value.trim()
        ? Number(xp.value)
        : BASE_XP_DEFAULTS.practice;
      if (!Number.isFinite(baseXp) || baseXp < 0) {
        details.open = true;
        xp.setCustomValidity("Bitte gib gültige Basis-XP ab 0 ein.");
        xp.reportValidity();
        xp.setCustomValidity("");
        return null;
      }
      result.push({
        id: row.dataset.blockId || `pb-${index + 1}`,
        title: title.value.trim(),
        markdownContent: markdown.value,
        baseXp,
        tags: picker.selectedTags(),
      });
    }
    return result;
  }

  function setPracticeBlocks(blocks: readonly PracticeBlock[]): void {
    for (const row of rows.querySelectorAll(".module-practice-row"))
      row.remove();
    for (const block of blocks) addPracticeBlock(block);
    renderGroupHeaders();
    syncRowOrder();
  }

  function contentOrder(): ModuleContentReference[] {
    const result: ModuleContentReference[] = [];
    for (const row of allRows()) {
      const kind = blockKind(row);
      if (!kind) continue;
      if (!row.dataset.blockId) {
        throw new Error("Ein Modulblock hat keine gültige ID.");
      }
      result.push({
        kind,
        id: row.dataset.blockId,
        ...(row.dataset.groupId
          ? {
              groupId: row.dataset.groupId,
              groupTitle: row.dataset.groupTitle?.trim() ?? "",
            }
          : {}),
      });
    }
    return result;
  }

  function createExerciseRow(
    question: ModuleQuestion,
    open = false,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "module-exercise-row";
    row.dataset.blockId = question.id;
    const details = document.createElement("details");
    details.className = "theory-block-details";
    details.open = open;
    const summary = document.createElement("summary");
    const preview = createPreviewPanel("Blockvorschau");
    preview.open = details.open;
    details.addEventListener("toggle", () => {
      preview.open = details.open;
      updateXp();
      if (details.open) updatePreview(preview, row);
    });
    preview.addEventListener("toggle", () => {
      if (details.open !== preview.open) details.open = preview.open;
    });
    const label = document.createElement("span");
    label.className = "theory-block-order-label";
    const badge = createXpBadge();
    summary.append(label, " ", badge);
    const editor = document.createElement("div");
    editor.className = "module-exercise-editor";
    editor.addEventListener("input", () => refreshPreviewForRow(row));
    editor.addEventListener("change", () => refreshPreviewForRow(row));
    editor.addEventListener("click", () => refreshPreviewForRow(row));
    const title = document.createElement("input");
    title.type = "text";
    title.className = "module-exercise-title";
    title.value = question.title ?? "";
    title.addEventListener("input", syncRowOrder);
    editor.append(createLabeledField("Aufgabentitel", title));
    const prompt = document.createElement("textarea");
    prompt.className = "module-exercise-prompt";
    prompt.rows = 3;
    prompt.maxLength = 4000;
    prompt.value = question.prompt;
    prompt.setAttribute("aria-label", "Aufgabenstellung");
    prompt.addEventListener("input", syncRowOrder);
    editor.append(createLabeledField("Aufgabenstellung", prompt));

    const typeEditor = createQuestionTypeEditor(`inline-${question.id}-`);
    typeEditor.load(question);
    editor.append(typeEditor.element);

    const addFeedbackField = (label: string, value = "") => {
      const field = document.createElement("textarea");
      field.rows = 3;
      field.maxLength = 4000;
      field.value = value;
      field.setAttribute("aria-label", label);
      editor.append(createLabeledField(label, field));
      return field;
    };
    const simpleHint = addFeedbackField(
      "Einfacher Hinweis nach dem zweiten Fehlversuch (optional)",
      question.simpleHint,
    );
    const strongHint = addFeedbackField(
      "Stärkerer Hinweis zum Aufklappen vor dem letzten Versuch (optional)",
      question.strongHint,
    );
    const explanation = addFeedbackField(
      "Erklärung nach drei Fehlversuchen",
      question.explanation,
    );

    const baseXp = document.createElement("input");
    baseXp.type = "number";
    baseXp.min = "0";
    baseXp.step = "1";
    baseXp.value = String(QUESTION_BASE_XP);
    baseXp.setAttribute("aria-label", "Basis-XP");
    const baseXpField = createLabeledField("Basis-XP", baseXp);
    baseXpField.hidden = true;
    editor.append(baseXpField);

    const difficulty = createQuestionDifficultyPicker(
      `exercise-difficulty-${question.id}`,
      question.difficulty ?? "einfach",
      updateXp,
    );
    editor.prepend(difficulty.element);
    const tagPicker = createXpTagPicker({
      name: `exercise-tags-${question.id}`,
      legend: "Themen-Tags",
      defaultTags: question.tags,
      onChange: updateXp,
    });
    blockTags.set(row, tagPicker);
    function updateXp(): void {
      const xp = calculateModuleQuestionXp({
        difficulty: difficulty.value(),
        tags: tagPicker.selectedTags(),
      });
      xpByRow.set(row, xp);
      updateBuilderXpBadge(badge, xp, "exercise");
      const group = row.closest<HTMLElement>(".theory-block-group");
      if (group) refreshGroupXp(group);
    }
    refreshExerciseXp.set(row, updateXp);
    updateXp();
    editor.append(tagPicker.element);

    function readExercise(): ModuleQuestion {
      const typeFields = typeEditor.read();
      if (
        question.questionType === "numeric_input" &&
        typeFields.questionType === "numeric_input" &&
        typeFields.correctAnswers[0] === question.correctAnswers[0]?.trim()
      ) {
        typeFields.correctAnswers = question.correctAnswers;
      }
      return {
        id: question.id,
        moduleIds: question.moduleIds,
        targetLane: "leicht",
        difficulty: difficulty.value(),
        ...typeFields,
        title: title.value.trim(),
        prompt: prompt.value.trim(),
        simpleHint: simpleHint.value.trim(),
        strongHint: strongHint.value.trim(),
        explanation: explanation.value.trim(),
        baseXp: QUESTION_BASE_XP,
        tags: tagPicker.selectedTags(),
      };
    }
    const initialExercise = JSON.stringify(readExercise());
    readExerciseUpdate.set(row, () => {
      try {
        const update = readExercise();
        if (
          !draftExerciseIds.has(question.id) &&
          JSON.stringify(update) === initialExercise
        ) {
          return null;
        }
        const validation = validateQuestionInput(
          update,
          question.moduleIds.map((id) => ({ id })),
        );
        if (!validation.valid) throw new Error(validation.errors.join(" "));
        return update;
      } catch (error) {
        const groupDetails = row
          .closest(".theory-block-group")
          ?.querySelector<HTMLDetailsElement>(".theory-group-details");
        if (groupDetails) groupDetails.open = true;
        details.open = true;
        const message =
          error instanceof Error ? error.message : "Ungültige Aufgabendaten.";
        throw new Error(
          `${formatExerciseTitle(title.value, prompt.value)} – ${message}`,
          { cause: error },
        );
      }
    });
    details.append(summary, editor);
    const controls = document.createElement("div");
    controls.className = "theory-block-controls";
    const selectLabel = document.createElement("label");
    selectLabel.className = "theory-block-select-label";
    selectLabel.title = "Übung zum Gruppieren auswählen";
    const selectCheckbox = document.createElement("input");
    selectCheckbox.type = "checkbox";
    selectCheckbox.className = "theory-block-select";
    selectCheckbox.setAttribute("aria-label", "Übung zum Gruppieren auswählen");
    selectCheckbox.addEventListener("change", updateGroupButton);
    selectLabel.append(selectCheckbox);
    controls.append(selectLabel);
    for (const [direction, name, symbol] of [
      [-1, "oben", "↑"],
      [1, "unten", "↓"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        direction === -1 ? "theory-block-up" : "theory-block-down";
      button.textContent = symbol;
      button.setAttribute("aria-label", `Übung nach ${name} verschieben`);
      button.addEventListener("click", () => moveRow(row, direction));
      controls.append(button);
    }
    controls.append(createUngroupItemButton(row));
    if (deleteExercise) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "checklist-remove module-exercise-remove";
      button.textContent = "×";
      button.title = "Übung löschen";
      button.setAttribute("aria-label", "Übung löschen");
      button.addEventListener("click", () => removeBlockRow(row));
      controls.append(button);
    }
    row.append(details, controls, preview);
    installBlockRolePicker(row, "exercise").exercise = question;
    return row;
  }

  function setExercises(
    questions: readonly ModuleQuestion[],
    order: readonly ModuleContentReference[] = contentOrder(),
  ): void {
    const pendingRows = allRows().flatMap((row, index) =>
      blockKind(row) ? [] : [{ row, index }],
    );
    const previousQuestions = new Map(
      exerciseQuestions.map((question) => [question.id, question]),
    );
    const previousRows = new Map<string, HTMLDivElement>();
    for (const row of rows.querySelectorAll<HTMLDivElement>(
      ".module-exercise-row",
    )) {
      if (row.dataset.blockId) previousRows.set(row.dataset.blockId, row);
      row.remove();
    }
    exerciseQuestions = questions.filter(
      (question) => !inactiveExerciseIds.has(question.id),
    );
    for (const question of exerciseQuestions) {
      const previous = previousRows.get(question.id);
      const reuse = previous && previousQuestions.get(question.id) === question;
      const row = reuse
        ? previous
        : createExerciseRow(
            question,
            previous?.querySelector("details")?.open ??
              draftExerciseIds.has(question.id),
          );
      const state = (previous && roleDrafts.get(previous)) ?? roleDrafts.get(row);
      if (!state) throw new Error("Der Blockentwurf der Aufgabe fehlt.");
      roleDrafts.set(row, state);
      state.templates.exercise = row;
      state.exercise = question;
      if (!draftExerciseIds.has(question.id)) state.savedExercise = question;
      const savedReference = order.find(
        (entry) => entry.kind === "exercise" && entry.id === question.id,
      );
      if (savedReference?.groupId && savedReference.groupTitle) {
        row.dataset.groupId = savedReference.groupId;
        row.dataset.groupTitle = savedReference.groupTitle;
      } else {
        delete row.dataset.groupId;
        delete row.dataset.groupTitle;
      }
      rows.append(row);
      refreshPreviewForRow(row);
    }

    const available = new Map(
      allRows().map((row) => {
        const kind = blockKind(row) ?? "pending";
        return [`${kind}:${row.dataset.blockId}`, row] as const;
      }),
    );
    for (const entry of order) {
      const row = available.get(`${entry.kind}:${entry.id}`);
      if (row) {
        rows.append(row);
        available.delete(`${entry.kind}:${entry.id}`);
      }
    }
    for (const row of available.values()) rows.append(row);
    for (const { row, index } of pendingRows) {
      const siblings = allRows().filter((candidate) => candidate !== row);
      rows.insertBefore(row, siblings[index] ?? null);
    }
    renderGroupHeaders();
    syncRowOrder();
  }

  function removeExercise(id: string): void {
    exerciseQuestions = exerciseQuestions.filter(
      (question) => question.id !== id,
    );
    draftExerciseIds.delete(id);
    inactiveExerciseIds.delete(id);
    for (const row of allRows()) {
      if (row.dataset.blockId === id && roleDrafts.get(row)?.exercise) {
        row.remove();
      }
    }
    renderGroupHeaders();
    syncRowOrder();
  }

  function clear(): void {
    expandedGroups.clear();
    rows.replaceChildren();
    exerciseQuestions = [];
    draftExerciseIds.clear();
    inactiveExerciseIds.clear();
    updateGroupButton();
    syncRowOrder();
  }

  function setDisabled(disabled: boolean): void {
    fieldset.disabled = disabled;
  }

  if (initialBlocks.length > 0) setItems(initialBlocks);

  fieldset.append(legend, groupButton, rows, addButton);

  return {
    element: fieldset,
    addBlock,
    addPracticeBlock,
    items,
    practiceItems,
    setItems,
    setPracticeBlocks,
    setExercises,
    removeExercise,
    addExercise(question) {
      draftExerciseIds.add(question.id);
      setExercises([...exerciseQuestions, question], contentOrder());
    },
    exerciseUpdates() {
      const updates: ModuleQuestion[] = [];
      for (const row of rows.querySelectorAll<HTMLDivElement>(
        ".module-exercise-row",
      )) {
        const update = readExerciseUpdate.get(row)?.();
        if (update) updates.push(update);
      }
      return updates;
    },
    exerciseRoleChanges() {
      const changes: ModuleExerciseRoleChange[] = [];
      for (const row of allRows()) {
        const exercise = roleDrafts.get(row)?.savedExercise;
        const kind = blockKind(row);
        if (exercise && (kind === "theory" || kind === "practice")) {
          changes.push({ id: exercise.id, kind });
        }
      }
      return changes;
    },
    markRoleChangesSaved() {
      for (const row of allRows()) {
        const state = roleDrafts.get(row);
        if (state && blockKind(row) !== "exercise") {
          state.savedExercise = undefined;
          if (state.exercise) draftExerciseIds.delete(state.exercise.id);
        }
      }
    },
    markExercisesSaved(exercises) {
      for (const exercise of exercises) draftExerciseIds.delete(exercise.id);
    },
    isDraftExercise(id) {
      return draftExerciseIds.has(id);
    },
    draftExercises() {
      return exerciseQuestions.filter((question) =>
        draftExerciseIds.has(question.id),
      );
    },
    setCreateExerciseHandler(handler) {
      createExerciseHandler = handler;
    },
    contentOrder,
    clear,
    setDisabled,
    refreshCalculatedXp,
  };
}

export interface ModuleBuilderFormController {
  loadModule(mod: LearningModule, questions?: readonly ModuleQuestion[]): void;
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
  const generalInfo = requireElement<HTMLDetailsElement>(
    form,
    "#module-general-info",
    msg,
  );
  generalInfo.addEventListener(
    "invalid",
    () => {
      generalInfo.open = true;
    },
    true,
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
  const archivedInput = requireElement<HTMLInputElement>(
    form,
    "#module-archived",
    msg,
  );
  const tagsContainer = requireElement<HTMLDivElement>(
    form,
    "#module-tags-field",
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

  const theoryBlockEditor = createTheoryBlockEditor(
    [],
    () => Number(theoryBaseXpInput.value),
    (question) => void deleteExercise(question),
  );
  theoryBaseXpInput.addEventListener(
    "input",
    theoryBlockEditor.refreshCalculatedXp,
  );
  theoryBlockEditor.setCreateExerciseHandler(() => {
    const moduleId =
      editingModuleId ?? newModuleId ?? `mod-${crypto.randomUUID()}`;
    if (!editingModuleId) newModuleId = moduleId;
    const question: ModuleQuestion = {
      id: `q-${crypto.randomUUID().slice(0, 8)}`,
      moduleIds: [moduleId],
      targetLane: "leicht",
      questionType: "single_choice",
      prompt: "Neue Lernpfad-Aufgabe",
      options: ["Antwort A", "Antwort B"],
      correctAnswers: ["Antwort A"],
      explanation: "",
      baseXp: BASE_XP_DEFAULTS.leicht,
      tags: [],
    };
    return question;
  });
  blocksContainer.append(theoryBlockEditor.element);

  function setModuleExercises(
    moduleId: string,
    questions: readonly ModuleQuestion[],
    order?: readonly ModuleContentReference[],
  ): void {
    theoryBlockEditor.setExercises(
      [...questions, ...theoryBlockEditor.draftExercises()].filter(
        (question) =>
          isQuestionInModule(question, moduleId) &&
          question.targetLane === "leicht",
      ),
      order,
    );
  }

  let editingModuleId: string | null = null;
  let newModuleId: string | null = null;
  let exerciseRefreshVersion = 0;
  const isDetailPage = form.dataset.moduleDetail === "true";

  function setBusy(busy: boolean): void {
    const controls = [
      titleInput,
      descriptionInput,
      scopeSelect,
      levelSelect,
      dStageSelect,
      archivedInput,
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
    exerciseRefreshVersion += 1;
    newModuleId = null;
    form.reset();
    if (theoryBaseXpInput) {
      theoryBaseXpInput.value = String(BASE_XP_DEFAULTS.theoryBlock);
    }
    tagPicker.clear();
    theoryBlockEditor.clear();
    generalInfo.open = false;
    if (submitButton) submitButton.textContent = "Modul speichern";
    if (cancelButton) cancelButton.hidden = true;
  }

  async function deleteExercise(question: ModuleQuestion): Promise<void> {
    if (
      !window.confirm(
        `Lernpfad-Aufgabe „${question.prompt}“ endgültig löschen?`,
      )
    )
      return;
    if (theoryBlockEditor.isDraftExercise(question.id)) {
      theoryBlockEditor.removeExercise(question.id);
      status.textContent = "Lernpfad-Aufgabe entfernt.";
      return;
    }
    setBusy(true);
    status.textContent = "Übung wird gelöscht …";
    try {
      await sendModulesRequest(
        "DELETE",
        { entity: "question", id: question.id },
        "Die Übung konnte nicht gelöscht werden.",
      );
      theoryBlockEditor.removeExercise(question.id);
      status.textContent = "Übung wurde gelöscht.";
      document.dispatchEvent(
        new CustomEvent("modules:updated", { bubbles: true }),
      );
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Die Übung konnte nicht gelöscht werden.";
    } finally {
      setBusy(false);
    }
  }

  function loadModule(
    mod: LearningModule,
    questions: readonly ModuleQuestion[] = [],
  ): void {
    editingModuleId = mod.id;
    generalInfo.open = false;
    exerciseRefreshVersion += 1;
    newModuleId = null;
    titleInput.value = mod.title;
    descriptionInput.value = mod.description;
    scopeSelect.value = mod.scope;
    levelSelect.value = String(mod.level);
    dStageSelect.value = mod.dStage ?? "";
    archivedInput.checked = mod.archived === true;
    theoryBaseXpInput.value = String(mod.theoryBaseXp);
    tagPicker.setSelectedTags(mod.tags);
    theoryBlockEditor.clear();
    theoryBlockEditor.setItems(mod.theoryBlocks);
    theoryBlockEditor.setPracticeBlocks(mod.practiceBlocks);
    setModuleExercises(mod.id, questions, mod.contentOrder);
    submitButton.textContent = "Modul-Änderungen speichern";
    cancelButton.hidden = false;
    if (isDetailPage) cancelButton.textContent = "Zurück zur Übersicht";
    status.textContent = `Bearbeitungsmodus: „${mod.title}“ geladen.`;
    if (!isDetailPage)
      generalInfo.querySelector<HTMLElement>("summary")?.focus();
  }

  document.addEventListener("module:question-edit", (event) => {
    if (!(event instanceof CustomEvent) || !isRecord(event.detail)) return;
    const candidate = event.detail.question;
    if (!isRecord(candidate) || typeof candidate.id !== "string") return;
    const question = candidate as unknown as ModuleQuestion;
    const moduleId = question.moduleIds[0];
    if (!moduleId) return;
    void fetchModulesDatabase()
      .then((db) => {
        const mod = db.modules.find((item) => item.id === moduleId);
        if (!mod) return;
        loadModule(mod, db.questions);
        const row = form.querySelector<HTMLElement>(
          `.module-exercise-row[data-block-id="${CSS.escape(question.id)}"]`,
        );
        row
          ?.querySelector<HTMLDetailsElement>("details")
          ?.setAttribute("open", "");
      })
      .catch(() => {
        status.textContent =
          "Die Lernpfad-Aufgabe konnte nicht geladen werden.";
      });
  });

  cancelButton.addEventListener("click", () => {
    if (isDetailPage) {
      window.location.assign("/projektierung/modul-builder/");
      return;
    }
    resetForm();
    status.textContent = "Bearbeitung abgebrochen.";
  });

  document.addEventListener("modules:updated", (event) => {
    const moduleId = editingModuleId;
    if (!moduleId) return;
    const version = ++exerciseRefreshVersion;
    if (
      event instanceof CustomEvent &&
      isRecord(event.detail) &&
      Array.isArray(event.detail.questions)
    ) {
      setModuleExercises(moduleId, event.detail.questions as ModuleQuestion[]);
    } else {
      void fetchModulesDatabase()
        .then((db) => {
          if (
            editingModuleId === moduleId &&
            exerciseRefreshVersion === version
          ) {
            setModuleExercises(moduleId, db.questions);
          }
        })
        .catch((error: unknown) => {
          if (
            editingModuleId === moduleId &&
            exerciseRefreshVersion === version
          ) {
            status.textContent =
              error instanceof Error
                ? `Übungen konnten nicht aktualisiert werden: ${error.message}`
                : "Übungen konnten nicht aktualisiert werden.";
          }
        });
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const theoryBlocks = theoryBlockEditor.items();
    if (!theoryBlocks) return;
    const practiceBlocks = theoryBlockEditor.practiceItems();
    if (!practiceBlocks) return;

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
      archived: archivedInput.checked,
      tags: tagPicker.selectedTags(),
      theoryBaseXp: Number(theoryBaseXpInput.value),
      theoryBlocks,
      practiceBlocks,
      contentOrder: theoryBlockEditor.contentOrder(),
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
      const exercises = theoryBlockEditor.exerciseUpdates();
      const exerciseRoleChanges = theoryBlockEditor.exerciseRoleChanges();
      exerciseRefreshVersion += 1;
      const result = await sendModulesRequest(
        isUpdate ? "PUT" : "POST",
        {
          ...payload,
          ...(exercises.length > 0 ? { exercises } : {}),
          ...(exerciseRoleChanges.length > 0 ? { exerciseRoleChanges } : {}),
        },
        "Das Modul konnte nicht gespeichert werden.",
      );
      if (
        (exercises.length > 0 || exerciseRoleChanges.length > 0) &&
        (!isRecord(result) || !Array.isArray(result.questions))
      ) {
        throw new Error(
          "Das Speichern der Lernpfad-Aufgaben wurde vom Server nicht bestätigt.",
        );
      }
      editingModuleId = moduleId;
      newModuleId = null;
      theoryBlockEditor.markExercisesSaved(exercises);
      theoryBlockEditor.markRoleChangesSaved();
      submitButton.textContent = "Modul-Änderungen speichern";
      cancelButton.hidden = false;

      if (!isDetailPage) resetForm();
      status.textContent = isUpdate
        ? "Modul wurde aktualisiert."
        : "Modul wurde gespeichert.";
      document.dispatchEvent(
        new CustomEvent("modules:updated", { bubbles: true, detail: result }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Das Modul konnte wegen eines unerwarteten Fehlers nicht gespeichert werden.";
      status.textContent = message;
    } finally {
      setBusy(false);
    }
  });

  if (isDetailPage) {
    const id = new URLSearchParams(window.location.search).get("id")?.trim();
    setBusy(true);
    if (!id) {
      status.textContent = "Keine Modul-ID angegeben.";
    } else {
      status.textContent = "Modul wird geladen …";
      void fetchModulesDatabase()
        .then((db) => {
          const mod = db.modules.find((item) => item.id === id);
          if (!mod) throw new Error("Das Modul wurde nicht gefunden.");
          loadModule(mod, db.questions);
          setBusy(false);
        })
        .catch((error: unknown) => {
          status.textContent =
            error instanceof Error
              ? error.message
              : "Das Modul konnte nicht geladen werden.";
        });
    }
  }

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

let nextQuestionEditorId = 0;

function createQuestionTypeEditor(prefix = "") {
  const element = document.createElement("fieldset");
  element.className = "question-type-editor";
  const radioName = `exerciseChoiceCorrect-${++nextQuestionEditorId}`;

  function identify<T extends HTMLElement>(control: T, id: string): T {
    control.id = `${prefix}${id}`;
    return control;
  }

  function select(id: string, values: readonly (readonly [string, string])[]) {
    const control = identify(document.createElement("select"), id);
    for (const [value, text] of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      control.append(option);
    }
    return control;
  }

  function input(id: string, type = "text") {
    const control = identify(document.createElement("input"), id);
    control.type = type;
    return control;
  }

  function section(id: string, heading: string) {
    const control = identify(document.createElement("section"), id);
    control.className = "exercise-dynamic-section";
    control.setAttribute("aria-label", heading);
    return control;
  }

  const type = select(
    "exercise-question-type",
    QUESTION_TYPES.map(
      (value) => [value, QUESTION_TYPE_LABELS[value]] as const,
    ),
  );
  const choices = section(
    "exercise-choice-section",
    "Antwortoptionen und Lösungen",
  );
  const rows = identify(document.createElement("div"), "exercise-choice-rows");
  rows.className = "exercise-choice-rows";
  const add = identify(document.createElement("button"), "exercise-choice-add");
  add.type = "button";
  add.textContent = "+ Antwortoption";
  choices.append(rows, add);

  const numeric = section("exercise-numeric-section", "Exakte Lösung");
  const answer = input("exercise-numeric-answer");
  numeric.append(createLabeledField("Erwartete Antwort", answer));

  const notation = section(
    "exercise-notation-section",
    "Interaktive Notationsaufgabe",
  );
  const clef = select("notation-clef", [
    ["treble", "Violinschlüssel"],
    ["bass", "Bassschlüssel"],
  ]);
  const time = input("notation-time-signature");
  const maxNotes = input("notation-max-notes", "number");
  maxNotes.min = "1";
  maxNotes.max = "8";
  maxNotes.step = "1";
  const lock = select("notation-lock-duration", [
    ["none", "Keine Sperre"],
    ["default", "Standard-Notenwert"],
    ...NOTATION_DURATIONS.map(
      (duration) => [duration, durationLabels[duration]] as const,
    ),
  ]);
  const compact = select("notation-compact", [
    ["tight", "Kompakt"],
    ["wide", "Standard"],
    ["false", "Breit"],
  ]);
  const picker = input("notation-show-duration-picker", "checkbox");
  const hints = input("notation-show-hints", "checkbox");
  const pitches = input("notation-expected-pitches");
  const durations = input("notation-expected-durations");
  const grid = document.createElement("div");
  grid.className = "module-field-grid";
  grid.append(
    createLabeledField("Notenschlüssel", clef),
    createLabeledField("Taktart (optional)", time),
    createLabeledField("Notenanzahl", maxNotes),
    createLabeledField("Notenwert sperren", lock),
    createLabeledField("Darstellung", compact),
  );
  const toggles = document.createElement("div");
  toggles.className = "module-field-grid";
  for (const [control, text] of [
    [picker, "Notenwert-Leiste anzeigen"],
    [hints, "Tastatur-Hinweise anzeigen"],
  ] as const) {
    const label = createLabeledField(text, control);
    label.className = "module-checkbox-label";
    label.prepend(control);
    toggles.append(label);
  }
  const previewWrapper = document.createElement("div");
  previewWrapper.className = "notation-live-preview-wrapper";
  const previewLabel = document.createElement("span");
  previewLabel.textContent = "Live-Vorschau";
  const preview = identify(
    document.createElement("div"),
    "notation-live-preview",
  );
  preview.className = "notation-live-preview-box";
  previewWrapper.append(previewLabel, preview);
  notation.append(
    grid,
    toggles,
    createLabeledField("Erwartete Tonhöhen (kommagetrennt)", pitches),
    createLabeledField("Erwartete Notenwerte (kommagetrennt)", durations),
    previewWrapper,
  );
  element.append(
    createLabeledField("Aufgabentyp", type),
    choices,
    numeric,
    notation,
  );

  let accidentals: NotationBuilderTaskConfig["accidentals"];
  const csv = (text: string) =>
    text
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  function addChoice(text = "", checked = false) {
    const row = document.createElement("div");
    row.className = "exercise-choice-row";
    const correct = document.createElement("input");
    correct.className = "exercise-choice-correct";
    correct.type = type.value === "multi_select" ? "checkbox" : "radio";
    correct.name = radioName;
    correct.checked = checked;
    correct.setAttribute("aria-label", "Als richtige Lösung markieren");
    const value = document.createElement("input");
    value.type = "text";
    value.className = "exercise-choice-text";
    value.setAttribute("aria-label", "Antwortoption");
    value.value = text;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "checklist-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Antwortoption entfernen");
    remove.addEventListener("click", () => row.remove());
    row.append(correct, value, remove);
    rows.append(row);
    return value;
  }

  function readTimeSignature(): NotationBuilderTaskConfig["timeSignature"] {
    const match = /^([1-9]\d*)\s*\/\s*([1-9]\d*)$/.exec(time.value.trim());
    if (!match) return undefined;
    const [numerator, denominator] = [Number(match[1]), Number(match[2])];
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator))
      return undefined;
    return { numerator, denominator };
  }

  function readNotation(): NotationBuilderTaskConfig {
    const timeSignature = readTimeSignature();
    const lockDuration =
      lock.value === "default" ? true : parseNotationDuration(lock.value);
    const noteCount = Number(maxNotes.value);
    return {
      clef: clef.value === "bass" ? "bass" : "treble",
      ...(timeSignature ? { timeSignature } : {}),
      ...(accidentals ? { accidentals } : {}),
      maxNotes: Math.max(1, Math.min(8, Math.round(noteCount || 1))),
      ...(lockDuration !== undefined ? { lockDuration } : {}),
      compact:
        compact.value === "tight" || compact.value === "wide"
          ? compact.value
          : false,
      showDurationPicker: picker.checked,
      showHints: hints.checked,
      expectedPitches: csv(pitches.value),
      expectedDurations: csv(durations.value),
    };
  }

  function refreshNotationPreview(): void {
    if (notation.hidden) return;
    const { expectedPitches, expectedDurations, showHints, ...config } =
      readNotation();
    const signature = JSON.stringify({ config, showHints });
    if (preview.dataset.previewSignature === signature) return;
    preview.replaceChildren(
      buildLivePreviewElement(config, showHints ?? false),
    );
    preview.dataset.previewSignature = signature;
  }

  function syncSections(): void {
    const multi = type.value === "multi_select";
    choices.hidden = !multi && type.value !== "single_choice";
    numeric.hidden = type.value !== "numeric_input";
    notation.hidden = type.value !== "interactive_notation";
    maxNotes.disabled = notation.hidden;
    if (!choices.hidden) {
      let foundCorrect = false;
      for (const correct of rows.querySelectorAll<HTMLInputElement>(
        ".exercise-choice-correct",
      )) {
        if (!multi && correct.checked && foundCorrect) correct.checked = false;
        if (correct.checked) foundCorrect = true;
        correct.type = multi ? "checkbox" : "radio";
      }
      if (rows.childElementCount === 0) {
        addChoice("", true);
        addChoice();
      }
    }
    refreshNotationPreview();
  }

  function load(question?: ModuleQuestion): void {
    type.value = question?.questionType ?? "single_choice";
    rows.replaceChildren();
    for (const option of question?.options ?? []) {
      addChoice(option, question?.correctAnswers.includes(option));
    }
    answer.value =
      question?.questionType === "numeric_input"
        ? (question.correctAnswers[0] ?? "")
        : "";
    const task = question?.notationTask;
    accidentals = task?.accidentals;
    clef.value = task?.clef ?? "treble";
    time.value = task?.timeSignature
      ? `${task.timeSignature.numerator}/${task.timeSignature.denominator}`
      : "";
    maxNotes.value = String(task?.maxNotes ?? 1);
    lock.value =
      task?.lockDuration === true ? "default" : task?.lockDuration || "none";
    compact.value =
      task?.compact === true
        ? "tight"
        : String(task ? (task.compact ?? false) : "wide");
    picker.checked = task?.showDurationPicker ?? false;
    hints.checked = task?.showHints ?? !task;
    pitches.value = (task?.expectedPitches ?? []).join(", ");
    durations.value = (task?.expectedDurations ?? []).join(", ");
    delete preview.dataset.previewSignature;
    syncSections();
  }

  function read(): Pick<
    ModuleQuestion,
    "questionType" | "options" | "correctAnswers" | "notationTask"
  > {
    const questionType = isQuestionType(type.value)
      ? type.value
      : "single_choice";
    const options: string[] = [];
    const correctAnswers: string[] = [];
    if (questionType === "single_choice" || questionType === "multi_select") {
      for (const row of rows.querySelectorAll(".exercise-choice-row")) {
        const value = row
          .querySelector<HTMLInputElement>(".exercise-choice-text")
          ?.value.trim();
        if (!value) continue;
        options.push(value);
        if (
          row.querySelector<HTMLInputElement>(".exercise-choice-correct")
            ?.checked
        )
          correctAnswers.push(value);
      }
    } else if (questionType === "numeric_input" && answer.value.trim()) {
      correctAnswers.push(answer.value.trim());
    } else if (questionType === "interactive_notation") {
      const notationTask = readNotation();
      if (time.value.trim() && !notationTask.timeSignature) {
        throw new Error(
          "Bitte gib die Taktart als zwei positive ganze Zahlen ein, z. B. 4/4.",
        );
      }
      const invalidDurations = notationTask.expectedDurations?.filter(
        (duration) => parseNotationDuration(duration) === undefined,
      );
      if (invalidDurations?.length) {
        throw new Error(
          `Ungültige Notenwerte: ${invalidDurations.join(", ")}.`,
        );
      }
      return { questionType, options, correctAnswers, notationTask };
    }
    return { questionType, options, correctAnswers };
  }

  add.addEventListener("click", () => addChoice().focus());
  type.addEventListener("change", syncSections);
  notation.addEventListener("input", refreshNotationPreview);
  notation.addEventListener("change", refreshNotationPreview);
  load();
  return { element, load, read, refreshNotationPreview };
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
  const moduleList = requireElement<HTMLFieldSetElement>(
    form,
    "#exercise-module-ids",
    msg,
  );
  const moduleOptions = requireElement<HTMLDivElement>(
    moduleList,
    ".exercise-module-options",
    msg,
  );
  const laneSelect = requireElement<HTMLSelectElement>(
    form,
    "#exercise-target-lane",
    msg,
  );
  const typeFieldsHost = requireElement<HTMLElement>(
    form,
    "#exercise-type-fields",
    msg,
  );
  const typeEditor = createQuestionTypeEditor();
  typeFieldsHost.append(typeEditor.element);
  const promptInput = requireElement<HTMLTextAreaElement>(
    form,
    "#exercise-prompt",
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
  const difficulty = createQuestionDifficultyPicker(
    "exercise-difficulty",
    "einfach",
    refreshCalculatedXp,
  );
  typeFieldsHost.before(difficulty.element);

  const tagPicker = createXpTagPicker({
    name: "exerciseTags",
    legend: "Tags & XP-Faktor",
    onChange: () => {
      refreshCalculatedXp();
    },
  });
  tagsContainer.append(tagPicker.element);

  function refreshCalculatedXp(): number {
    const tags = tagPicker.selectedTags();
    const totalXp = calculateModuleQuestionXp({
      difficulty: difficulty.value(),
      tags,
    });
    calculatedXpOutput.textContent = `${totalXp} XP`;
    calculatedXpDetail.textContent = `Basis ${QUESTION_BASE_XP} XP · Schwierigkeit ${QUESTION_DIFFICULTY_MULTIPLIERS[difficulty.value()]}x`;
    return totalXp;
  }

  function setModules(modules: readonly LearningModule[]): void {
    availableModules = [...modules].sort((a, b) => a.order - b.order);
    const selected = new Set(
      Array.from(
        moduleOptions.querySelectorAll<HTMLInputElement>(
          "input[type=checkbox]:checked",
        ),
        (input) => input.value,
      ),
    );
    moduleOptions.replaceChildren();
    if (availableModules.length === 0) {
      moduleOptions.textContent = "Noch keine Module vorhanden.";
      return;
    }
    for (const mod of availableModules) {
      const label = document.createElement("label");
      label.className = "module-checkbox-label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "moduleIds";
      checkbox.value = mod.id;
      checkbox.checked = selected.has(mod.id);
      const text = document.createElement("span");
      text.textContent = `${mod.order}: ${mod.title}`;
      label.append(checkbox, text);
      moduleOptions.append(label);
    }
  }

  function setBusy(busy: boolean): void {
    const controls = [
      moduleList,
      laneSelect,
      difficulty.element,
      typeEditor.element,
      promptInput,
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
    form.reset();
    laneSelect.value = "mittel";
    typeEditor.load();
    baseXpInput.value = String(QUESTION_BASE_XP);
    difficulty.setValue("einfach");
    tagPicker.clear();
    submitButton.textContent = "Aufgabe speichern";
    cancelButton.hidden = true;
    refreshCalculatedXp();
  }

  function loadQuestion(question: ModuleQuestion): void {
    editingQuestionId = question.id;
    const selected = new Set(question.moduleIds);
    for (const checkbox of moduleOptions.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    )) {
      checkbox.checked = selected.has(checkbox.value);
    }
    laneSelect.value = question.targetLane;
    typeEditor.load(question);
    promptInput.value = question.prompt;
    explanationInput.value = question.explanation;
    baseXpInput.value = String(QUESTION_BASE_XP);
    difficulty.setValue(question.difficulty ?? "einfach");
    tagPicker.setSelectedTags(question.tags);

    submitButton.textContent = "Aufgaben-Änderungen speichern";
    cancelButton.hidden = false;
    refreshCalculatedXp();
    status.textContent = `Bearbeitungsmodus: Aufgabe „${question.prompt.slice(0, 48)}“ geladen.`;
    promptInput.focus();
  }

  laneSelect.addEventListener("change", () => {
    refreshCalculatedXp();
  });

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
        const question = candidate as unknown as ModuleQuestion;
        if (question.targetLane === "leicht") {
          document.dispatchEvent(
            new CustomEvent("module:question-edit", { detail: { question } }),
          );
          switchStarlightTab(1);
          return;
        }
        loadQuestion(question);
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
      : "mittel";
    let typeFields: ReturnType<typeof typeEditor.read>;
    try {
      typeFields = typeEditor.read();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error);
      return;
    }

    const questionId =
      editingQuestionId ?? `q-${crypto.randomUUID().slice(0, 8)}`;
    const payload: UpsertQuestionInput & { entity: "question" } = {
      entity: "question",
      id: questionId,
      moduleIds: Array.from(
        moduleOptions.querySelectorAll<HTMLInputElement>(
          "input[type=checkbox]:checked",
        ),
        (input) => input.value,
      ),
      targetLane,
      difficulty: difficulty.value(),
      ...typeFields,
      prompt: promptInput.value.trim(),
      explanation: explanationInput.value.trim(),
      baseXp: QUESTION_BASE_XP,
      tags: tagPicker.selectedTags(),
    };

    const validationList = availableModules;
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

  refreshCalculatedXp();
  void loadAvailableModules();

  return {
    setModules,
    loadQuestion,
    resetForm,
    refreshCalculatedXp,
    refreshNotationPreview: typeEditor.refreshNotationPreview,
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
  const listIcon = requireElement<SVGElement>(viewToggle, ".list-icon", msg);
  const cardsIcon = requireElement<SVGElement>(viewToggle, ".cards-icon", msg);

  const statusEl = status;
  const poolList = requireElement<HTMLUListElement>(
    section,
    "#module-question-pool-list",
    msg,
  );
  const poolEmpty = requireElement<HTMLElement>(
    section,
    "#module-question-pool-empty",
    msg,
  );
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

  function applyViewMode(isListView: boolean): void {
    list.dataset.view = isListView ? "list" : "cards";
    const label = isListView
      ? "Kartenansicht anzeigen"
      : "Listenansicht anzeigen";
    viewToggle.setAttribute("aria-label", label);
    viewToggle.title = label;
    listIcon.style.display = isListView ? "none" : "";
    cardsIcon.style.display = isListView ? "" : "none";
  }

  applyViewMode(list.dataset.view !== "cards");

  viewToggle.addEventListener("click", () => {
    applyViewMode(list.dataset.view !== "list");
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
    summary.textContent = `Aufgaben (${questions.length})`;

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
    allOpt.textContent = "Alle";
    filterSelect.append(allOpt);
    for (const lane of ["leicht", "mittel", "schwer"] as const) {
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
        empty.textContent = "Keine Aufgaben in dieser Kategorie.";
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
        xpBadge.textContent = `${calculateModuleQuestionXp(question)} XP`;

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
    poolList.replaceChildren();
    const poolQuestions = db.questions.filter(
      (question) => question.moduleIds.length === 0,
    );
    poolEmpty.hidden = poolQuestions.length > 0;
    poolEmpty.textContent =
      poolQuestions.length > 0
        ? ""
        : "Keine unzugeordneten Quizfragen im Pool.";
    for (const question of poolQuestions) {
      const item = document.createElement("li");
      item.className = "module-question-item";
      const meta = document.createElement("div");
      meta.className = "module-question-meta";
      const lane = document.createElement("span");
      lane.className = "contribution-area module-badge";
      lane.textContent = LANE_LABELS[question.targetLane];
      const xp = document.createElement("span");
      xp.className = "contribution-tag module-xp-badge";
      xp.textContent = `${calculateModuleQuestionXp(question)} XP`;
      meta.append(lane, xp);
      const prompt = document.createElement("p");
      prompt.className = "module-question-prompt";
      prompt.textContent = question.prompt;
      const actions = document.createElement("div");
      actions.className = "module-question-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "contribution-edit module-question-edit";
      edit.textContent = "Bearbeiten";
      edit.addEventListener("click", () =>
        document.dispatchEvent(
          new CustomEvent("question:edit", {
            detail: { question, modules: currentDb.modules },
          }),
        ),
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "contribution-delete module-question-delete";
      remove.textContent = "Löschen";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Diese Quizfrage wirklich löschen?")) return;
        remove.disabled = true;
        try {
          await deleteEntity("question", question.id);
        } catch (error) {
          statusEl.textContent =
            error instanceof Error
              ? error.message
              : "Quizfrage konnte nicht gelöscht werden.";
          remove.disabled = false;
        }
      });
      actions.append(edit, remove);
      item.append(meta, prompt, actions);
      poolList.append(item);
    }

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
      const modQuestions = db.questions.filter((q) =>
        isQuestionInModule(q, mod.id),
      );

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
      practiceBadge.textContent = `Praxisaufgaben: ${mod.practiceBlocks?.length ?? 0}`;

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
          }
        });
        actions.append(moveBtn);
      }

      const editBtn = document.createElement("a");
      editBtn.href = `${MODULE_DETAIL_PATH}?id=${encodeURIComponent(mod.id)}`;
      editBtn.className = "contribution-edit";
      editBtn.title = "Modul bearbeiten";
      editBtn.setAttribute("aria-label", `${mod.title} bearbeiten`);
      addIcon(editBtn, [
        "M12 20h9",
        "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z",
      ]);
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
            `Modul „${mod.title}“ löschen? Die Lernpfad-Aufgaben werden mitgelöscht; Quizfragen verlieren nur die Zuordnung zu diesem Modul.`,
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
          `Praxisaufgaben: ${modSummary.practiceBlockCount}`,
          `Leicht: ${modSummary.questionCounts.leicht}`,
          `Mittel: ${modSummary.questionCounts.mittel}`,
          `Schwer: ${modSummary.questionCounts.schwer}`,
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
  document.addEventListener("modules:updated", () => {
    void reload();
  });

  void reload();

  return {
    reload,
    renderDatabase,
  };
}
