import katex from "katex";
import {
  clearLearningProgress,
  completePracticeStep,
  completeTheoryStep,
  createInitialProgress,
  getDashboardOverview,
  type LaneStep,
  type LearningProgressState,
  loadLearningProgress,
  recordExerciseAnswer,
  type StepProgressState,
  saveLearningProgress,
  submitQuizAttempt,
  syncProgressWithCurriculum,
} from "./learning-progress.ts";
import {
  type LearningModule,
  MODULE_SCOPES,
  type ModuleQuestion,
  type ModuleScope,
  type ModulesDatabase,
  type NotationBuilderTaskConfig,
  type TargetLane,
  type TheoryBlock,
} from "./module-schema.ts";
import { createEmptyModulesDatabase } from "./module-store.ts";
import {
  attachNotationBuilder,
  DEFAULT_BUILDER_DURATIONS,
  DEFAULT_NOTATION_STEP,
  DURATION_SVG_DATA,
  describeBuilderState,
  type NotationBuilderConfig,
  renderNotationBuilderSvg,
} from "./notation-builder.ts";
import {
  type NotationEvent,
  renderNotationSvg,
  SPATIUM,
} from "./notation-renderer.ts";
import { type Duration, durationLabels } from "./rhythm.ts";
import { layoutNotationSystems, type NotationProps } from "./system-layout.ts";
import {
  calculateQuestionXp,
  getAvailableTags,
  TAG_DEFINITIONS,
} from "./xp-tags.ts";

const PLAYER_API_ENDPOINT = "/api/modules";
const PLAYER_API_FALLBACK = "/.netlify/functions/modules";

const SCOPE_LABELS: Record<ModuleScope, string> = {
  theory: "Theorie",
  instrument: "Instrument",
  production: "Produktion",
  band: "Band",
};

const STATUS_LABELS: Record<"locked" | "unlocked" | "completed", string> = {
  locked: "Gesperrt",
  unlocked: "Aktiv",
  completed: "Abgeschlossen",
};

const STEP_STATUS_ICONS: Record<StepProgressState, string> = {
  locked: "🔒",
  unlocked: "●",
  completed: "✓",
};

export interface PlayerAttachmentOptions {
  initialDb?: ModulesDatabase;
  autoFetch?: boolean;
  lessonBaseUrl?: string;
}

export type QuestionUserAnswer =
  | { kind: "choice"; selected: string[] }
  | { kind: "numeric"; value: string }
  | { kind: "notation"; pitches: string[]; durations?: string[] };

export interface QuestionEvaluationResult {
  correct: boolean;
  explanation: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLessonUrl(
  baseUrl: string,
  moduleId: string,
  mode?: "fastlane",
): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  const base = `${baseUrl}${separator}id=${encodeURIComponent(moduleId)}`;
  return mode === "fastlane" ? `${base}&mode=fastlane` : base;
}

function sortModules(modules: readonly LearningModule[]): LearningModule[] {
  return [...modules].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id),
  );
}

function parseInitialDatabaseFromRoot(
  root: HTMLElement,
  override?: ModulesDatabase,
): ModulesDatabase {
  if (override) {
    return override;
  }
  const raw = root.dataset.initialDb;
  if (!raw) {
    return createEmptyModulesDatabase();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      Array.isArray(parsed.modules) &&
      Array.isArray(parsed.questions)
    ) {
      return {
        modules: parsed.modules as LearningModule[],
        questions: parsed.questions as ModuleQuestion[],
      };
    }
  } catch {
    // Ungültiges initial-db JSON fällt auf leere Datenbank zurück
  }
  return createEmptyModulesDatabase();
}

async function tryFetchModulesDbFromUrl(
  url: string,
): Promise<ModulesDatabase | null> {
  if (typeof fetch !== "function") {
    return null;
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const raw = (await response.text()).trim();
    if (!raw || raw.startsWith("<")) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      Array.isArray(parsed.modules) &&
      Array.isArray(parsed.questions)
    ) {
      return {
        modules: parsed.modules as LearningModule[],
        questions: parsed.questions as ModuleQuestion[],
      };
    }
  } catch {
    // Netzwerk- oder JSON-Fehler ignorieren, Fallback-Daten bleiben aktiv
  }
  return null;
}

async function fetchLiveModulesDatabase(): Promise<ModulesDatabase | null> {
  return (
    (await tryFetchModulesDbFromUrl(PLAYER_API_ENDPOINT)) ??
    (await tryFetchModulesDbFromUrl(PLAYER_API_FALLBACK))
  );
}

function commitProgressChange(
  nextState: LearningProgressState,
  db: ModulesDatabase,
  reason?: "reset",
): LearningProgressState {
  saveLearningProgress(nextState);
  document.dispatchEvent(
    new CustomEvent("learning-progress:updated", {
      bubbles: true,
      detail: { state: nextState, db, ...(reason ? { reason } : {}) },
    }),
  );
  return nextState;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseNumericAndUnit(raw: string): {
  num: number | null;
  unit: string;
  normalized: string;
} {
  const normalized = normalizeText(raw);
  const match = /^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(normalized);
  if (!match) {
    return { num: null, unit: normalized, normalized };
  }
  const num = Number(match[1].replace(",", "."));
  return {
    num: Number.isFinite(num) ? num : null,
    unit: match[2].trim(),
    normalized,
  };
}

function matchesExpectedPitch(actualRaw: string, expectedRaw: string): boolean {
  const expected = expectedRaw.trim().toUpperCase();
  const actual = actualRaw.trim().toUpperCase();
  if (!expected || !actual) {
    return false;
  }
  if (/\d$/.test(expected)) {
    return actual === expected;
  }
  return actual.replace(/\d+$/, "") === expected;
}

/**
 * Wertet die Schüler-Antwort für alle 4 `questionType`-Varianten aus.
 */
export function evaluateQuestionAnswer(
  question: ModuleQuestion,
  answer: QuestionUserAnswer,
): QuestionEvaluationResult {
  let correct = false;

  if (question.questionType === "single_choice") {
    if (answer.kind === "choice" && answer.selected.length === 1) {
      const selected = normalizeText(answer.selected[0]);
      correct = question.correctAnswers.some(
        (expected) => normalizeText(expected) === selected,
      );
    }
  } else if (question.questionType === "multi_select") {
    if (answer.kind === "choice") {
      const expectedSet = new Set(
        question.correctAnswers.map((item) => normalizeText(item)),
      );
      const selectedSet = new Set(
        answer.selected.map((item) => normalizeText(item)),
      );
      correct =
        expectedSet.size > 0 &&
        selectedSet.size === expectedSet.size &&
        Array.from(expectedSet).every((item) => selectedSet.has(item));
    }
  } else if (question.questionType === "numeric_input") {
    if (answer.kind === "numeric") {
      const actual = parseNumericAndUnit(answer.value);
      if (actual.normalized.length > 0) {
        correct = question.correctAnswers.some((expectedRaw) => {
          const expected = parseNumericAndUnit(expectedRaw);
          if (actual.normalized === expected.normalized) {
            return true;
          }
          if (
            actual.num !== null &&
            expected.num !== null &&
            Math.abs(actual.num - expected.num) < 1e-6
          ) {
            return (
              actual.unit === expected.unit ||
              actual.unit === "" ||
              expected.unit === ""
            );
          }
          return false;
        });
      }
    }
  } else if (question.questionType === "interactive_notation") {
    if (answer.kind === "notation" && question.notationTask) {
      const task = question.notationTask;
      const expectedPitches = task.expectedPitches ?? [];
      const expectedDurations = task.expectedDurations ?? [];

      const pitchesOk =
        expectedPitches.length === 0 ||
        (answer.pitches.length === expectedPitches.length &&
          expectedPitches.every((exp, idx) =>
            matchesExpectedPitch(answer.pitches[idx] ?? "", exp),
          ));

      const durationsOk =
        expectedDurations.length === 0 ||
        ((answer.durations?.length ?? 0) === expectedDurations.length &&
          expectedDurations.every(
            (exp, idx) =>
              normalizeText(answer.durations?.[idx] ?? "") ===
              normalizeText(exp),
          ));

      correct =
        (expectedPitches.length > 0 || expectedDurations.length > 0) &&
        pitchesOk &&
        durationsOk;
    }
  }

  return {
    correct,
    explanation: question.explanation,
  };
}

function renderInlineMarkdown(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const tokenPattern = /(\$[^$\n]+\$|\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      frag.append(document.createTextNode(text.slice(lastIndex, idx)));
    }
    const token = match[0];
    if (token.startsWith("$") && token.endsWith("$")) {
      const expr = token.slice(1, -1);
      const span = document.createElement("span");
      span.className = "learning-inline-math";
      span.innerHTML = katex.renderToString(expr, {
        displayMode: false,
        throwOnError: false,
      });
      frag.append(span);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      frag.append(strong);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      frag.append(code);
    }
    lastIndex = idx + token.length;
  }

  if (lastIndex < text.length) {
    frag.append(document.createTextNode(text.slice(lastIndex)));
  }

  return frag;
}

/** Wandelt Markdown inkl. Inline/Display-KaTeX XSS-sicher in DOM-Elemente um. */
export function renderTheoryMarkdown(markdown: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return frag;
  }

  const chunks = normalized.split(/\n{2,}/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
      const expr = trimmed.slice(2, -2).trim();
      const mathDiv = document.createElement("div");
      mathDiv.className = "learning-math-block";
      mathDiv.innerHTML = katex.renderToString(expr, {
        displayMode: true,
        throwOnError: false,
      });
      frag.append(mathDiv);
      continue;
    }

    const lines = trimmed.split("\n");
    if (lines.every((line) => line.trim().startsWith("- "))) {
      const ul = document.createElement("ul");
      for (const line of lines) {
        const li = document.createElement("li");
        li.append(renderInlineMarkdown(line.trim().slice(2)));
        ul.append(li);
      }
      frag.append(ul);
      continue;
    }

    if (lines.length === 1 && /^#{1,4}\s+/.test(trimmed)) {
      const heading = document.createElement("h5");
      heading.append(renderInlineMarkdown(trimmed.replace(/^#{1,4}\s+/, "")));
      frag.append(heading);
      continue;
    }

    const p = document.createElement("p");
    lines.forEach((line, index) => {
      if (index > 0) p.append(document.createElement("br"));
      p.append(renderInlineMarkdown(line));
    });
    frag.append(p);
  }

  return frag;
}

function buildNotationVisualElement(visualPropsJson?: string): HTMLElement {
  let rawProps: Record<string, unknown> = { clef: "treble", notes: [] };
  if (visualPropsJson && visualPropsJson.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(visualPropsJson);
      if (isRecord(parsed)) {
        rawProps = parsed;
      }
    } catch {
      // Fallback auf leeres Notensystem bei fehlerhaftem JSON
    }
  }

  const clef =
    rawProps.clef === "bass" || rawProps.clef === false
      ? rawProps.clef
      : "treble";
  const notes = Array.isArray(rawProps.notes)
    ? (rawProps.notes as NotationEvent[])
    : [];
  const notationProps: NotationProps = Array.isArray(rawProps.measures)
    ? ({
        ...rawProps,
        clef,
        measures: rawProps.measures,
      } as NotationProps)
    : ({
        ...rawProps,
        clef,
        notes,
      } as NotationProps);

  const scale = typeof rawProps.scale === "number" ? rawProps.scale : 1;
  const rows = layoutNotationSystems(notationProps);

  const wrapper = document.createElement("div");
  wrapper.className = "notation-component not-content";
  wrapper.dataset.fitToWidth = "";
  wrapper.dataset.scale = String(scale);
  wrapper.style.setProperty("--notation-scale", String(scale));
  wrapper.style.setProperty("--notation-spatium", `${SPATIUM * scale}px`);

  const systems = document.createElement("div");
  systems.className = "notation-systems";

  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "notation-row";
    rowEl.style.setProperty(
      "--notation-row-columns",
      String(row.measures.length),
    );
    rowEl.style.setProperty("--notation-grid-columns", row.gridTemplateColumns);
    rowEl.style.setProperty(
      "--notation-row-width",
      `${Math.round(row.widthRatio * 10000) / 100}%`,
    );

    for (const measure of row.measures) {
      const cell = document.createElement("div");
      cell.className = "notation-cell";
      cell.style.minWidth = `${measure.minWidth}px`;

      const visual = document.createElement("div");
      visual.className = "notation-visual not-content embedded";
      if (measure.clef) visual.classList.add("has-clef");

      const content = document.createElement("div");
      content.className = "notation-staff-content";
      content.innerHTML = renderNotationSvg({
        clef: measure.clef || undefined,
        notes: measure.notes,
        accidentals: measure.accidentals,
        timeSignature: measure.timeSignature,
        layoutTimeSignature: measure.layoutTimeSignature,
        showLeftBar: measure.showLeftBar ?? false,
        showRightBar: measure.showRightBar ?? !measure.repeatEnd,
        rightBarStyle: measure.rightBarStyle ?? "single",
        repeatStart: measure.repeatStart ?? false,
        repeatEnd: measure.repeatEnd ?? false,
        curves: measure.curves ?? [],
        hairpin: measure.hairpin,
        hairpins: measure.hairpins,
        ritAt: measure.ritAt,
        aTempoAt: measure.aTempoAt,
        compact: notationProps.compact,
      });
      visual.append(content);
      cell.append(visual);
      rowEl.append(cell);
    }

    systems.append(rowEl);
  }

  wrapper.append(systems);
  return wrapper;
}

function renderTheoryVisualElement(
  block: TheoryBlock,
  templateRoot?: ParentNode,
): HTMLElement | null {
  if (!block.visualComponent || block.visualComponent === "none") {
    return null;
  }

  const host = document.createElement("div");
  host.className = "learning-theory-visual";
  host.dataset.visualComponent = block.visualComponent;

  if (
    block.visualComponent === "Notation" ||
    block.visualComponent === "NotationVisual"
  ) {
    host.append(buildNotationVisualElement(block.visualPropsJson));
    return host;
  }

  const template =
    templateRoot?.querySelector<HTMLTemplateElement>(
      `template[data-visual-template="${block.visualComponent}"]`,
    ) ??
    document.querySelector<HTMLTemplateElement>(
      `template[data-visual-template="${block.visualComponent}"]`,
    );

  if (template) {
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    fragment.querySelector("#fretboard-widget")?.removeAttribute("id");
    host.append(fragment);
    return host;
  }

  const fallbackNote = document.createElement("p");
  fallbackNote.className = "learning-muted";
  fallbackNote.textContent = `Visualisierung: ${block.visualComponent}`;
  host.append(fallbackNote);
  return host;
}

function buildNotationTaskElement(
  task: NotationBuilderTaskConfig,
  questionId: string,
  templateRoot?: ParentNode,
): HTMLElement {
  const presetTemplate =
    templateRoot?.querySelector<HTMLTemplateElement>(
      `template[data-notation-question-id="${questionId}"]`,
    ) ??
    document.querySelector<HTMLTemplateElement>(
      `template[data-notation-question-id="${questionId}"]`,
    );

  if (presetTemplate) {
    const fragment = presetTemplate.content.cloneNode(true) as DocumentFragment;
    const presetRoot = fragment.querySelector<HTMLElement>(
      "[data-notation-builder]",
    );
    if (presetRoot) {
      attachNotationBuilder(presetRoot);
      return presetRoot;
    }
  }

  const config: NotationBuilderConfig = {
    clef: task.clef,
    ...(task.timeSignature ? { timeSignature: task.timeSignature } : {}),
    ...(task.accidentals ? { accidentals: task.accidentals } : {}),
    maxNotes: Math.max(1, task.maxNotes ?? 1),
    ...(task.lockDuration !== undefined
      ? { lockDuration: task.lockDuration }
      : {}),
    showDurationPicker: task.showDurationPicker ?? false,
    compact: task.compact ?? false,
  };

  const maxNotes = Math.max(1, config.maxNotes ?? 1);
  const cursorStep = DEFAULT_NOTATION_STEP;
  const placedNotes = Array.from({ length: maxNotes }, () => null);
  const activeDuration: Duration =
    typeof config.lockDuration === "string"
      ? config.lockDuration
      : (config.initialDuration ?? "quarter");
  const isCompact = Boolean(config.compact);
  const showHints = Boolean(task.showHints);

  const root = document.createElement("div");
  root.className = "notation-component notation-builder not-content";
  if (isCompact) root.classList.add("is-compact");
  root.tabIndex = 0;
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", "Interaktive Notationsaufgabe");
  root.dataset.notationBuilder = "";
  root.dataset.builderConfig = JSON.stringify(config);

  if (config.showDurationPicker) {
    const toolbar = document.createElement("div");
    toolbar.className = "notation-builder-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Notenwert auswählen");

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
      const svgData = DURATION_SVG_DATA[dur];
      btn.innerHTML = `<svg class="notation-builder-duration-icon" viewBox="${svgData.viewBox}" aria-hidden="true" focusable="false"><path d="${svgData.d}" transform="scale(1, -1)" fill="currentColor" /></svg>`;
      picker.append(btn);
    }

    toolbar.append(picker);
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
  root.append(body);

  if (showHints) {
    const footer = document.createElement("div");
    footer.className = "notation-builder-footer";
    const hints = document.createElement("span");
    hints.className = "notation-builder-hints";
    hints.textContent = `${maxNotes > 1 ? "←/→: Position · " : ""}↑/↓: Tonhöhe · Leertaste: Note setzen · Entf: Löschen`;
    footer.append(hints);
    root.append(footer);
  }

  const initialState = describeBuilderState({
    cursorStep,
    placedNotes,
    activeSlot: 0,
    maxNotes,
    clef: task.clef,
    activeDuration,
  });
  root.dataset.cursorStep = String(initialState.cursorStep);
  root.dataset.cursorNote = initialState.currentNote;
  root.dataset.placedNotes = JSON.stringify(Array(maxNotes).fill(null));
  attachNotationBuilder(root);
  return root;
}

function readUserAnswerFromQuestionUi(
  question: ModuleQuestion,
  questionRoot: HTMLElement,
): QuestionUserAnswer {
  if (
    question.questionType === "single_choice" ||
    question.questionType === "multi_select"
  ) {
    const checked = Array.from(
      questionRoot.querySelectorAll<HTMLInputElement>(
        ".learning-choice-input:checked",
      ),
    ).map((input) => input.value);
    return { kind: "choice", selected: checked };
  }

  if (question.questionType === "numeric_input") {
    const input = questionRoot.querySelector<HTMLInputElement>(
      ".learning-numeric-input",
    );
    return { kind: "numeric", value: input?.value ?? "" };
  }

  const builderEl = questionRoot.querySelector<HTMLElement>(
    "[data-notation-builder]",
  );
  let pitches: string[] = [];
  if (builderEl?.dataset.placedNotes) {
    try {
      const parsed: unknown = JSON.parse(builderEl.dataset.placedNotes);
      if (Array.isArray(parsed)) {
        pitches = parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        );
      }
    } catch {
      pitches = [];
    }
  } else if (builderEl?.dataset.placedNote) {
    pitches = [builderEl.dataset.placedNote];
  }

  const dur = builderEl?.dataset.placedDuration;
  const durations =
    typeof dur === "string" && dur.length > 0
      ? pitches.map(() => dur)
      : undefined;

  return {
    kind: "notation",
    pitches,
    ...(durations ? { durations } : {}),
  };
}

function renderQuestionInputBlock(
  question: ModuleQuestion,
  inputPrefix: string,
  templateRoot?: ParentNode,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "learning-question-inputs";

  if (
    question.questionType === "single_choice" ||
    question.questionType === "multi_select"
  ) {
    const optionsList = document.createElement("div");
    optionsList.className = "learning-quiz-options";
    const isMulti = question.questionType === "multi_select";
    for (const option of question.options ?? []) {
      const label = document.createElement("label");
      label.className = "learning-quiz-option";
      const input = document.createElement("input");
      input.type = isMulti ? "checkbox" : "radio";
      input.name = `${inputPrefix}-${question.id}`;
      input.className = "learning-choice-input";
      input.value = option;
      const text = document.createElement("span");
      text.textContent = option;
      label.append(input, text);
      optionsList.append(label);
    }
    container.append(optionsList);
    return container;
  }

  if (question.questionType === "numeric_input") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "learning-numeric-input";
    input.placeholder = "Antwort eingeben (z. B. 880 oder 880 Hz)";
    input.setAttribute("aria-label", question.prompt);
    container.append(input);
    return container;
  }

  if (
    question.questionType === "interactive_notation" &&
    question.notationTask
  ) {
    container.append(
      buildNotationTaskElement(
        question.notationTask,
        question.id,
        templateRoot,
      ),
    );
    return container;
  }

  return container;
}

export interface ProgressDashboardController {
  refresh(): void;
  setDatabase(db: ModulesDatabase): void;
}

/**
 * Initialisiert das XP- & Lernfortschritts-Dashboard inklusive Level,
 * Scope-/Tag-Aufschlüsselung, Reset-Schutz und Live-Event-Synchronisation.
 */
export function attachProgressDashboard(
  root: HTMLElement,
  options: PlayerAttachmentOptions = {},
): ProgressDashboardController {
  if (root.dataset.progressDashboardAttached === "true") {
    throw new Error("ProgressDashboard wurde bereits initialisiert.");
  }
  root.dataset.progressDashboardAttached = "true";

  let currentDb = parseInitialDatabaseFromRoot(root, options.initialDb);

  const render = () => {
    const state = loadLearningProgress(currentDb.modules);
    const overview = getDashboardOverview(state, currentDb);

    root.replaceChildren();
    root.classList.add("learning-dashboard");

    const card = document.createElement("div");
    card.className = "learning-card";

    const header = document.createElement("div");
    header.className = "learning-card-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = "Dein Lernfortschritt";
    const levelPill = document.createElement("span");
    levelPill.className = "contribution-tag learning-xp-badge has-xp";
    levelPill.dataset.dashboardLevel = String(overview.level);
    levelPill.textContent = `Level ${overview.level}`;
    header.append(title, levelPill);

    const metrics = document.createElement("div");
    metrics.className = "learning-dashboard-metrics";

    const xpBox = document.createElement("div");
    xpBox.className = "learning-metric-box";
    const xpLabel = document.createElement("span");
    xpLabel.className = "learning-metric-label";
    xpLabel.textContent = "Gesammelte XP";
    const xpValue = document.createElement("span");
    xpValue.className = "learning-metric-value";
    xpValue.dataset.dashboardXp = String(overview.totalXp);
    xpValue.textContent = `${overview.totalXp} XP`;
    const xpSub = document.createElement("span");
    xpSub.className = "learning-metric-sub";
    xpSub.textContent = `Noch ${overview.xpToNextLevel} XP bis Level ${overview.level + 1}`;
    xpBox.append(xpLabel, xpValue, xpSub);

    const modBox = document.createElement("div");
    modBox.className = "learning-metric-box";
    const modLabel = document.createElement("span");
    modLabel.className = "learning-metric-label";
    modLabel.textContent = "Abgeschlossene Module";
    const modValue = document.createElement("span");
    modValue.className = "learning-metric-value";
    modValue.dataset.dashboardModules = `${overview.completedModules}/${overview.totalModules}`;
    modValue.textContent = `${overview.completedModules} / ${overview.totalModules} (${overview.overallPercent} %)`;
    const modSub = document.createElement("span");
    modSub.className = "learning-metric-sub";
    modSub.textContent = "Normal-Pfad oder Fastlane";
    modBox.append(modLabel, modValue, modSub);

    metrics.append(xpBox, modBox);

    const progressTrack = document.createElement("div");
    progressTrack.className = "learning-progress-bar";
    progressTrack.setAttribute("role", "progressbar");
    progressTrack.setAttribute("aria-valuemin", "0");
    progressTrack.setAttribute("aria-valuemax", "100");
    progressTrack.setAttribute(
      "aria-valuenow",
      String(overview.levelProgressPercent),
    );
    progressTrack.setAttribute(
      "aria-label",
      `Fortschritt in Level ${overview.level}: ${overview.levelProgressPercent} Prozent`,
    );
    const fill = document.createElement("div");
    fill.className = "learning-progress-bar-fill";
    fill.style.width = `${overview.levelProgressPercent}%`;
    progressTrack.append(fill);

    const scopeGroup = document.createElement("div");
    scopeGroup.className = "learning-breakdown-group";
    const scopeHeading = document.createElement("h3");
    scopeHeading.className = "learning-breakdown-heading";
    scopeHeading.textContent = "XP nach Lernbereich (Scope)";
    const scopeRow = document.createElement("div");
    scopeRow.className = "learning-badge-row";
    for (const scope of MODULE_SCOPES) {
      const xp = overview.xpByScope[scope] ?? 0;
      const badge = document.createElement("span");
      badge.className = "contribution-tag learning-xp-badge";
      if (xp > 0) badge.classList.add("has-xp");
      badge.dataset.scopeBadge = scope;
      badge.textContent = `${SCOPE_LABELS[scope]}: ${xp} XP`;
      scopeRow.append(badge);
    }
    scopeGroup.append(scopeHeading, scopeRow);

    const tagGroup = document.createElement("div");
    tagGroup.className = "learning-breakdown-group";
    const tagHeading = document.createElement("h3");
    tagHeading.className = "learning-breakdown-heading";
    tagHeading.textContent = "XP nach Themen-Tags";
    const tagRow = document.createElement("div");
    tagRow.className = "learning-badge-row";
    const knownTags = new Set([
      ...getAvailableTags(),
      ...Object.keys(overview.xpByTag),
    ]);
    for (const tag of knownTags) {
      const xp = overview.xpByTag[tag] ?? 0;
      const mult = TAG_DEFINITIONS[tag]?.multiplier;
      const badge = document.createElement("span");
      badge.className = "contribution-tag learning-xp-badge";
      if (xp > 0) badge.classList.add("has-xp");
      badge.dataset.tagBadge = tag;
      badge.textContent = mult
        ? `${tag} (${mult}x): ${xp} XP`
        : `${tag}: ${xp} XP`;
      tagRow.append(badge);
    }
    tagGroup.append(tagHeading, tagRow);

    const resetArea = document.createElement("div");
    resetArea.className = "learning-reset-area";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "learning-btn learning-btn-danger";
    resetBtn.dataset.action = "request-reset";
    resetBtn.textContent = "Lernfortschritt zurücksetzen";

    const confirmBox = document.createElement("div");
    confirmBox.className = "learning-reset-confirm";
    confirmBox.hidden = true;
    const confirmLabel = document.createElement("span");
    confirmLabel.textContent =
      "Wirklich alle XP und freigeschalteten Module zurücksetzen?";
    const confirmYes = document.createElement("button");
    confirmYes.type = "button";
    confirmYes.className = "learning-btn learning-btn-danger";
    confirmYes.dataset.action = "confirm-reset";
    confirmYes.textContent = "Ja, zurücksetzen";
    const confirmCancel = document.createElement("button");
    confirmCancel.type = "button";
    confirmCancel.className = "learning-btn";
    confirmCancel.dataset.action = "cancel-reset";
    confirmCancel.textContent = "Abbrechen";
    confirmBox.append(confirmLabel, confirmYes, confirmCancel);

    resetBtn.addEventListener("click", () => {
      confirmBox.hidden = false;
      resetBtn.hidden = true;
    });
    confirmCancel.addEventListener("click", () => {
      confirmBox.hidden = true;
      resetBtn.hidden = false;
    });
    confirmYes.addEventListener("click", () => {
      clearLearningProgress();
      const fresh = createInitialProgress(currentDb.modules);
      commitProgressChange(fresh, currentDb, "reset");
    });

    resetArea.append(resetBtn, confirmBox);
    card.append(
      header,
      metrics,
      progressTrack,
      scopeGroup,
      tagGroup,
      resetArea,
    );
    root.append(card);
  };

  render();

  const onProgressUpdated = (event: Event) => {
    if (!root.isConnected) {
      document.removeEventListener(
        "learning-progress:updated",
        onProgressUpdated,
      );
      return;
    }
    if (
      event instanceof CustomEvent &&
      isRecord(event.detail) &&
      isRecord(event.detail.db) &&
      Array.isArray(event.detail.db.modules)
    ) {
      currentDb = event.detail.db as unknown as ModulesDatabase;
    }
    render();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb && liveDb.modules.length > 0) {
        currentDb = liveDb;
        render();
      }
    });
  }

  return {
    refresh: render,
    setDatabase(db: ModulesDatabase) {
      currentDb = db;
      render();
    },
  };
}

export interface ModuleRoadmapController {
  refresh(): void;
  setDatabase(db: ModulesDatabase): void;
}

/**
 * Rendert die nach `order` sortierten Modul-Karten inklusive Etappen-Pills
 * und Aktionsbuttons („Lektion öffnen“ sowie „⚡ Fastlane (Schweres Quiz)“).
 */
export function attachModuleRoadmap(
  root: HTMLElement,
  options: PlayerAttachmentOptions = {},
): ModuleRoadmapController {
  if (root.dataset.moduleRoadmapAttached === "true") {
    throw new Error("ModuleRoadmap wurde bereits initialisiert.");
  }
  root.dataset.moduleRoadmapAttached = "true";

  let currentDb = parseInitialDatabaseFromRoot(root, options.initialDb);
  const lessonBaseUrl = options.lessonBaseUrl ?? "/audio/theory/modul/";

  const render = () => {
    const state = syncProgressWithCurriculum(
      loadLearningProgress(currentDb.modules),
      currentDb.modules,
    );
    const sortedModules = sortModules(currentDb.modules);

    root.replaceChildren();
    root.classList.add("learning-roadmap");

    if (sortedModules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "learning-muted";
      empty.textContent =
        "Es sind noch keine Lernmodule veröffentlicht. Lege im Modul-Builder ein Modul an.";
      root.append(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "learning-roadmap-list";

    for (const mod of sortedModules) {
      const modProgress = state.modules[mod.id];
      const modStatus = modProgress?.status ?? "locked";
      const modQuestions = currentDb.questions.filter(
        (q) => q.moduleId === mod.id,
      );

      const card = document.createElement("li");
      card.className = "learning-roadmap-card";
      card.dataset.moduleCard = mod.id;
      card.dataset.moduleStatus = modStatus;

      const header = document.createElement("div");
      header.className = "learning-card-header";

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "learning-badge-row";

      const orderBadge = document.createElement("span");
      orderBadge.className = "contribution-tag";
      orderBadge.textContent = `Modul ${mod.order}`;

      const statusBadge = document.createElement("span");
      statusBadge.className = "contribution-tag learning-status-pill";
      statusBadge.dataset.state = modStatus;
      statusBadge.textContent = `${STEP_STATUS_ICONS[modStatus]} ${STATUS_LABELS[modStatus]}`;

      const scopeBadge = document.createElement("span");
      scopeBadge.className = "contribution-tag";
      scopeBadge.textContent = `${SCOPE_LABELS[mod.scope]} · Lv ${mod.level}`;

      badgeGroup.append(orderBadge, statusBadge, scopeBadge);

      if (modProgress?.completedVia === "fastlane") {
        const fastlaneBadge = document.createElement("span");
        fastlaneBadge.className = "contribution-tag";
        fastlaneBadge.textContent = "⚡ Fastlane";
        badgeGroup.append(fastlaneBadge);
      }

      header.append(badgeGroup);

      const title = document.createElement("h3");
      title.className = "learning-card-title";
      title.textContent = `${mod.order}. ${mod.title}`;

      const desc = document.createElement("p");
      desc.className = "learning-muted";
      desc.textContent = mod.description || "Interaktives Lernmodul";

      const stages = document.createElement("div");
      stages.className = "learning-stage-pills";

      const stageItems: Array<{ step: LaneStep; label: string }> = [
        { step: "theory", label: "1. Theorie" },
        { step: "exercise", label: "2. Aufgaben" },
        ...(mod.hasPractice
          ? [{ step: "practice" as const, label: "3. Praxis" }]
          : []),
        {
          step: "quiz_easy",
          label: mod.hasPractice ? "4. Quiz Einfach" : "3. Quiz Einfach",
        },
      ];

      for (const item of stageItems) {
        const stepState = modProgress?.steps[item.step] ?? "locked";
        const pill = document.createElement("span");
        pill.className = "contribution-tag learning-status-pill";
        pill.dataset.stagePill = item.step;
        pill.dataset.state = stepState;
        pill.textContent = `${STEP_STATUS_ICONS[stepState]} ${item.label}`;
        stages.append(pill);
      }

      const actions = document.createElement("div");
      actions.className = "learning-roadmap-actions";

      if (modStatus === "locked") {
        const lockedBtn = document.createElement("button");
        lockedBtn.type = "button";
        lockedBtn.className = "learning-btn learning-open-lesson";
        lockedBtn.disabled = true;
        lockedBtn.setAttribute("aria-disabled", "true");
        lockedBtn.textContent = "🔒 Lektion öffnen";
        actions.append(lockedBtn);
      } else {
        const openLink = document.createElement("a");
        openLink.className =
          "learning-link-btn learning-link-btn-primary learning-open-lesson";
        openLink.href = getLessonUrl(lessonBaseUrl, mod.id);
        openLink.textContent = "Lektion öffnen";
        actions.append(openLink);
      }

      const fastlaneLink = document.createElement("a");
      fastlaneLink.className =
        "learning-link-btn learning-link-btn-fastlane learning-open-fastlane";
      fastlaneLink.href = getLessonUrl(lessonBaseUrl, mod.id, "fastlane");
      const fastlaneCount = modQuestions.filter(
        (q) => q.targetLane === "fastlane",
      ).length;
      fastlaneLink.textContent =
        fastlaneCount > 0
          ? `⚡ Fastlane (Schweres Quiz · ${fastlaneCount})`
          : "⚡ Fastlane (Schweres Quiz)";
      actions.append(fastlaneLink);

      card.append(header, title, desc, stages, actions);
      list.append(card);
    }

    root.append(list);
  };

  render();

  const onProgressUpdated = (event: Event) => {
    if (!root.isConnected) {
      document.removeEventListener(
        "learning-progress:updated",
        onProgressUpdated,
      );
      return;
    }
    if (
      event instanceof CustomEvent &&
      isRecord(event.detail) &&
      isRecord(event.detail.db) &&
      Array.isArray(event.detail.db.modules)
    ) {
      currentDb = event.detail.db as unknown as ModulesDatabase;
    }
    render();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb && liveDb.modules.length > 0) {
        currentDb = liveDb;
        render();
      }
    });
  }

  return {
    refresh: render,
    setDatabase(db: ModulesDatabase) {
      currentDb = db;
      render();
    },
  };
}

export interface QuizRunnerMountConfig {
  module: LearningModule;
  db: ModulesDatabase;
  mode: TargetLane;
  templateRoot?: ParentNode;
  lessonBaseUrl?: string;
}

function computeRemainingModuleXp(
  state: LearningProgressState,
  db: ModulesDatabase,
  mod: LearningModule,
  mode: "quiz_easy" | "fastlane",
): number {
  const modProgress = state.modules[mod.id];
  const solvedSet = new Set(modProgress?.solvedQuestionIds ?? []);

  if (mode === "quiz_easy") {
    return db.questions
      .filter(
        (q) =>
          q.moduleId === mod.id &&
          q.targetLane === "quiz_easy" &&
          !solvedSet.has(q.id),
      )
      .reduce((sum, q) => sum + calculateQuestionXp(q.baseXp, q.tags), 0);
  }

  let openXp = 0;
  if (modProgress?.steps.theory !== "completed") {
    openXp += calculateQuestionXp(mod.theoryBaseXp, mod.tags);
  }
  for (const q of db.questions) {
    if (q.moduleId === mod.id && !solvedSet.has(q.id)) {
      openXp += calculateQuestionXp(q.baseXp, q.tags);
    }
  }
  return openXp;
}

/**
 * Bindet den interaktiven Aufgaben- & Prüfungs-Runner (`exercise`, `quiz_easy`, `fastlane`)
 * an ein Container-Element.
 */
export function attachModuleQuizRunner(
  container: HTMLElement,
  config: QuizRunnerMountConfig,
): void {
  const { module: mod, db, mode, templateRoot } = config;
  const lessonBaseUrl = config.lessonBaseUrl ?? "/audio/theory/modul/";
  const questions = db.questions.filter(
    (q) => q.moduleId === mod.id && q.targetLane === mode,
  );

  container.replaceChildren();
  container.classList.add("learning-quiz-runner");
  container.dataset.quizMode = mode;

  if (mode === "exercise") {
    if (questions.length === 0) {
      const box = document.createElement("div");
      box.className = "learning-card";
      const note = document.createElement("p");
      note.className = "learning-muted";
      note.textContent = "Für dieses Modul sind keine Zwischenaufgaben nötig.";
      const finishBtn = document.createElement("button");
      finishBtn.type = "button";
      finishBtn.className = "learning-btn learning-btn-primary";
      finishBtn.dataset.action = "complete-empty-exercise";
      finishBtn.textContent = "Aufgabenschritt abschließen";
      finishBtn.addEventListener("click", () => {
        const current = loadLearningProgress(db.modules);
        const dummyQuestion: ModuleQuestion = {
          id: `__empty_${mod.id}`,
          moduleId: mod.id,
          targetLane: "exercise",
          questionType: "single_choice",
          prompt: "",
          correctAnswers: [],
          explanation: "",
          baseXp: 0,
          tags: [],
        };
        const updated = recordExerciseAnswer(
          current,
          mod,
          dummyQuestion,
          true,
          [],
        );
        commitProgressChange(updated, db);
      });
      box.append(note, finishBtn);
      container.append(box);
      return;
    }

    const currentProgress = loadLearningProgress(db.modules);
    const solvedSet = new Set(
      currentProgress.modules[mod.id]?.solvedQuestionIds ?? [],
    );

    questions.forEach((question, index) => {
      const qCard = document.createElement("div");
      qCard.className = "learning-quiz-card";
      qCard.dataset.questionCard = question.id;
      qCard.dataset.questionSolved = solvedSet.has(question.id)
        ? "true"
        : "false";

      const qHeader = document.createElement("div");
      qHeader.className = "learning-card-header";
      const qTitle = document.createElement("strong");
      qTitle.textContent = `Aufgabe ${index + 1} / ${questions.length}: ${question.prompt}`;
      const qXp = document.createElement("span");
      qXp.className = "contribution-tag learning-xp-badge has-xp";
      const questionXp = calculateQuestionXp(question.baseXp, question.tags);
      qXp.textContent = solvedSet.has(question.id)
        ? `✓ Gelöst (${questionXp} XP)`
        : `+${questionXp} XP`;
      qHeader.append(qTitle, qXp);

      const inputsEl = renderQuestionInputBlock(
        question,
        `ex-${mod.id}`,
        templateRoot,
      );

      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "learning-btn learning-btn-primary";
      checkBtn.dataset.action = "check-exercise";
      checkBtn.textContent = "Antwort prüfen";

      const feedback = document.createElement("div");
      feedback.className = "learning-feedback";
      feedback.hidden = true;

      checkBtn.addEventListener("click", () => {
        const userAnswer = readUserAnswerFromQuestionUi(question, inputsEl);
        const result = evaluateQuestionAnswer(question, userAnswer);
        feedback.hidden = false;
        feedback.replaceChildren();

        const titleEl = document.createElement("strong");
        if (result.correct) {
          feedback.dataset.outcome = "correct";
          const latest = loadLearningProgress(db.modules);
          const alreadySolved =
            latest.modules[mod.id]?.solvedQuestionIds.includes(question.id) ??
            false;
          const updated = recordExerciseAnswer(
            latest,
            mod,
            question,
            true,
            db.questions,
          );
          qCard.dataset.questionSolved = "true";
          qXp.textContent = `✓ Gelöst (${questionXp} XP)`;
          titleEl.textContent = alreadySolved
            ? "✓ Richtig gelöst (XP bereits erhalten)."
            : `✓ Richtig! +${questionXp} XP gutgeschrieben.`;
          feedback.append(titleEl);
          commitProgressChange(updated, db);
        } else {
          feedback.dataset.outcome = "wrong";
          titleEl.textContent =
            "✗ Noch nicht richtig – überprüfe deine Lösung.";
          feedback.append(titleEl);
          if (result.explanation) {
            const expEl = document.createElement("p");
            expEl.className = "learning-feedback-explanation";
            expEl.textContent = result.explanation;
            feedback.append(expEl);
          }
        }
      });

      qCard.append(qHeader, inputsEl, checkBtn, feedback);
      container.append(qCard);
    });
    return;
  }

  if (questions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "learning-muted";
    empty.textContent =
      mode === "fastlane"
        ? "Für den Fastlane-Test dieses Moduls wurden noch keine Fragen hinterlegt."
        : "Für das Abschluss-Quiz dieses Moduls wurden noch keine Fragen hinterlegt.";
    container.append(empty);
    return;
  }

  const threshold =
    mode === "fastlane" ? mod.fastlaneMinScore : mod.quizEasyMinScore;
  const thresholdPct = Math.round(threshold * 100);
  let currentIndex = 0;
  let correctCount = 0;
  let currentQuestionChecked = false;

  const renderExamStep = () => {
    container.replaceChildren();
    const state = loadLearningProgress(db.modules);
    const openXp = computeRemainingModuleXp(state, db, mod, mode);

    const examCard = document.createElement("div");
    examCard.className = "learning-quiz-card";

    const header = document.createElement("div");
    header.className = "learning-card-header";
    const heading = document.createElement("h4");
    heading.style.margin = "0";
    heading.textContent =
      mode === "fastlane"
        ? `⚡ Fastlane-Prüfung (Benötigt: ${thresholdPct} %)`
        : `Abschluss-Quiz Einfach (Benötigt: ${thresholdPct} %)`;
    const bonusBadge = document.createElement("span");
    bonusBadge.className = "contribution-tag learning-xp-badge has-xp";
    bonusBadge.dataset.quizXpPreview = String(openXp);
    bonusBadge.textContent =
      openXp > 0 ? `Bonus: +${openXp} XP` : "Alle XP bereits gesammelt";
    header.append(heading, bonusBadge);

    const progressInfo = document.createElement("div");
    progressInfo.className = "learning-card-header";
    const counter = document.createElement("span");
    counter.className = "learning-muted";
    counter.dataset.quizProgressText = "";
    counter.textContent = `Frage ${currentIndex + 1} / ${questions.length}`;
    const scoreTracker = document.createElement("span");
    scoreTracker.className = "learning-muted";
    scoreTracker.textContent = `Bisher richtig: ${correctCount}`;
    progressInfo.append(counter, scoreTracker);

    const bar = document.createElement("div");
    bar.className = "learning-progress-bar";
    const fill = document.createElement("div");
    fill.className = "learning-progress-bar-fill";
    const pct = Math.round(((currentIndex + 1) / questions.length) * 100);
    fill.style.width = `${pct}%`;
    bar.append(fill);

    const question = questions[currentIndex];
    const promptEl = document.createElement("p");
    promptEl.style.fontWeight = "600";
    promptEl.style.margin = "0";
    promptEl.textContent = question.prompt;

    const inputsEl = renderQuestionInputBlock(
      question,
      `${mode}-${mod.id}`,
      templateRoot,
    );

    const feedback = document.createElement("div");
    feedback.className = "learning-feedback";
    feedback.hidden = true;

    const actions = document.createElement("div");
    actions.className = "learning-roadmap-actions";

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "learning-btn learning-btn-primary";
    checkBtn.dataset.action = "check-quiz-answer";
    checkBtn.textContent = "Antwort prüfen";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "learning-btn";
    nextBtn.dataset.action = "next-quiz-question";
    nextBtn.hidden = true;
    nextBtn.textContent =
      currentIndex + 1 < questions.length
        ? "Nächste Frage →"
        : "Quiz auswerten";

    checkBtn.addEventListener("click", () => {
      if (currentQuestionChecked) return;
      currentQuestionChecked = true;
      const userAnswer = readUserAnswerFromQuestionUi(question, inputsEl);
      const result = evaluateQuestionAnswer(question, userAnswer);
      if (result.correct) {
        correctCount += 1;
      }

      scoreTracker.textContent = `Bisher richtig: ${correctCount}`;
      feedback.hidden = false;
      feedback.replaceChildren();
      const outcomeEl = document.createElement("strong");
      if (result.correct) {
        feedback.dataset.outcome = "correct";
        outcomeEl.textContent = "✓ Richtig beantwortet!";
        feedback.append(outcomeEl);
      } else {
        feedback.dataset.outcome = "wrong";
        outcomeEl.textContent = "✗ Leider falsch.";
        feedback.append(outcomeEl);
        if (result.explanation) {
          const expEl = document.createElement("p");
          expEl.className = "learning-feedback-explanation";
          expEl.textContent = result.explanation;
          feedback.append(expEl);
        }
      }

      inputsEl.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.disabled = true;
      });
      checkBtn.hidden = true;
      nextBtn.hidden = false;
    });

    nextBtn.addEventListener("click", () => {
      if (currentIndex + 1 < questions.length) {
        currentIndex += 1;
        currentQuestionChecked = false;
        renderExamStep();
        return;
      }

      const ratio = correctCount / questions.length;
      const scorePct = Math.round(ratio * 100);
      const before = loadLearningProgress(db.modules);
      const after = submitQuizAttempt(before, db, mod.id, mode, ratio);
      const earnedXp = after.totalXp - before.totalXp;

      container.replaceChildren();
      const summary = document.createElement("div");
      summary.className = "learning-quiz-summary";
      summary.dataset.quizResult = ratio >= threshold ? "passed" : "failed";

      const resultTitle = document.createElement("h4");
      resultTitle.style.margin = "0";
      const resultDesc = document.createElement("p");
      resultDesc.style.margin = "0";

      if (ratio >= threshold) {
        resultTitle.textContent = `🎉 Bestanden mit ${scorePct} % (${correctCount}/${questions.length})`;
        resultDesc.textContent =
          earnedXp > 0
            ? `+${earnedXp} XP wurden gutgeschrieben und das nächste Modul ist nun freigeschaltet.`
            : "Modul abgeschlossen! Alle verfügbaren XP dieses Moduls waren bereits gesichert.";
      } else {
        resultTitle.textContent = `Nicht bestanden: ${scorePct} % (${correctCount}/${questions.length})`;
        resultDesc.textContent = `Für diesen Modus werden mindestens ${thresholdPct} % benötigt. Wiederhole die Lektion oder versuche es erneut.`;
      }

      const summaryActions = document.createElement("div");
      summaryActions.className = "learning-roadmap-actions";

      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "learning-btn";
      retryBtn.dataset.action = "retry-quiz";
      retryBtn.textContent = "Erneut versuchen";
      retryBtn.addEventListener("click", () => {
        currentIndex = 0;
        correctCount = 0;
        currentQuestionChecked = false;
        renderExamStep();
      });
      summaryActions.append(retryBtn);

      if (ratio >= threshold) {
        const sortedMods = sortModules(db.modules);
        const modIdx = sortedMods.findIndex((m) => m.id === mod.id);
        const nextMod = modIdx >= 0 ? sortedMods[modIdx + 1] : undefined;
        if (nextMod) {
          const nextLink = document.createElement("a");
          nextLink.className = "learning-link-btn learning-link-btn-primary";
          nextLink.href = getLessonUrl(lessonBaseUrl, nextMod.id);
          nextLink.textContent = `Weiter zu Modul ${nextMod.order}: ${nextMod.title} →`;
          summaryActions.append(nextLink);
        }
        const roadmapLink = document.createElement("a");
        roadmapLink.className = "learning-link-btn";
        roadmapLink.href = "/audio/theory/lernpfad/";
        roadmapLink.textContent = "Zurück zur Übersicht";
        summaryActions.append(roadmapLink);
      }

      summary.append(resultTitle, resultDesc, summaryActions);
      container.append(summary);
      commitProgressChange(after, db);
    });

    actions.append(checkBtn, nextBtn);
    examCard.append(
      header,
      progressInfo,
      bar,
      promptEl,
      inputsEl,
      feedback,
      actions,
    );
    container.append(examCard);
  };

  renderExamStep();
}

export interface ModuleStepperController {
  refresh(): void;
  setDatabase(db: ModulesDatabase): void;
}

/**
 * Initialisiert den Schritt-für-Schritt-Lektionsparcours (`ModuleStepper`)
 * inklusive Fastlane-Ansicht, Markdown/KaTeX-Theorieblöcken und Step-Freischaltung.
 */
export function attachModuleStepper(
  root: HTMLElement,
  options: PlayerAttachmentOptions = {},
): ModuleStepperController {
  if (root.dataset.moduleStepperAttached === "true") {
    throw new Error("ModuleStepper wurde bereits initialisiert.");
  }
  root.dataset.moduleStepperAttached = "true";

  let currentDb = parseInitialDatabaseFromRoot(root, options.initialDb);
  const lessonBaseUrl = options.lessonBaseUrl ?? "/audio/theory/modul/";

  const resolveModuleAndMode = (): {
    mod: LearningModule | undefined;
    mode: "normal" | "fastlane";
  } => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const requestedId =
      params.get("id")?.trim() || root.dataset.moduleId?.trim() || "";
    const requestedMode =
      params.get("mode") === "fastlane" || root.dataset.mode === "fastlane"
        ? "fastlane"
        : "normal";

    const sorted = sortModules(currentDb.modules);
    const mod = sorted.find((item) => item.id === requestedId) ?? sorted[0];
    return { mod, mode: requestedMode };
  };

  let renderedSnapshotKey = "";
  let stepElements: Partial<Record<LaneStep, HTMLElement>> = {};
  let exerciseHost: HTMLElement | null = null;
  let quizHost: HTMLElement | null = null;

  const fullRender = () => {
    const { mod, mode } = resolveModuleAndMode();
    const state = syncProgressWithCurriculum(
      loadLearningProgress(currentDb.modules),
      currentDb.modules,
    );

    const contentHost =
      root.querySelector<HTMLElement>("[data-stepper-content]") ?? root;
    contentHost.replaceChildren();
    contentHost.classList.add("learning-stepper");

    if (!mod) {
      const empty = document.createElement("p");
      empty.className = "learning-muted";
      empty.textContent =
        "Kein passendes Lernmodul gefunden. Öffne ein Modul über den Lernpfad.";
      contentHost.append(empty);
      return;
    }

    const modProgress = state.modules[mod.id];
    const modStatus = modProgress?.status ?? "locked";
    renderedSnapshotKey = `${mod.id}:${mode}`;
    stepElements = {};
    exerciseHost = null;
    quizHost = null;

    const headerCard = document.createElement("div");
    headerCard.className = "learning-card";
    const headerTop = document.createElement("div");
    headerTop.className = "learning-card-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = `${mod.order}. ${mod.title}`;
    const modeActions = document.createElement("div");
    modeActions.className = "learning-stepper-header-actions";

    if (mode === "fastlane") {
      if (modStatus !== "locked") {
        const normalLink = document.createElement("a");
        normalLink.className = "learning-link-btn";
        normalLink.href = getLessonUrl(lessonBaseUrl, mod.id);
        normalLink.textContent = "Zum regulären Lernpfad";
        modeActions.append(normalLink);
      }
    } else {
      const fastlaneLink = document.createElement("a");
      fastlaneLink.className = "learning-link-btn learning-link-btn-fastlane";
      fastlaneLink.href = getLessonUrl(lessonBaseUrl, mod.id, "fastlane");
      fastlaneLink.textContent = "⚡ Direkt zum Fastlane-Test";
      modeActions.append(fastlaneLink);
    }

    headerTop.append(title, modeActions);
    const desc = document.createElement("p");
    desc.className = "learning-muted";
    desc.textContent = mod.description || "";
    headerCard.append(headerTop);
    if (mod.description) headerCard.append(desc);
    contentHost.append(headerCard);

    if (mode === "fastlane") {
      const runnerContainer = document.createElement("div");
      attachModuleQuizRunner(runnerContainer, {
        module: mod,
        db: currentDb,
        mode: "fastlane",
        templateRoot: root,
        lessonBaseUrl,
      });
      contentHost.append(runnerContainer);
      return;
    }

    if (modStatus === "locked") {
      const lockBanner = document.createElement("div");
      lockBanner.className = "learning-card";
      const lockText = document.createElement("p");
      lockText.style.margin = "0";
      lockText.textContent =
        "🔒 Dieses Modul ist im regulären Pfad noch gesperrt. Schließe zuerst das vorherige Modul ab oder nutze den Fastlane-Test.";
      const flLink = document.createElement("a");
      flLink.className = "learning-link-btn learning-link-btn-fastlane";
      flLink.href = getLessonUrl(lessonBaseUrl, mod.id, "fastlane");
      flLink.textContent = "⚡ Fastlane jetzt starten";
      lockBanner.append(lockText, flLink);
      contentHost.append(lockBanner);
      return;
    }

    // Schritt 1: Theorie
    const theoryStepState = modProgress?.steps.theory ?? "unlocked";
    const theorySection = document.createElement("section");
    theorySection.className = "learning-step-section";
    theorySection.dataset.step = "theory";
    theorySection.dataset.stepState = theoryStepState;
    stepElements.theory = theorySection;

    const theoryHeader = document.createElement("div");
    theoryHeader.className = "learning-step-header";
    const theoryHeading = document.createElement("h3");
    theoryHeading.textContent = "Schritt 1: Theorie";
    const theoryBadge = document.createElement("span");
    theoryBadge.className = "contribution-tag learning-status-pill";
    theoryBadge.dataset.stepBadge = "theory";
    theoryBadge.dataset.state = theoryStepState;
    theoryBadge.textContent = `${STEP_STATUS_ICONS[theoryStepState]} ${STATUS_LABELS[theoryStepState]}`;
    theoryHeader.append(theoryHeading, theoryBadge);

    const blocksWrap = document.createElement("div");
    blocksWrap.className = "learning-theory-blocks";
    const sortedBlocks = [...mod.theoryBlocks].sort(
      (a, b) => a.order - b.order,
    );
    for (const block of sortedBlocks) {
      const blockEl = document.createElement("article");
      blockEl.className = "learning-theory-block";
      const bTitle = document.createElement("h4");
      bTitle.textContent = `${block.order}. ${block.title}`;
      const bMd = document.createElement("div");
      bMd.className = "learning-theory-markdown";
      bMd.append(renderTheoryMarkdown(block.markdownContent));
      blockEl.append(bTitle, bMd);

      const visualEl = renderTheoryVisualElement(block, root);
      if (visualEl) {
        blockEl.append(visualEl);
      }
      blocksWrap.append(blockEl);
    }

    const theoryXp = calculateQuestionXp(mod.theoryBaseXp, mod.tags);
    const completeTheoryBtn = document.createElement("button");
    completeTheoryBtn.type = "button";
    completeTheoryBtn.className = "learning-btn learning-btn-primary";
    completeTheoryBtn.dataset.action = "complete-theory";
    if (theoryStepState === "completed") {
      completeTheoryBtn.disabled = true;
      completeTheoryBtn.textContent = `✓ Theorie abgeschlossen (+${theoryXp} XP)`;
    } else {
      completeTheoryBtn.textContent = `Theorie abschließen (+${theoryXp} XP)`;
    }

    completeTheoryBtn.addEventListener("click", () => {
      const latest = loadLearningProgress(currentDb.modules);
      const updated = completeTheoryStep(latest, mod);
      commitProgressChange(updated, currentDb);
    });

    theorySection.append(theoryHeader, blocksWrap, completeTheoryBtn);
    contentHost.append(theorySection);

    // Schritt 2: Aufgaben
    const exerciseStepState = modProgress?.steps.exercise ?? "locked";
    const exerciseSection = document.createElement("section");
    exerciseSection.className = "learning-step-section";
    exerciseSection.dataset.step = "exercise";
    exerciseSection.dataset.stepState = exerciseStepState;
    stepElements.exercise = exerciseSection;

    const exerciseHeader = document.createElement("div");
    exerciseHeader.className = "learning-step-header";
    const exerciseHeading = document.createElement("h3");
    exerciseHeading.textContent = "Schritt 2: Interaktive Aufgaben";
    const exerciseBadge = document.createElement("span");
    exerciseBadge.className = "contribution-tag learning-status-pill";
    exerciseBadge.dataset.stepBadge = "exercise";
    exerciseBadge.dataset.state = exerciseStepState;
    exerciseBadge.textContent = `${STEP_STATUS_ICONS[exerciseStepState]} ${STATUS_LABELS[exerciseStepState]}`;
    exerciseHeader.append(exerciseHeading, exerciseBadge);
    exerciseSection.append(exerciseHeader);

    exerciseHost = document.createElement("div");
    if (exerciseStepState === "locked") {
      const lockMsg = document.createElement("p");
      lockMsg.className = "learning-step-lock-notice";
      lockMsg.textContent =
        "🔒 Dieser Schritt ist noch gesperrt – schließe zuerst Schritt 1 (Theorie) ab.";
      exerciseHost.append(lockMsg);
    } else {
      attachModuleQuizRunner(exerciseHost, {
        module: mod,
        db: currentDb,
        mode: "exercise",
        templateRoot: root,
        lessonBaseUrl,
      });
    }
    exerciseSection.append(exerciseHost);
    contentHost.append(exerciseSection);

    // Schritt 3 (optional): Praxis
    if (mod.hasPractice) {
      const practiceStepState = modProgress?.steps.practice ?? "locked";
      const practiceSection = document.createElement("section");
      practiceSection.className = "learning-step-section";
      practiceSection.dataset.step = "practice";
      practiceSection.dataset.stepState = practiceStepState;
      stepElements.practice = practiceSection;

      const practiceHeader = document.createElement("div");
      practiceHeader.className = "learning-step-header";
      const practiceHeading = document.createElement("h3");
      practiceHeading.textContent = "Schritt 3: Praxis am Instrument";
      const practiceBadge = document.createElement("span");
      practiceBadge.className = "contribution-tag learning-status-pill";
      practiceBadge.dataset.stepBadge = "practice";
      practiceBadge.dataset.state = practiceStepState;
      practiceBadge.textContent = `${STEP_STATUS_ICONS[practiceStepState]} ${STATUS_LABELS[practiceStepState]}`;
      practiceHeader.append(practiceHeading, practiceBadge);
      practiceSection.append(practiceHeader);

      const practiceBody = document.createElement("div");
      practiceBody.dataset.practiceBody = "";
      renderPracticeBody(practiceBody, practiceStepState, mod);
      practiceSection.append(practiceBody);
      contentHost.append(practiceSection);
    }

    // Schritt 4 (bzw. 3): Abschluss-Quiz Einfach
    const quizStepState = modProgress?.steps.quiz_easy ?? "locked";
    const quizSection = document.createElement("section");
    quizSection.className = "learning-step-section";
    quizSection.dataset.step = "quiz_easy";
    quizSection.dataset.stepState = quizStepState;
    stepElements.quiz_easy = quizSection;

    const quizHeader = document.createElement("div");
    quizHeader.className = "learning-step-header";
    const quizHeading = document.createElement("h3");
    quizHeading.textContent = mod.hasPractice
      ? "Schritt 4: Abschluss-Quiz Einfach"
      : "Schritt 3: Abschluss-Quiz Einfach";
    const quizBadge = document.createElement("span");
    quizBadge.className = "contribution-tag learning-status-pill";
    quizBadge.dataset.stepBadge = "quiz_easy";
    quizBadge.dataset.state = quizStepState;
    quizBadge.textContent = `${STEP_STATUS_ICONS[quizStepState]} ${STATUS_LABELS[quizStepState]}`;
    quizHeader.append(quizHeading, quizBadge);
    quizSection.append(quizHeader);

    quizHost = document.createElement("div");
    if (quizStepState === "locked") {
      const lockMsg = document.createElement("p");
      lockMsg.className = "learning-step-lock-notice";
      lockMsg.textContent = mod.hasPractice
        ? "🔒 Das Abschluss-Quiz ist gesperrt – schließe zuerst die Aufgaben und den Praxisteil ab."
        : "🔒 Das Abschluss-Quiz ist gesperrt – löse zuerst alle Aufgaben in Schritt 2.";
      quizHost.append(lockMsg);
    } else {
      attachModuleQuizRunner(quizHost, {
        module: mod,
        db: currentDb,
        mode: "quiz_easy",
        templateRoot: root,
        lessonBaseUrl,
      });
    }
    quizSection.append(quizHost);
    contentHost.append(quizSection);
  };

  function renderPracticeBody(
    bodyEl: HTMLElement,
    stepState: StepProgressState,
    mod: LearningModule,
  ): void {
    bodyEl.replaceChildren();
    if (stepState === "locked") {
      const msg = document.createElement("p");
      msg.className = "learning-step-lock-notice";
      msg.textContent =
        "🔒 Dieser Schritt ist gesperrt – löse zuerst alle Aufgaben in Schritt 2.";
      bodyEl.append(msg);
      return;
    }

    const hint = document.createElement("p");
    hint.className = "learning-muted";
    hint.textContent =
      "Übe das Thema direkt an deinem Instrument und bestätige den Abschluss, um das Quiz freizuschalten.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "learning-btn learning-btn-primary";
    btn.dataset.action = "complete-practice";
    if (stepState === "completed") {
      btn.disabled = true;
      btn.textContent = "✓ Praxisteil abgeschlossen";
    } else {
      btn.textContent = "Praxisteil abschließen";
      btn.addEventListener("click", () => {
        const latest = loadLearningProgress(currentDb.modules);
        const updated = completePracticeStep(latest, mod);
        commitProgressChange(updated, currentDb);
      });
    }
    bodyEl.append(hint, btn);
  }

  const syncStepsInPlace = (reason?: string) => {
    const { mod, mode } = resolveModuleAndMode();
    if (
      !mod ||
      renderedSnapshotKey !== `${mod.id}:${mode}` ||
      reason === "reset"
    ) {
      fullRender();
      return;
    }
    if (mode !== "normal") {
      return;
    }

    const state = loadLearningProgress(currentDb.modules);
    const modProgress = state.modules[mod.id];
    if (
      !modProgress ||
      modProgress.status === "locked" ||
      !stepElements.theory
    ) {
      fullRender();
      return;
    }

    const updateBadge = (step: LaneStep, nextStepState: StepProgressState) => {
      const section = stepElements[step];
      if (!section) return "";
      const prev = section.dataset.stepState ?? "locked";
      section.dataset.stepState = nextStepState;
      const badge = section.querySelector<HTMLElement>(
        `[data-step-badge="${step}"]`,
      );
      if (badge) {
        badge.dataset.state = nextStepState;
        badge.textContent = `${STEP_STATUS_ICONS[nextStepState]} ${STATUS_LABELS[nextStepState]}`;
      }
      return prev;
    };

    const prevTheory = updateBadge("theory", modProgress.steps.theory);
    if (
      prevTheory !== modProgress.steps.theory &&
      modProgress.steps.theory === "completed"
    ) {
      const btn = stepElements.theory?.querySelector<HTMLButtonElement>(
        '[data-action="complete-theory"]',
      );
      if (btn) {
        const theoryXp = calculateQuestionXp(mod.theoryBaseXp, mod.tags);
        btn.disabled = true;
        btn.textContent = `✓ Theorie abgeschlossen (+${theoryXp} XP)`;
      }
    }

    const prevEx = updateBadge("exercise", modProgress.steps.exercise);
    if (
      prevEx === "locked" &&
      modProgress.steps.exercise !== "locked" &&
      exerciseHost
    ) {
      attachModuleQuizRunner(exerciseHost, {
        module: mod,
        db: currentDb,
        mode: "exercise",
        templateRoot: root,
        lessonBaseUrl,
      });
    }

    if (mod.hasPractice) {
      const prevPractice = updateBadge("practice", modProgress.steps.practice);
      const practiceBody = stepElements.practice?.querySelector<HTMLElement>(
        "[data-practice-body]",
      );
      if (practiceBody && prevPractice !== modProgress.steps.practice) {
        renderPracticeBody(practiceBody, modProgress.steps.practice, mod);
      }
    }

    const prevQuiz = updateBadge("quiz_easy", modProgress.steps.quiz_easy);
    if (
      prevQuiz === "locked" &&
      modProgress.steps.quiz_easy !== "locked" &&
      quizHost
    ) {
      attachModuleQuizRunner(quizHost, {
        module: mod,
        db: currentDb,
        mode: "quiz_easy",
        templateRoot: root,
        lessonBaseUrl,
      });
    }
  };

  fullRender();

  const onProgressUpdated = (event: Event) => {
    if (!root.isConnected) {
      document.removeEventListener(
        "learning-progress:updated",
        onProgressUpdated,
      );
      return;
    }
    let reason: string | undefined;
    if (event instanceof CustomEvent && isRecord(event.detail)) {
      if (typeof event.detail.reason === "string") {
        reason = event.detail.reason;
      }
      if (isRecord(event.detail.db) && Array.isArray(event.detail.db.modules)) {
        currentDb = event.detail.db as unknown as ModulesDatabase;
      }
    }
    syncStepsInPlace(reason);
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb && liveDb.modules.length > 0) {
        currentDb = liveDb;
        fullRender();
      }
    });
  }

  return {
    refresh: fullRender,
    setDatabase(db: ModulesDatabase) {
      currentDb = db;
      fullRender();
    },
  };
}
