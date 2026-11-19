import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  createDrumPatternElement,
  initializeDrumPatterns,
} from "./drum-pattern.ts";
import {
  clearLearningProgress,
  completePracticeBlock,
  completeTheoryBlock,
  completeTheoryStep,
  createInitialProgress,
  getDashboardOverview,
  getEquippedInventoryItem,
  getEffectiveQuizSettings,
  type LearningProgressState,
  loadLearningProgress,
  type ModuleProgress,
  recordExerciseAnswer,
  type StepProgressState,
  saveLearningProgress,
  submitQuizAttempt,
  syncProgressWithCurriculum,
} from "./learning-progress.ts";
import {
  buildLessonSections,
  cleanLessonTitle,
  getLessonSectionTitle,
  type LessonItem,
  type LessonSection,
} from "./module-lessons.ts";
import {
  BASE_XP_DEFAULTS,
  formatExerciseTitle,
  getLearningCatalog,
  isQuestionInModule,
  isQuizSettings,
  type LearningModule,
  MODULE_SCOPES,
  type ModuleQuestion,
  type ModuleScope,
  type ModulesDatabase,
  type NotationBuilderTaskConfig,
  normalizeLegacyDatabase,
  type PracticeBlock,
  type TargetLane,
  type TheoryBlock,
} from "./module-schema.ts";
import { createEmptyModulesDatabase } from "./module-store.ts";
import {
  hasEquivalentNotation,
  parseTheoryDrumPattern,
  parseTheoryNotation,
} from "./module-theory-notation.ts";
import {
  attachNotationBuilder,
  DEFAULT_BUILDER_DURATIONS,
  DEFAULT_NOTATION_STEP,
  DURATION_SVG_DATA,
  describeBuilderState,
  type NotationBuilderConfig,
  pitchNameToStep,
  renderNotationBuilderSvg,
} from "./notation-builder.ts";
import {
  type NotationEvent,
  type NotationNote,
  renderNotationSvg,
  SPATIUM,
} from "./notation-renderer.ts";
import { type Duration, durationLabels } from "./rhythm.ts";
import { layoutNotationSystems, type NotationProps } from "./system-layout.ts";
import { createXpBadge } from "./xp-badge.ts";
import {
  calculateModuleQuestionXp,
  calculateTheoryBlockXp,
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
  showDetails?: boolean;
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

function createBlueProgressBar(
  ariaLabel: string,
  percent: number,
): HTMLDivElement {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const bar = document.createElement("div");
  bar.className = "learning-progress-bar learning-module-stat-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(clamped));
  bar.setAttribute("aria-label", `${ariaLabel} (${clamped} Prozent)`);

  const fill = document.createElement("div");
  fill.className = "learning-progress-bar-fill learning-module-stat-bar-fill";
  fill.style.width = `${clamped}%`;
  bar.append(fill);
  return bar;
}

function computeModuleStats(
  mod: LearningModule,
  modQuestions: readonly ModuleQuestion[],
  modProgress: ModuleProgress | undefined,
): {
  completedTheory: number;
  totalTheory: number;
  completedExercises: number;
  totalExercises: number;
  quizDone: boolean;
  quizReady: boolean;
  overallPercent: number;
} {
  const theoryBlocks = mod.theoryBlocks.filter(
    (block) => block.role !== "exercise_intro",
  );
  const totalTheory = theoryBlocks.length;
  const theoryDone = modProgress?.steps.theory === "completed";
  const completedIds = new Set(modProgress?.completedTheoryBlockIds ?? []);
  const completedTheory = theoryDone
    ? totalTheory
    : theoryBlocks.filter((block) => completedIds.has(block.id)).length;

  const exerciseQuestions = modQuestions.filter(
    (q) => q.targetLane === "leicht",
  );
  const totalExercises = exerciseQuestions.length;
  const solvedSet = new Set(modProgress?.solvedQuestionIds ?? []);
  const solvedExercises = exerciseQuestions.filter((q) =>
    solvedSet.has(q.id),
  ).length;
  const exerciseDone = modProgress?.steps.leicht === "completed";
  const completedExercises = exerciseDone ? totalExercises : solvedExercises;

  const modStatus = modProgress?.status ?? "locked";
  const quizDone =
    modProgress?.steps.mittel === "completed" || modStatus === "completed";
  const quizReady =
    modProgress?.steps.mittel === "unlocked" ||
    modProgress?.steps.mittel === "completed";

  const totalItems = totalTheory + totalExercises + 1;
  const doneItems = completedTheory + completedExercises + (quizDone ? 1 : 0);
  const overallPercent = quizDone
    ? 100
    : totalItems > 0
      ? Math.min(100, Math.round((doneItems / totalItems) * 100))
      : 0;

  return {
    completedTheory,
    totalTheory,
    completedExercises,
    totalExercises,
    quizDone,
    quizReady,
    overallPercent,
  };
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
    return getLearningCatalog(override);
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
      Array.isArray(parsed.questions) &&
      (parsed.quizSettings === undefined || isQuizSettings(parsed.quizSettings))
    ) {
      return getLearningCatalog(
        normalizeLegacyDatabase({
          modules: parsed.modules as LearningModule[],
          questions: parsed.questions as ModuleQuestion[],
          ...(parsed.quizSettings !== undefined
            ? { quizSettings: parsed.quizSettings }
            : {}),
        }),
      );
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
      Array.isArray(parsed.questions) &&
      (parsed.quizSettings === undefined || isQuizSettings(parsed.quizSettings))
    ) {
      return getLearningCatalog(
        normalizeLegacyDatabase({
          modules: parsed.modules as LearningModule[],
          questions: parsed.questions as ModuleQuestion[],
          ...(parsed.quizSettings !== undefined
            ? { quizSettings: parsed.quizSettings }
            : {}),
        }),
      );
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

function showCatalogStatus(root: HTMLElement, message: string): void {
  const status = document.createElement("p");
  status.className = "learning-muted";
  status.setAttribute("role", "status");
  status.textContent = message;
  (root.querySelector("[data-stepper-content]") ?? root).replaceChildren(
    status,
  );
}

const catalogLoadError = "Der Modulkatalog konnte nicht geladen werden.";

function canRenderInitialCatalog(
  root: HTMLElement,
  options: PlayerAttachmentOptions,
): boolean {
  return Boolean(
    options.autoFetch === false || options.initialDb || root.dataset.initialDb,
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

function playEquippedTaskSound(state: LearningProgressState): void {
  const equipped = getEquippedInventoryItem(state);
  if (!equipped?.assetUrl) return;
  const audio = new Audio(equipped.assetUrl);
  void audio.play().catch((error) => {
    console.warn(`[Lernpfad] ${equipped.title} konnte nicht abgespielt werden.`, error);
  });
}

function parseNumericAndUnit(raw: string): {
  num: number | null;
  numericText: string;
  unit: string;
  normalized: string;
} {
  const text = raw.trim().replace(/\s+/g, " ");
  const normalized = text.toLowerCase();
  const match = /^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(text);
  if (!match) {
    return { num: null, numericText: "", unit: normalized, normalized };
  }
  const num = Number(match[1].replace(",", "."));
  return {
    num: Number.isFinite(num) ? num : null,
    numericText: match[1],
    unit: match[2].trim(),
    normalized,
  };
}

function getNumericQuestionUnit(question: ModuleQuestion): string {
  const explicitUnit = /\(in\s+([^()]+)\)/i.exec(question.prompt)?.[1].trim();
  const isUnit = (value: string) =>
    /^[\p{L}%°µ€$][\p{L}%°µ€$²³/·^0-9-]*$/u.test(value);
  if (explicitUnit && isUnit(explicitUnit)) return explicitUnit;

  const units = new Map<string, string>();
  for (const answer of question.correctAnswers) {
    const { num, unit } = parseNumericAndUnit(answer);
    if (num === null || (unit && !isUnit(unit))) return "";
    if (unit && !units.has(normalizeText(unit))) {
      units.set(normalizeText(unit), unit);
    }
  }
  return units.size === 1 ? (units.values().next().value ?? "") : "";
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
      const actualUnit = normalizeText(actual.unit);
      const fixedUnit = normalizeText(getNumericQuestionUnit(question));
      if (
        actual.normalized &&
        (!fixedUnit || !actualUnit || actualUnit === fixedUnit)
      ) {
        correct = question.correctAnswers.some((expectedRaw) => {
          const expected = parseNumericAndUnit(expectedRaw);
          const expectedUnit = normalizeText(expected.unit);
          if (fixedUnit && expectedUnit && expectedUnit !== fixedUnit) {
            return false;
          }
          if (actual.normalized === expected.normalized) {
            return true;
          }
          if (
            actual.num !== null &&
            expected.num !== null &&
            Math.abs(actual.num - expected.num) < 1e-6
          ) {
            return actualUnit === expectedUnit || !actualUnit || !expectedUnit;
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

const safeSvgPaint =
  /^(?:#[\da-f]{3,8}|[a-z]+|currentColor|none|transparent)$/i;

const FERMATA_SVG_MARKUP =
  '<svg class="learning-fermata-symbol" viewBox="0 0 24 18" role="img" aria-label="Fermate"><path d="M3 9 C5 1 19 1 21 9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="2" fill="currentColor"/></svg>';

const theoryMarkdown = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "figure",
      "figcaption",
      "svg",
      "title",
      "desc",
      "g",
      "path",
      "line",
      "polyline",
      "polygon",
      "rect",
      "circle",
      "ellipse",
      "text",
      "tspan",
    ],
    attributes: {
      ...defaultSchema.attributes,
      code: [["className", /^language-/, "math-inline", "math-display"]],
      figure: ["ariaDescribedBy", "ariaLabel", "ariaLabelledBy"],
      svg: [
        "className",
        "viewBox",
        "role",
        "ariaLabel",
        "ariaLabelledBy",
        "ariaDescribedBy",
        "preserveAspectRatio",
      ],
      line: [
        "x1",
        "y1",
        "x2",
        "y2",
        ["stroke", safeSvgPaint],
        "strokeWidth",
        "strokeDashArray",
      ],
      path: [
        "d",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
        "strokeDashArray",
      ],
      polyline: [
        "points",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
      ],
      polygon: [
        "points",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
      ],
      rect: [
        "x",
        "y",
        "width",
        "height",
        "rx",
        "ry",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
      ],
      circle: [
        "cx",
        "cy",
        "r",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
      ],
      ellipse: [
        "cx",
        "cy",
        "rx",
        "ry",
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
      ],
      g: [
        ["fill", safeSvgPaint],
        ["stroke", safeSvgPaint],
        "strokeWidth",
        "opacity",
      ],
      text: [
        "x",
        "y",
        ["fill", safeSvgPaint],
        "fontSize",
        "fontWeight",
        "textAnchor",
      ],
      tspan: ["x", "y", "dx", "dy"],
    },
  })
  .use(rehypeKatex)
  .use(rehypeStringify);

function replaceFermataMath(node: unknown): void {
  if (!isRecord(node) || !Array.isArray(node.children)) return;
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (!isRecord(child)) continue;
    if (
      child.type === "inlineMath" &&
      typeof child.value === "string" &&
      child.value.trim() === "\\fermata"
    ) {
      node.children[index] = { type: "html", value: FERMATA_SVG_MARKUP };
    } else {
      replaceFermataMath(child);
    }
  }
}

function renderMarkdownText(markdown: string): DocumentFragment {
  const tree = theoryMarkdown.parse(markdown);
  replaceFermataMath(tree);
  for (const node of tree.children) {
    if (node.type !== "paragraph" || node.children.length !== 1) continue;
    const [math] = node.children;
    const start = math.position?.start.offset;
    // remark-math treats a same-line $$…$$ paragraph as inline math.
    if (
      math.type === "inlineMath" &&
      start !== undefined &&
      markdown.startsWith("$$", start)
    ) {
      math.data = {
        ...math.data,
        hProperties: { className: ["language-math", "math-display"] },
      };
    }
  }
  const template = document.createElement("template");
  template.innerHTML = theoryMarkdown.stringify(theoryMarkdown.runSync(tree));
  return template.content;
}

function renderTheoryKeyboard(
  props: Record<string, unknown>,
  templateRoot?: ParentNode,
): DocumentFragment {
  const { showBrace = true, rightBarStyle = "final" } = props;
  if (
    Object.keys(props).some(
      (key) => key !== "showBrace" && key !== "rightBarStyle",
    ) ||
    typeof showBrace !== "boolean" ||
    (rightBarStyle !== "single" && rightBarStyle !== "final")
  ) {
    throw new Error(
      "NotationKeyboard erwartet showBrace (boolean) und rightBarStyle (single oder final).",
    );
  }
  const selector = `template[data-visual-template="NotationKeyboard"][data-show-brace="${showBrace}"][data-right-bar-style="${rightBarStyle}"]`;
  const template =
    templateRoot?.querySelector<HTMLTemplateElement>(selector) ??
    document.querySelector<HTMLTemplateElement>(selector);
  if (!template) throw new Error("Die Keyboard-Vorlage fehlt.");
  return document.importNode(template.content, true);
}

/** Wandelt Markdown, KaTeX und sichere Visual-Elemente in DOM-Elemente um. */
export function renderTheoryMarkdown(
  markdown: string,
  templateRoot?: ParentNode,
): DocumentFragment {
  const frag = document.createDocumentFragment();
  const tokens =
    /(<!--|`+|~{3,}|\$+|<Notation(?:Keyboard)?(?=[\s/>])|<DrumPattern(?=[\s/>]))/g;
  let textStart = 0;
  for (
    let match = tokens.exec(markdown);
    match;
    match = tokens.exec(markdown)
  ) {
    const token = match[0];
    let before = match.index;
    while (before > 0 && markdown[before - 1] === "\\") before -= 1;
    const escapes = match.index - before;
    if (escapes % 2 === 1) continue;
    if (token === "<!--") {
      const end = markdown.indexOf("-->", tokens.lastIndex);
      tokens.lastIndex = end === -1 ? markdown.length : end + 3;
      continue;
    }
    if (!token.startsWith("<")) {
      const end = markdown.indexOf(token, tokens.lastIndex);
      if (end !== -1) tokens.lastIndex = end + token.length;
      continue;
    }
    frag.append(renderMarkdownText(markdown.slice(textStart, match.index)));
    try {
      if (token === "<DrumPattern") {
        const drumPattern = parseTheoryDrumPattern(
          markdown,
          match.index,
          token,
        );
        frag.append(createDrumPatternElement(drumPattern.props, templateRoot));
        tokens.lastIndex = drumPattern.end;
      } else {
        const parsed = parseTheoryNotation(markdown, match.index, token);
        frag.append(
          token === "<NotationKeyboard"
            ? renderTheoryKeyboard(parsed.props, templateRoot)
            : buildNotationVisualElement(parsed.props),
        );
        tokens.lastIndex = parsed.end;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = document.createElement("p");
      warning.className = "learning-notation-error";
      warning.textContent =
        token === "<DrumPattern"
          ? `DrumPattern konnte nicht dargestellt werden: ${message}`
          : `Notation konnte nicht dargestellt werden: ${message}`;
      frag.append(warning);
      const end = markdown.indexOf("/>", match.index);
      tokens.lastIndex = end === -1 ? markdown.length : end + 2;
    }
    textStart = tokens.lastIndex;
  }
  frag.append(renderMarkdownText(markdown.slice(textStart)));
  initializeDrumPatterns(frag);
  return frag;
}

export function renderQuestionPrompt(
  prompt: string,
  templateRoot?: ParentNode,
): HTMLElement {
  const content = document.createElement("div");
  content.className = "learning-quiz-question";
  content.append(renderTheoryMarkdown(prompt, templateRoot));
  return content;
}

function buildNotationVisualElement(
  rawProps: Record<string, unknown>,
): HTMLElement {
  if (
    rawProps.clef !== undefined &&
    rawProps.clef !== "treble" &&
    rawProps.clef !== "bass" &&
    rawProps.clef !== false
  ) {
    throw new Error("Der Notenschlüssel muss treble, bass oder false sein.");
  }
  if (
    (rawProps.notes !== undefined && !Array.isArray(rawProps.notes)) ||
    (rawProps.measures !== undefined && !Array.isArray(rawProps.measures)) ||
    (rawProps.notes !== undefined && rawProps.measures !== undefined)
  ) {
    throw new Error("notes oder measures muss ein Array sein, nicht beides.");
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
        firstNoteX: measure.firstNoteX,
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

export function renderTheoryVisualElement(
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
    try {
      const rawProps: unknown = block.visualPropsJson?.trim()
        ? JSON.parse(block.visualPropsJson)
        : {};
      if (!isRecord(rawProps))
        throw new Error("Die Visual-Props müssen ein Objekt sein.");
      if (hasEquivalentNotation(block.markdownContent, rawProps)) return null;
      host.append(buildNotationVisualElement(rawProps));
    } catch (error) {
      const warning = document.createElement("p");
      warning.className = "learning-notation-error";
      warning.textContent = `Notation konnte nicht dargestellt werden: ${error instanceof Error ? error.message : String(error)}`;
      host.append(warning);
    }
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
  showSolution = false,
): HTMLElement {
  const solutionNotes = showSolution ? getNotationSolutionNotes(task) : [];
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
      if (solutionNotes.length > 0) {
        const config = JSON.parse(
          presetRoot.dataset.builderConfig ?? "{}",
        ) as NotationBuilderConfig;
        config.notes = solutionNotes;
        presetRoot.dataset.builderConfig = JSON.stringify(config);
      }
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
    ...(solutionNotes.length > 0 ? { notes: solutionNotes } : {}),
    showDurationPicker: task.showDurationPicker ?? false,
    compact: task.compact ?? false,
  };

  const maxNotes = Math.max(1, config.maxNotes ?? 1);
  const cursorStep = DEFAULT_NOTATION_STEP;
  const placedNotes = Array.from(
    { length: maxNotes },
    (_, index) => solutionNotes[index] ?? null,
  );
  const activeDuration: Duration =
    typeof config.lockDuration === "string"
      ? config.lockDuration
      : (config.initialDuration ?? "quarter");
  const isCompact = Boolean(config.compact);
  const showHints = task.showHints ?? true;

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

function getNotationSolutionNotes(
  task: NotationBuilderTaskConfig,
): NotationNote[] {
  const pitches = task.expectedPitches ?? [];
  const steps = pitches.map((pitch) => pitchNameToStep(pitch, task.clef));
  if (steps.length === 0 || !steps.every((step) => step !== undefined)) {
    return [];
  }

  const durations: Duration[] = [
    "whole",
    "half",
    "quarter",
    "eighth",
    "sixteenth",
  ];
  const validSteps = steps.filter((step): step is number => step !== undefined);
  return validSteps.map((step, index) => {
    const expectedDuration = task.expectedDurations?.[index];
    const duration =
      durations.find((item) => item === expectedDuration) ??
      (typeof task.lockDuration === "string" ? task.lockDuration : "quarter");
    return { step, duration };
  });
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
  showSolution = false,
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
      input.checked =
        showSolution &&
        question.correctAnswers.some(
          (answer) => normalizeText(answer) === normalizeText(option),
        );
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
    const unit = getNumericQuestionUnit(question);
    if (unit) {
      const field = document.createElement("label");
      field.className = "learning-numeric-field";
      const suffix = document.createElement("span");
      suffix.className = "learning-numeric-unit";
      suffix.textContent = unit;
      suffix.setAttribute("aria-hidden", "true");
      input.inputMode = "decimal";
      input.setAttribute("aria-label", `${question.prompt} Einheit: ${unit}`);
      if (showSolution) {
        const numericSolution = question.correctAnswers
          .map(parseNumericAndUnit)
          .find(
            (parsed) =>
              parsed.num !== null &&
              (!parsed.unit ||
                normalizeText(parsed.unit) === normalizeText(unit)),
          );
        input.value = numericSolution?.numericText ?? "";
      }
      field.append(input, suffix);
      container.append(field);
    } else {
      input.placeholder = "Antwort eingeben";
      input.setAttribute("aria-label", question.prompt);
      if (showSolution) input.value = question.correctAnswers[0] ?? "";
      container.append(input);
    }
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
        showSolution,
      ),
    );
    return container;
  }

  return container;
}

function formatExerciseSolution(question: ModuleQuestion): string {
  if (question.questionType !== "interactive_notation") {
    return question.correctAnswers.join(
      question.questionType === "multi_select" ? ", " : " oder ",
    );
  }
  const task = question.notationTask;
  const parts: string[] = [];
  if (task?.expectedPitches?.length) {
    parts.push(`Tonhöhen: ${task.expectedPitches.join(", ")}`);
  }
  if (task?.expectedDurations?.length) {
    parts.push(`Notenwerte: ${task.expectedDurations.join(", ")}`);
  }
  return parts.join("; ");
}

function createProgressResetControls(getDatabase: () => ModulesDatabase) {
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
    "Den gesamten Lernfortschritt zurücksetzen? Alle XP gehen verloren.";
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
    confirmCancel.focus();
  });
  confirmCancel.addEventListener("click", () => {
    confirmBox.hidden = true;
    resetBtn.hidden = false;
    resetBtn.focus();
  });
  confirmYes.addEventListener("click", () => {
    const db = getDatabase();
    clearLearningProgress();
    commitProgressChange(
      createInitialProgress(db.modules, db.quizSettings),
      db,
      "reset",
    );
  });

  const controls = document.createDocumentFragment();
  controls.append(resetBtn, confirmBox);
  return controls;
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
  const showDetails =
    options.showDetails ?? root.dataset.showDetails === "true";

  const render = () => {
    const state = loadLearningProgress(
      currentDb.modules,
      undefined,
      currentDb.quizSettings,
    );
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
    const modBar = createBlueProgressBar(
      "Abgeschlossene Module",
      overview.overallPercent,
    );
    const modSub = document.createElement("span");
    modSub.className = "learning-metric-sub";
    modSub.textContent = "Normal-Pfad oder Fastlane";
    modBox.append(modLabel, modValue, modBar, modSub);

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
    fill.className = "learning-progress-bar-fill learning-module-stat-bar-fill";
    fill.style.width = `${overview.levelProgressPercent}%`;
    progressTrack.append(fill);

    const syncedState = syncProgressWithCurriculum(state, currentDb.modules);
    const moduleBarsGroup = document.createElement("div");
    moduleBarsGroup.className = "learning-dashboard-module-bars";
    const sortedModules = sortModules(currentDb.modules);
    moduleBarsGroup.hidden = !showDetails || sortedModules.length === 0;
    if (sortedModules.length > 0) {
      const moduleBarsHeading = document.createElement("h3");
      moduleBarsHeading.className = "learning-breakdown-heading";
      moduleBarsHeading.textContent = "Fortschritt je Modul";
      moduleBarsGroup.append(moduleBarsHeading);

      for (const mod of sortedModules) {
        const modQuestions = currentDb.questions.filter((q) =>
          isQuestionInModule(q, mod.id),
        );
        const stats = computeModuleStats(
          mod,
          modQuestions,
          syncedState.modules[mod.id],
        );
        const row = document.createElement("div");
        row.className = "learning-dashboard-module-row";
        row.dataset.dashboardModuleBar = mod.id;

        const labelRow = document.createElement("div");
        labelRow.className = "learning-dashboard-module-row-header";
        const modTitle = document.createElement("span");
        modTitle.textContent = `${mod.order}. ${mod.title}`;
        const modPct = document.createElement("span");
        modPct.textContent = `${stats.overallPercent} %`;
        labelRow.append(modTitle, modPct);

        row.append(
          labelRow,
          createBlueProgressBar(
            `${mod.order}. ${mod.title}`,
            stats.overallPercent,
          ),
        );
        moduleBarsGroup.append(row);
      }
    }

    const scopeGroup = document.createElement("div");
    scopeGroup.className = "learning-breakdown-group";
    scopeGroup.hidden = !showDetails;
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
    tagGroup.hidden = !showDetails;
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
    resetArea.hidden = !showDetails;

    resetArea.append(createProgressResetControls(() => currentDb));
    card.append(
      header,
      metrics,
      progressTrack,
      moduleBarsGroup,
      scopeGroup,
      tagGroup,
      resetArea,
    );
    root.append(card);
  };

  const renderInitialCatalog = canRenderInitialCatalog(root, options);
  if (renderInitialCatalog) render();

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
      currentDb = getLearningCatalog(
        event.detail.db as unknown as ModulesDatabase,
      );
    }
    render();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb) {
        currentDb = liveDb;
        render();
      } else if (!renderInitialCatalog) {
        showCatalogStatus(root, catalogLoadError);
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
 * Rendert die nach `order` sortierten Modul-Karten inklusive Fortschritts-Kennzahlen
 * (Theorieteile, offene Aufgaben, Quiz) sowie den Aktionen
 * („Lektion öffnen“, „Quiz starten“ und „Lernfortschritt zurücksetzen“).
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
      loadLearningProgress(
        currentDb.modules,
        undefined,
        currentDb.quizSettings,
      ),
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
      const modQuestions = currentDb.questions.filter((q) =>
        isQuestionInModule(q, mod.id),
      );

      const card = document.createElement("li");
      card.className = "learning-roadmap-card";
      card.dataset.moduleCard = mod.id;
      card.dataset.moduleStatus = modStatus;

      const header = document.createElement("div");
      header.className = "learning-card-header";
      header.hidden = true;

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "learning-badge-row";
      badgeGroup.hidden = true;

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

      const {
        completedTheory,
        totalTheory,
        completedExercises,
        totalExercises,
        quizDone,
        quizReady,
        overallPercent,
      } = computeModuleStats(mod, modQuestions, modProgress);

      const overallBox = document.createElement("div");
      overallBox.className =
        "learning-module-stat learning-module-overall-stat";
      overallBox.dataset.roadmapStat = "module-overall";
      const overallLabel = document.createElement("span");
      overallLabel.className = "learning-module-stat-label";
      overallLabel.textContent = `Gesamtfortschritt ${overallPercent} %`;
      overallBox.append(
        overallLabel,
        createBlueProgressBar(`Gesamtfortschritt ${mod.title}`, overallPercent),
      );

      const stats = document.createElement("div");
      stats.className = "learning-module-progress-stats";

      const createRoadmapStatBox = (
        key: "theory" | "exercises" | "quiz",
        label: string,
        done: number,
        total: number,
      ): HTMLDivElement => {
        const percent =
          total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const box = document.createElement("div");
        box.className = "learning-module-stat";
        box.dataset.roadmapStat = key;

        const labelEl = document.createElement("span");
        labelEl.className = "learning-module-stat-label";
        labelEl.textContent = label;

        box.append(labelEl, createBlueProgressBar(label, percent));
        return box;
      };

      const theoryStat = createRoadmapStatBox(
        "theory",
        `Theorie ${completedTheory}/${totalTheory}`,
        completedTheory,
        totalTheory,
      );
      const exerciseStat = createRoadmapStatBox(
        "exercises",
        `Aufgaben ${completedExercises}/${totalExercises}`,
        completedExercises,
        totalExercises,
      );
      const quizStat = createRoadmapStatBox(
        "quiz",
        `Quiz ${quizDone ? 1 : 0}/1`,
        quizDone ? 1 : 0,
        1,
      );
      quizStat.dataset.quizStatus = quizDone ? "completed" : "open";

      stats.append(theoryStat, exerciseStat, quizStat);

      const actions = document.createElement("div");
      actions.className = "learning-roadmap-actions";

      const openLink = document.createElement("a");
      openLink.className =
        "learning-link-btn learning-link-btn-primary learning-open-lesson";
      openLink.href = getLessonUrl(lessonBaseUrl, mod.id);
      openLink.textContent = "Lektion öffnen";
      actions.append(openLink);

      if (quizReady) {
        const quizLink = document.createElement("a");
        quizLink.className = "learning-link-btn learning-start-quiz";
        quizLink.href = `${getLessonUrl(lessonBaseUrl, mod.id)}#quiz-step`;
        quizLink.textContent = quizDone ? "Quiz wiederholen" : "Quiz starten";
        actions.append(quizLink);
      } else {
        const quizDisabledBtn = document.createElement("button");
        quizDisabledBtn.type = "button";
        quizDisabledBtn.className = "learning-btn learning-start-quiz";
        quizDisabledBtn.disabled = true;
        quizDisabledBtn.setAttribute("aria-disabled", "true");
        quizDisabledBtn.textContent = "Quiz starten";
        actions.append(quizDisabledBtn);
      }

      actions.append(createProgressResetControls(() => currentDb));

      const fastlaneLink = document.createElement("a");
      fastlaneLink.className =
        "learning-link-btn learning-link-btn-fastlane learning-open-fastlane";
      fastlaneLink.href = getLessonUrl(lessonBaseUrl, mod.id, "fastlane");
      fastlaneLink.hidden = true;
      fastlaneLink.textContent = "⚡ Fastlane (Schweres Quiz)";
      actions.append(fastlaneLink);

      card.append(header, title, desc, overallBox, stats, actions);
      list.append(card);
    }

    root.append(list);
  };

  const renderInitialCatalog = canRenderInitialCatalog(root, options);
  if (renderInitialCatalog) render();

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
      currentDb = getLearningCatalog(
        event.detail.db as unknown as ModulesDatabase,
      );
    }
    render();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb) {
        currentDb = liveDb;
        render();
      } else if (!renderInitialCatalog) {
        showCatalogStatus(root, catalogLoadError);
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
  exerciseId?: string;
  exerciseTitleInSection?: boolean;
  templateRoot?: ParentNode;
  lessonBaseUrl?: string;
}

function computeRemainingModuleXp(
  state: LearningProgressState,
  db: ModulesDatabase,
  mod: LearningModule,
  mode: "mittel" | "schwer",
): number {
  const modProgress = state.modules[mod.id];
  const solvedSet = new Set(modProgress?.solvedQuestionIds ?? []);

  if (mode === "mittel") {
    return db.questions
      .filter(
        (q) =>
          isQuestionInModule(q, mod.id) &&
          q.targetLane === "mittel" &&
          !solvedSet.has(q.id),
      )
      .reduce((sum, q) => sum + calculateModuleQuestionXp(q), 0);
  }

  let openXp = 0;
  if (modProgress?.steps.theory !== "completed") {
    const completed = new Set(modProgress?.completedTheoryBlockIds ?? []);
    for (const block of mod.theoryBlocks) {
      if (!completed.has(block.id)) {
        openXp += calculateTheoryBlockXp(block, mod.theoryBaseXp);
      }
    }
  }
  const completedPractice = new Set(
    modProgress?.completedPracticeBlockIds ?? [],
  );
  for (const block of mod.practiceBlocks) {
    if (!completedPractice.has(block.id)) {
      openXp += calculateTheoryBlockXp(block, BASE_XP_DEFAULTS.practice);
    }
  }
  for (const q of db.questions) {
    if (isQuestionInModule(q, mod.id) && !solvedSet.has(q.id)) {
      openXp += calculateModuleQuestionXp(q);
    }
  }
  return openXp;
}

/**
 * Bindet den interaktiven Aufgaben- & Prüfungs-Runner (`leicht`, `mittel`, `schwer`)
 * an ein Container-Element.
 */
export async function attachStandaloneModuleQuizRunner(
  root: HTMLElement,
): Promise<void> {
  if (root.dataset.quizRunnerAttached === "true") return;
  root.dataset.quizRunnerAttached = "true";

  const db = await fetchLiveModulesDatabase();
  if (!db) {
    showCatalogStatus(root, catalogLoadError);
    return;
  }
  const mod = db.modules.find((item) => item.id === root.dataset.moduleId);
  if (!mod) {
    showCatalogStatus(root, "Das Lernmodul wurde nicht gefunden.");
    return;
  }

  const rawMode = root.dataset.mode;
  const mode =
    rawMode === "leicht" || rawMode === "schwer" ? rawMode : "mittel";
  attachModuleQuizRunner(root, { module: mod, db, mode });
}

export function attachModuleQuizRunner(
  container: HTMLElement,
  config: QuizRunnerMountConfig,
): void {
  const { module: mod, db, mode, templateRoot } = config;
  const lessonBaseUrl = config.lessonBaseUrl ?? "/audio/theory/modul/";
  const questions = db.questions.filter(
    (q) =>
      isQuestionInModule(q, mod.id) &&
      q.targetLane === mode &&
      (mode !== "leicht" || !config.exerciseId || q.id === config.exerciseId),
  );

  container.replaceChildren();
  container.classList.add("learning-quiz-runner");
  container.dataset.quizMode = mode;

  if (mode === "leicht") {
    if (config.exerciseId && questions.length === 0) {
      throw new Error("Die Übung für diesen Abschnitt wurde nicht gefunden.");
    }
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
        const current = loadLearningProgress(
          db.modules,
          undefined,
          db.quizSettings,
        );
        const dummyQuestion: ModuleQuestion = {
          id: `__empty_${mod.id}`,
          moduleIds: [mod.id],
          targetLane: "leicht",
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

    const currentProgress = loadLearningProgress(
      db.modules,
      undefined,
      db.quizSettings,
    );
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
      const showExerciseTitle =
        config.exerciseId && !config.exerciseTitleInSection;
      qTitle.textContent = config.exerciseId
        ? showExerciseTitle
          ? question.title?.trim()
            ? formatExerciseTitle(question.title)
            : "Aufgabe"
          : "Aufgabenstellung"
        : `Aufgabe ${index + 1} / ${questions.length}`;
      const qXp = document.createElement("span");
      qXp.className = "contribution-tag learning-xp-badge";
      const questionXp = calculateModuleQuestionXp(question);
      if (solvedSet.has(question.id)) qXp.classList.add("has-xp");
      qXp.textContent = solvedSet.has(question.id)
        ? `${questionXp} XP`
        : `+${questionXp} XP`;
      qHeader.append(qTitle, qXp);

      const alreadyCompleted = solvedSet.has(question.id);
      const inputsEl = renderQuestionInputBlock(
        question,
        `ex-${mod.id}`,
        templateRoot,
        alreadyCompleted,
      );

      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "learning-btn learning-btn-primary";
      checkBtn.dataset.action = "check-exercise";
      checkBtn.textContent = "Antwort prüfen";

      const feedback = document.createElement("div");
      feedback.className = "learning-feedback";
      feedback.hidden = !alreadyCompleted;
      feedback.setAttribute("aria-live", "polite");
      const missingAnswer = document.createElement("p");
      missingAnswer.textContent = "Bitte gib zuerst eine Antwort ein.";
      if (alreadyCompleted) {
        inputsEl.inert = true;
        inputsEl
          .querySelectorAll<
            | HTMLInputElement
            | HTMLButtonElement
            | HTMLSelectElement
            | HTMLTextAreaElement
          >("input, button, select, textarea")
          .forEach((input) => {
            input.disabled = true;
          });
        checkBtn.disabled = true;
        checkBtn.textContent = "Bereits abgeschlossen";
        const solution = formatExerciseSolution(question);
        feedback.textContent = solution
          ? `Diese Aufgabe wurde bereits abgeschlossen. Lösung: ${solution}.`
          : "Diese Aufgabe wurde bereits abgeschlossen und muss nicht erneut beantwortet werden.";
      }
      let attempts = 0;
      let completed = alreadyCompleted;

      checkBtn.addEventListener("click", () => {
        if (completed) return;
        const userAnswer = readUserAnswerFromQuestionUi(question, inputsEl);
        const hasAnswer =
          userAnswer.kind === "choice"
            ? userAnswer.selected.length > 0
            : userAnswer.kind === "numeric"
              ? userAnswer.value.trim().length > 0
              : userAnswer.pitches.length > 0;
        if (!hasAnswer) {
          feedback.hidden = false;
          feedback.dataset.outcome = "wrong";
          feedback.append(missingAnswer);
          return;
        }
        attempts += 1;
        const result = evaluateQuestionAnswer(question, userAnswer);
        const exhausted = !result.correct && attempts >= 3;
        feedback.hidden = false;
        feedback.replaceChildren();

        const titleEl = document.createElement("strong");
        if (result.correct || exhausted) {
          completed = true;
          checkBtn.disabled = true;
          feedback.dataset.outcome = result.correct ? "correct" : "wrong";
          const latest = loadLearningProgress(
            db.modules,
            undefined,
            db.quizSettings,
          );
          playEquippedTaskSound(latest);
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
          qXp.classList.add("has-xp");
          qXp.textContent = `${questionXp} XP`;
          titleEl.textContent = result.correct
            ? alreadySolved
              ? "✓ Richtig gelöst (XP bereits erhalten)."
              : `✓ Richtig! +${questionXp} XP gutgeschrieben.`
            : alreadySolved
              ? "✗ Drei Versuche verbraucht (XP bereits erhalten)."
              : `✗ Drei Versuche verbraucht. +${questionXp} XP gutgeschrieben.`;
          feedback.append(titleEl);
          if (exhausted) {
            const solutionEl = document.createElement("p");
            solutionEl.className = "learning-feedback-explanation";
            solutionEl.textContent = `Richtige Antwort: ${formatExerciseSolution(question)}`;
            feedback.append(solutionEl);
            const expEl = document.createElement("p");
            expEl.className = "learning-feedback-explanation";
            expEl.textContent =
              result.explanation || "Keine Erklärung hinterlegt.";
            feedback.append(expEl);
          }
          commitProgressChange(updated, db);
        } else {
          feedback.dataset.outcome = "wrong";
          titleEl.textContent = `✗ Noch nicht richtig – ${3 - attempts} ${attempts === 2 ? "Versuch" : "Versuche"} übrig.`;
          feedback.append(titleEl);
          if (attempts === 2) {
            if (question.simpleHint?.trim()) {
              const hint = document.createElement("p");
              hint.textContent = `Hinweis: ${question.simpleHint}`;
              feedback.append(hint);
            }
            if (question.strongHint?.trim()) {
              const details = document.createElement("details");
              const summary = document.createElement("summary");
              summary.textContent = "Stärkeren Hinweis anzeigen";
              const hint = document.createElement("p");
              hint.textContent = question.strongHint;
              details.append(summary, hint);
              feedback.append(details);
            }
          }
        }
      });

      qCard.append(qHeader);
      qCard.append(renderQuestionPrompt(question.prompt, templateRoot));
      qCard.append(inputsEl, checkBtn, feedback);
      container.append(qCard);
    });
    return;
  }

  if (questions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "learning-muted";
    empty.textContent =
      mode === "schwer"
        ? "Für den Fastlane-Test dieses Moduls wurden noch keine Fragen hinterlegt."
        : "Für das Quiz dieses Moduls wurden noch keine Fragen hinterlegt.";
    container.append(empty);
    return;
  }

  const settings = getEffectiveQuizSettings(
    loadLearningProgress(db.modules, undefined, db.quizSettings),
    db,
  );
  const threshold =
    mode === "schwer" ? settings.fastlaneMinScore : settings.quizEasyMinScore;
  const thresholdPct = Math.round(threshold * 100);
  let currentIndex = 0;
  let correctCount = 0;
  let currentQuestionChecked = false;

  const renderExamStep = () => {
    container.replaceChildren();
    const state = loadLearningProgress(db.modules, undefined, db.quizSettings);
    const openXp = computeRemainingModuleXp(state, db, mod, mode);

    const examCard = document.createElement("div");
    examCard.className = "learning-quiz-card";

    const header = document.createElement("div");
    header.className = "learning-card-header";
    const heading = document.createElement("h4");
    heading.style.margin = "0";
    heading.textContent =
      mode === "schwer"
        ? `⚡ Fastlane-Prüfung (Benötigt: ${thresholdPct} %)`
        : `Quiz (Benötigt: ${thresholdPct} %)`;
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
    const promptEl = document.createElement("div");
    promptEl.className = "learning-quiz-question";
    promptEl.style.fontWeight = "600";
    promptEl.style.margin = "0";
    promptEl.append(renderTheoryMarkdown(question.prompt, templateRoot));

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
      playEquippedTaskSound(
        loadLearningProgress(db.modules, undefined, db.quizSettings),
      );
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
      const before = loadLearningProgress(
        db.modules,
        undefined,
        db.quizSettings,
      );
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

function isLessonSectionComplete(
  section: LessonSection,
  progress: ModuleProgress,
): boolean {
  const isExerciseComplete = (question: ModuleQuestion) =>
    progress.steps.leicht === "completed" ||
    progress.solvedQuestionIds.includes(question.id);
  const practiceDone = (block: PracticeBlock) =>
    progress.completedPracticeBlockIds.includes(block.id);
  switch (section.kind) {
    case "theory":
      return (
        progress.steps.theory === "completed" ||
        section.blocks.every(
          (block) =>
            block.role === "exercise_intro" ||
            progress.completedTheoryBlockIds.includes(block.id),
        )
      );
    case "exercise":
      return isExerciseComplete(section.question);
    case "group": {
      const blocks = section.items
        .filter((item) => item.kind === "theory")
        .map((item) => item.block)
        .filter((block) => block.role !== "exercise_intro");
      const questions = section.items
        .filter((item) => item.kind === "exercise")
        .map((item) => item.question);
      const practices = section.items
        .filter((item) => item.kind === "practice")
        .map((item) => item.block);
      return (
        (blocks.length === 0 ||
          progress.steps.theory === "completed" ||
          blocks.every((block) =>
            progress.completedTheoryBlockIds.includes(block.id),
          )) &&
        (questions.length === 0 || questions.every(isExerciseComplete)) &&
        practices.every(practiceDone)
      );
    }
    case "practice":
      return practiceDone(section.block);
    case "quiz":
      return progress.steps.mittel === "completed";
  }
}

function hasIncompleteLessonTask(
  section: LessonSection,
  progress: ModuleProgress,
): boolean {
  const exercisePending = (question: ModuleQuestion) =>
    progress.steps.leicht !== "completed" &&
    !progress.solvedQuestionIds.includes(question.id);
  const practicePending = (block: PracticeBlock) =>
    !progress.completedPracticeBlockIds.includes(block.id);

  switch (section.kind) {
    case "exercise":
      return exercisePending(section.question);
    case "practice":
      return practicePending(section.block);
    case "group":
      return section.items.some(
        (item) =>
          (item.kind === "exercise" && exercisePending(item.question)) ||
          (item.kind === "practice" && practicePending(item.block)),
      );
    default:
      return false;
  }
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

  let updateCurrentSection = () => {};

  const fullRender = () => {
    updateCurrentSection = () => {};
    const { mod, mode } = resolveModuleAndMode();
    let state = syncProgressWithCurriculum(
      loadLearningProgress(
        currentDb.modules,
        undefined,
        currentDb.quizSettings,
      ),
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

    if (mode === "normal") {
      const reconciled = completeTheoryStep(state, mod, currentDb.questions);
      if (reconciled !== state) {
        state = reconciled;
        commitProgressChange(state, currentDb);
      }
    }
    const modProgress = state.modules[mod.id];

    const headerTop = document.createElement("header");
    headerTop.className = "learning-lesson-header";
    const title = document.createElement("h2");
    title.className = "learning-card-title";
    title.textContent = mod.title;
    const modeActions = document.createElement("div");
    modeActions.className = "learning-stepper-header-actions";

    if (mode === "fastlane") {
      const normalLink = document.createElement("a");
      normalLink.className = "learning-link-btn";
      normalLink.href = getLessonUrl(lessonBaseUrl, mod.id);
      normalLink.textContent = "Zum regulären Lernpfad";
      modeActions.append(normalLink);
    } else {
      const fastlaneLink = document.createElement("a");
      fastlaneLink.className =
        "learning-link-btn learning-link-btn-fastlane learning-open-fastlane";
      fastlaneLink.href = getLessonUrl(lessonBaseUrl, mod.id, "fastlane");
      fastlaneLink.hidden = true;
      fastlaneLink.textContent = "⚡ Direkt zum Fastlane-Test";
      modeActions.append(fastlaneLink);
    }

    headerTop.append(title, modeActions);
    contentHost.append(headerTop);

    if (mode === "fastlane") {
      const runnerContainer = document.createElement("div");
      attachModuleQuizRunner(runnerContainer, {
        module: mod,
        db: currentDb,
        mode: "schwer",
        templateRoot: root,
        lessonBaseUrl,
      });
      contentHost.append(runnerContainer);
      return;
    }

    if (!modProgress || modProgress.status === "locked") {
      const locked = document.createElement("p");
      locked.className = "learning-step-lock-notice";
      locked.textContent =
        "🔒 Dieses Modul ist noch gesperrt. Schließe zuerst das vorherige Modul ab.";
      contentHost.append(locked);
      updateCurrentSection = () => {
        const latest = loadLearningProgress(
          currentDb.modules,
          undefined,
          currentDb.quizSettings,
        ).modules[mod.id];
        if (latest && latest.status !== "locked") fullRender();
      };
      return;
    }

    renderSequence(contentHost, mod, modProgress);
  };

  function renderSequence(
    host: HTMLElement,
    mod: LearningModule,
    initialProgress: ModuleProgress,
  ): void {
    const sections = buildLessonSections(mod, currentDb.questions);
    if (sections.length === 0) {
      const empty = document.createElement("p");
      empty.className = "learning-muted";
      empty.textContent =
        "Für dieses Modul sind noch keine Lerninhalte vorhanden.";
      host.append(empty);
      return;
    }
    const sectionTitles = sections.map(
      (section, position) =>
        `${mod.level + position + 1}: ${getLessonSectionTitle(section)}`,
    );
    const firstIncomplete = sections.findIndex(
      (section) => !isLessonSectionComplete(section, initialProgress),
    );
    let index = firstIncomplete === -1 ? sections.length - 1 : firstIncomplete;
    if (
      typeof window !== "undefined" &&
      window.location.hash === "#quiz-step" &&
      sections.some((section) => section.kind === "quiz") &&
      initialProgress.steps.mittel !== "locked"
    ) {
      index = sections.length - 1;
    }

    const sequenceHost = document.createElement("div");
    sequenceHost.className = "learning-lesson-sequence";
    const lessonContent = document.createElement("div");
    lessonContent.className = "learning-lesson-content";
    const sidebar = document.createElement("nav");
    sidebar.className = "learning-lesson-sidebar";
    sidebar.setAttribute("aria-label", "Lektionsschritte");
    const sidebarTitle = document.createElement("h4");
    sidebarTitle.className = "learning-lesson-sidebar-title";
    sidebarTitle.textContent = "Lektionsschritte";
    const stepList = document.createElement("ol");
    stepList.className = "learning-lesson-step-list";
    sidebar.append(sidebarTitle, stepList);
    sequenceHost.append(lessonContent, sidebar);
    host.append(sequenceHost);

    const renderSidebar = (progress: ModuleProgress) => {
      stepList.replaceChildren();
      sections.forEach((section, stepIndex) => {
        const label = sectionTitles[stepIndex];
        const completed = isLessonSectionComplete(section, progress);
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "learning-lesson-step";
        button.dataset.stepIndex = String(stepIndex);
        button.dataset.stepCompleted = String(completed);
        const backLocked =
          stepIndex < index &&
          hasIncompleteLessonTask(sections[index], progress);
        button.disabled = !completed || backLocked;
        if (stepIndex === index) {
          button.classList.add("is-current");
          button.setAttribute("aria-current", "step");
        }
        button.setAttribute(
          "aria-label",
          `${label} (${completed ? "abgeschlossen" : "nicht abgeschlossen"}${backLocked ? ", Rücksprung wegen offener Aufgabe gesperrt" : ""})`,
        );
        if (backLocked) {
          button.title =
            "Erledige die aktuelle Aufgabe, bevor du zurückspringst.";
        }
        button.textContent = label;
        button.addEventListener("click", () => {
          const latest = loadLearningProgress(
            currentDb.modules,
            undefined,
            currentDb.quizSettings,
          ).modules[mod.id];
          if (
            !latest ||
            !isLessonSectionComplete(section, latest) ||
            (stepIndex < index &&
              hasIncompleteLessonTask(sections[index], latest))
          ) {
            return;
          }
          index = stepIndex;
          renderCurrent(true);
        });
        item.append(button);
        stepList.append(item);
      });
    };

    const renderCurrent = (focusHeading = false) => {
      const section = sections[index];
      const progress = loadLearningProgress(
        currentDb.modules,
        undefined,
        currentDb.quizSettings,
      ).modules[mod.id];
      if (!progress) {
        fullRender();
        return;
      }

      lessonContent.replaceChildren();
      renderSidebar(progress);
      const counter = document.createElement("p");
      counter.className = "learning-lesson-counter";
      counter.textContent = `Abschnitt ${index + 1} / ${sections.length}`;
      let progressBar = createBlueProgressBar(
        "Abschnittsfortschritt",
        (sections.filter((item) => isLessonSectionComplete(item, progress))
          .length /
          sections.length) *
          100,
      );
      const card = document.createElement("section");
      card.className = "learning-step-section";
      card.dataset.step = section.kind;
      card.dataset.lessonSection = String(index + 1);
      if (section.kind === "quiz") card.id = "quiz-step";

      const heading = document.createElement("h3");
      heading.className = "learning-lesson-heading";
      heading.tabIndex = -1;
      heading.textContent =
        section.kind === "exercise"
          ? getLessonSectionTitle(section)
          : sectionTitles[index];
      card.append(heading);

      let completeButton: HTMLButtonElement | null = null;
      const practiceButtons: Array<{
        block: PracticeBlock;
        button: HTMLButtonElement;
      }> = [];
      if (
        section.kind === "theory" ||
        section.kind === "group" ||
        section.kind === "practice"
      ) {
        const grouped = section.kind === "group";
        const contentItems: LessonItem[] =
          section.kind === "group"
            ? section.items
            : section.kind === "practice"
              ? [{ kind: "practice", block: section.block }]
              : section.blocks.map((block) => ({ kind: "theory", block }));
        const blocks = contentItems.flatMap((item) =>
          item.kind === "theory" ? [item.block] : [],
        );
        const completableBlocks = blocks.filter(
          (block) => block.role !== "exercise_intro",
        );
        const questions = contentItems.flatMap((item) =>
          item.kind === "exercise" ? [item.question] : [],
        );
        const practices = contentItems.flatMap((item) =>
          item.kind === "practice" ? [item.block] : [],
        );
        const wrap = document.createElement(grouped ? "section" : "div");
        wrap.className = grouped
          ? practices.length > 0
            ? "learning-content-group"
            : blocks.length > 0 && questions.length === 0
              ? "learning-theory-group"
              : questions.length > 0 && blocks.length === 0
                ? "learning-exercise-group"
                : "learning-content-group"
          : "learning-theory-blocks";
        const blocksHost = document.createElement("div");
        blocksHost.className = grouped
          ? "learning-theory-group-blocks"
          : "learning-theory-blocks";
        if (grouped) {
          const headingRow = document.createElement("div");
          headingRow.className = "learning-theory-heading";
          const groupXp =
            blocks.reduce(
              (total, block) =>
                total + calculateTheoryBlockXp(block, mod.theoryBaseXp),
              0,
            ) +
            questions.reduce(
              (total, question) => total + calculateModuleQuestionXp(question),
              0,
            ) +
            practices.reduce(
              (total, block) =>
                total +
                calculateTheoryBlockXp(block, BASE_XP_DEFAULTS.practice),
              0,
            );
          headingRow.append(heading, createXpBadge(groupXp));
          wrap.append(headingRow);
        }
        for (const item of contentItems) {
          if (item.kind === "theory") {
            const block = item.block;
            const blockEl = document.createElement("article");
            blockEl.className = "learning-theory-block";
            if (grouped) {
              const blockTitle = document.createElement("h4");
              blockTitle.className = "learning-theory-block-title";
              blockTitle.textContent = cleanLessonTitle(block.title);
              blockEl.append(blockTitle);
            } else {
              const headingRow = document.createElement("div");
              headingRow.className = "learning-theory-heading";
              headingRow.append(heading);
              if (block.role !== "exercise_intro") {
                headingRow.append(
                  createXpBadge(
                    calculateTheoryBlockXp(block, mod.theoryBaseXp),
                  ),
                );
              }
              blockEl.append(headingRow);
            }
            const markdown = document.createElement("div");
            markdown.className = "learning-theory-markdown";
            markdown.append(renderTheoryMarkdown(block.markdownContent, root));
            blockEl.append(markdown);
            const visual = renderTheoryVisualElement(block, root);
            if (visual) blockEl.append(visual);
            blocksHost.append(blockEl);
          } else if (item.kind === "practice") {
            const block = item.block;
            const blockEl = document.createElement("article");
            blockEl.className = "learning-theory-block learning-practice-block";
            blockEl.dataset.practiceBlock = block.id;
            const blockTitle = grouped ? document.createElement("h4") : heading;
            if (grouped) {
              blockTitle.className = "learning-theory-block-title";
              blockTitle.textContent = cleanLessonTitle(block.title);
            }
            const headingRow = document.createElement("div");
            headingRow.className = "learning-theory-heading";
            headingRow.append(
              blockTitle,
              createXpBadge(
                calculateTheoryBlockXp(block, BASE_XP_DEFAULTS.practice),
              ),
            );
            const markdown = document.createElement("div");
            markdown.className = "learning-theory-markdown";
            markdown.append(renderTheoryMarkdown(block.markdownContent, root));
            const practiceButton = document.createElement("button");
            practiceButton.type = "button";
            practiceButton.className = "learning-btn learning-btn-primary";
            practiceButton.dataset.action = "complete-practice";
            practiceButton.addEventListener("click", () => {
              const latest = loadLearningProgress(
                currentDb.modules,
                undefined,
                currentDb.quizSettings,
              );
              commitProgressChange(
                completePracticeBlock(latest, mod, block.id),
                currentDb,
              );
            });
            practiceButtons.push({ block, button: practiceButton });
            blockEl.append(headingRow, markdown, practiceButton);
            blocksHost.append(blockEl);
          } else {
            const exercise = document.createElement("div");
            exercise.className = "learning-exercise-group-item";
            attachModuleQuizRunner(exercise, {
              module: mod,
              db: currentDb,
              mode: "leicht",
              exerciseId: item.question.id,
              templateRoot: root,
              lessonBaseUrl,
            });
            blocksHost.append(exercise);
          }
        }
        wrap.append(blocksHost);
        card.append(wrap);

        if (completableBlocks.length > 0) {
          completeButton = document.createElement("button");
          completeButton.type = "button";
          completeButton.className = "learning-btn learning-btn-primary";
          completeButton.dataset.action = "complete-theory-block";
          completeButton.addEventListener("click", () => {
            let latest = loadLearningProgress(
              currentDb.modules,
              undefined,
              currentDb.quizSettings,
            );
            for (const block of completableBlocks) {
              latest = completeTheoryBlock(
                latest,
                mod,
                block.id,
                currentDb.questions,
              );
            }
            commitProgressChange(latest, currentDb);
          });
          card.append(completeButton);
        }
      } else if (section.kind === "exercise") {
        const exercise = document.createElement("div");
        attachModuleQuizRunner(exercise, {
          module: mod,
          db: currentDb,
          mode: "leicht",
          exerciseId: section.question.id,
          exerciseTitleInSection: true,
          templateRoot: root,
          lessonBaseUrl,
        });
        card.append(exercise);
      } else if (progress.steps.mittel === "locked") {
        const locked = document.createElement("p");
        locked.className = "learning-step-lock-notice";
        locked.textContent =
          "🔒 Schließe zuerst alle Theorieblöcke, Übungen und Praxisaufgaben ab.";
        card.append(locked);
      } else {
        const quiz = document.createElement("div");
        attachModuleQuizRunner(quiz, {
          module: mod,
          db: currentDb,
          mode: "mittel",
          templateRoot: root,
          lessonBaseUrl,
        });
        card.append(quiz);
      }

      const navigation = document.createElement("nav");
      navigation.className = "learning-lesson-navigation";
      navigation.setAttribute("aria-label", "Abschnittsnavigation");
      const previous = document.createElement("button");
      previous.type = "button";
      previous.className = "learning-btn";
      previous.dataset.action = "previous-lesson-section";
      previous.textContent = "← Zurück";
      previous.disabled = index === 0;
      previous.addEventListener("click", () => {
        if (previous.disabled) return;
        index -= 1;
        renderCurrent(true);
      });
      const next = document.createElement("button");
      next.type = "button";
      next.className = "learning-btn learning-btn-primary";
      next.dataset.action = "next-lesson-section";
      next.textContent = "Weiter →";
      next.hidden = index === sections.length - 1;
      next.addEventListener("click", () => {
        index += 1;
        renderCurrent(true);
      });
      navigation.append(previous, next);
      lessonContent.append(counter, progressBar, card, navigation);

      updateCurrentSection = () => {
        const latest = loadLearningProgress(
          currentDb.modules,
          undefined,
          currentDb.quizSettings,
        ).modules[mod.id];
        if (!latest) return;
        const completed = isLessonSectionComplete(section, latest);
        const backLocked = hasIncompleteLessonTask(section, latest);
        previous.disabled = index === 0 || backLocked;
        previous.title = backLocked
          ? "Erledige die aktuelle Aufgabe, bevor du zurückspringst."
          : "";
        next.disabled = !completed;
        card.dataset.stepState = completed ? "completed" : "unlocked";
        renderSidebar(latest);
        for (const { block, button } of practiceButtons) {
          const done = latest.completedPracticeBlockIds.includes(block.id);
          button.disabled = done;
          button.textContent = done
            ? "✓ Praxisaufgabe abgeschlossen"
            : `Praxisaufgabe abschließen (+${calculateTheoryBlockXp(block, BASE_XP_DEFAULTS.practice)} XP)`;
        }
        if (
          completeButton &&
          (section.kind === "theory" || section.kind === "group")
        ) {
          completeButton.disabled = completed;
          completeButton.textContent = completed
            ? "✓ Abschnitt gelesen"
            : "Abschnitt gelesen";
        }
        const percent =
          (sections.filter((item) => isLessonSectionComplete(item, latest))
            .length /
            sections.length) *
          100;
        const updatedBar = createBlueProgressBar(
          "Abschnittsfortschritt",
          percent,
        );
        progressBar.replaceWith(updatedBar);
        progressBar = updatedBar;
      };
      updateCurrentSection();
      if (focusHeading) heading.focus();
    };

    renderCurrent();
  }

  const renderInitialCatalog = canRenderInitialCatalog(root, options);
  if (renderInitialCatalog) fullRender();

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
        currentDb = getLearningCatalog(
          event.detail.db as unknown as ModulesDatabase,
        );
      }
    }
    if (reason === "reset") fullRender();
    else updateCurrentSection();
  };
  document.addEventListener("learning-progress:updated", onProgressUpdated);

  if (options.autoFetch !== false) {
    void fetchLiveModulesDatabase().then((liveDb) => {
      if (liveDb) {
        currentDb = liveDb;
        fullRender();
      } else if (!renderInitialCatalog) {
        showCatalogStatus(root, catalogLoadError);
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
