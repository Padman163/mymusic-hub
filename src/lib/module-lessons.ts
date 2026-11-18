import {
  formatExerciseTitle,
  isQuestionInModule,
  type LearningModule,
  type ModuleContentReference,
  type ModuleQuestion,
  type PracticeBlock,
  type TheoryBlock,
} from "./module-schema.ts";

export type LessonItem =
  | { kind: "theory"; block: TheoryBlock }
  | { kind: "exercise"; question: ModuleQuestion }
  | { kind: "practice"; block: PracticeBlock };

export type LessonSection =
  | { kind: "theory"; blocks: TheoryBlock[] }
  | { kind: "exercise"; question: ModuleQuestion }
  | { kind: "practice"; block: PracticeBlock }
  | { kind: "group"; groupTitle: string; items: LessonItem[] }
  | { kind: "quiz" };

export function cleanLessonTitle(title: string): string {
  const trimmed = title.trim();
  return (
    trimmed
      .replace(
        /^(?:\d+(?:\.\d+)*\s*(?::\s*|[.)–-]\s+)|(?:Theorie|Abschnitt|Übung|Praxisaufgabe|Quiz)\s+\d+(?:\.\d+)*(?:\s*[:.)–-])?\s+)*/i,
        "",
      )
      .trim() || trimmed
  );
}

export function getLessonSectionTitle(section: LessonSection): string {
  switch (section.kind) {
    case "group":
      return cleanLessonTitle(section.groupTitle);
    case "theory":
      return cleanLessonTitle(section.blocks[0].title);
    case "exercise":
      return formatExerciseTitle(
        section.question.title,
        section.question.prompt,
      );
    case "practice":
      return cleanLessonTitle(section.block.title);
    case "quiz":
      return "Quiz";
  }
}

export function buildLessonSections(
  mod: LearningModule,
  questions: readonly ModuleQuestion[],
): LessonSection[] {
  const blocks = [...mod.theoryBlocks].sort((a, b) => a.order - b.order);
  const exercises = questions.filter(
    (question) =>
      isQuestionInModule(question, mod.id) && question.targetLane === "leicht",
  );
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const practiceById = new Map(
    mod.practiceBlocks.map((block) => [block.id, block]),
  );
  const exercisesById = new Map(
    exercises.map((question) => [question.id, question]),
  );
  const seen = new Set<string>();
  const ordered: Array<{
    groupId?: string;
    groupTitle?: string;
    item: LessonItem;
  }> = [];
  function addReference(reference: ModuleContentReference): void {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) return;
    const block =
      reference.kind === "theory" ? blocksById.get(reference.id) : undefined;
    const question =
      reference.kind === "exercise"
        ? exercisesById.get(reference.id)
        : undefined;
    const practice =
      reference.kind === "practice"
        ? practiceById.get(reference.id)
        : undefined;
    if (block) {
      seen.add(key);
      ordered.push({
        groupId: reference.groupId ?? block.groupId,
        groupTitle: reference.groupTitle ?? block.groupTitle,
        item: { kind: "theory", block },
      });
      return;
    }
    const item: LessonItem | undefined = question
      ? { kind: "exercise", question }
      : practice
        ? { kind: "practice", block: practice }
        : undefined;
    if (!item) return;
    seen.add(key);
    ordered.push({
      groupId: reference.groupId,
      groupTitle: reference.groupTitle,
      item,
    });
  }
  for (const reference of mod.contentOrder ?? []) addReference(reference);
  for (const block of blocks) addReference({ kind: "theory", id: block.id });
  for (const question of exercises)
    addReference({ kind: "exercise", id: question.id });
  for (const block of mod.practiceBlocks)
    addReference({ kind: "practice", id: block.id });
  const sections: LessonSection[] = [];
  const addedGroups = new Set<string>();
  for (const current of ordered) {
    if (current.groupId) {
      if (addedGroups.has(current.groupId)) continue;
      addedGroups.add(current.groupId);
      sections.push({
        kind: "group",
        groupTitle: current.groupTitle ?? "Abschnitt",
        items: ordered
          .filter((item) => item.groupId === current.groupId)
          .map(({ item }) => item),
      });
      continue;
    }
    sections.push(
      current.item.kind === "theory"
        ? { kind: "theory", blocks: [current.item.block] }
        : current.item.kind === "practice"
          ? { kind: "practice", block: current.item.block }
          : { kind: "exercise", question: current.item.question },
    );
  }
  if (
    questions.some(
      (question) =>
        isQuestionInModule(question, mod.id) &&
        question.targetLane === "mittel",
    )
  ) {
    sections.push({ kind: "quiz" });
  }
  return sections;
}
