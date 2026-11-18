import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildLessonSections,
  cleanLessonTitle,
  getLessonSectionTitle,
  type LessonItem,
} from "./module-lessons.ts";
import {
  formatExerciseTitle,
  type ModuleQuestion,
  type ModulesDatabase,
  type TheoryBlock,
} from "./module-schema.ts";
import { notationToMarkdown } from "./module-theory-notation.ts";

export interface ArchiveVisual {
  marker: string;
  visualComponent: NonNullable<TheoryBlock["visualComponent"]>;
  visualPropsJson?: string;
}

export interface ArchiveLesson {
  slug: string;
  title: string;
  source: string;
  visuals: ArchiveVisual[];
}

export interface ArchivedModule {
  id: string;
  directory: string;
  title: string;
  description: string;
  archived: boolean;
  present: boolean;
  lessons: ArchiveLesson[];
}

export interface ModuleArchiveIndex {
  modules: ArchivedModule[];
}

export class ModuleArchiveSyncError extends Error {}

function directoryName(id: string): string {
  const encoded = [...id]
    .map((char) =>
      /^[a-z0-9_-]$/.test(char)
        ? char
        : [...Buffer.from(char, "utf8")]
            .map(
              (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
            )
            .join(""),
    )
    .join("");
  if (!encoded) {
    throw new Error(
      `Die Modul-ID „${id}“ kann nicht als Archivverzeichnis verwendet werden.`,
    );
  }
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(encoded)
    ? `%${encoded.charCodeAt(0).toString(16).toUpperCase()}${encoded.slice(1)}`
    : encoded;
}

function questionSource(question: ModuleQuestion): string {
  return [
    `## ${formatExerciseTitle(question.title, question.prompt)}`,
    question.prompt,
    ...(question.options ?? []).map((option) => `- ${option}`),
    ...(question.simpleHint
      ? [
          "<details>",
          "<summary>Hinweis</summary>",
          question.simpleHint,
          "</details>",
        ]
      : []),
    ...(question.strongHint
      ? [
          "<details>",
          "<summary>Stärkerer Hinweis</summary>",
          question.strongHint,
          "</details>",
        ]
      : []),
    "<details>",
    "<summary>Lösung und Erklärung</summary>",
    `**Richtige Antwort:** ${question.correctAnswers.join(", ")}`,
    ...(question.notationTask
      ? ["```json", JSON.stringify(question.notationTask, null, 2), "```"]
      : []),
    question.explanation,
    "</details>",
  ].join("\n\n");
}

export function createModuleArchive(db: ModulesDatabase): {
  index: ModuleArchiveIndex;
  files: Map<string, string>;
} {
  const index: ModuleArchiveIndex = { modules: [] };
  const files = new Map<string, string>();
  const modules = [...db.modules].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();
  for (const module of modules) {
    const directory = directoryName(module.id);
    if (seen.has(directory))
      throw new Error(`Doppelte Modul-ID im Archiv: ${module.id}`);
    seen.add(directory);
    const entry: ArchivedModule = {
      id: module.id,
      directory,
      title: module.title,
      description: module.description,
      archived: module.archived ?? false,
      present: true,
      lessons: [],
    };
    buildLessonSections(module, db.questions).forEach((section, position) => {
      const items: LessonItem[] =
        section.kind === "group"
          ? section.items
          : section.kind === "theory"
            ? section.blocks.map((block) => ({ kind: "theory", block }))
            : section.kind === "exercise"
              ? [{ kind: "exercise", question: section.question }]
              : section.kind === "practice"
                ? [{ kind: "practice", block: section.block }]
                : db.questions
                    .filter(
                      (q) =>
                        q.moduleIds.includes(module.id) &&
                        q.targetLane === "mittel",
                    )
                    .map((question) => ({ kind: "exercise", question }));
      const kind =
        section.kind === "quiz"
          ? "quiz"
          : items.some((item) => item.kind === "exercise")
            ? "aufgaben"
            : items.some((item) => item.kind === "practice")
              ? "praxis"
              : "theorie";
      const slug = `${String(position + 1).padStart(2, "0")}-${kind}`;
      const title = `${module.level + position + 1}: ${getLessonSectionTitle(section)}`;
      const source = `${directory}/${slug}.mdx`;
      const visuals: ArchiveVisual[] = [];
      const body = [`# ${title}`];
      for (const item of items) {
        if (item.kind === "exercise") {
          body.push(questionSource(item.question));
          continue;
        }
        const block =
          item.kind === "theory" ? notationToMarkdown(item.block) : item.block;
        if (section.kind === "group")
          body.push(`## ${cleanLessonTitle(item.block.title)}`);
        body.push(block.markdownContent ?? "");
        if (
          "visualComponent" in block &&
          block.visualComponent &&
          block.visualComponent !== "none"
        ) {
          const marker = `archive-visual-${visuals.length + 1}`;
          visuals.push({
            marker,
            visualComponent: block.visualComponent,
            ...(block.visualPropsJson !== undefined
              ? { visualPropsJson: block.visualPropsJson }
              : {}),
          });
          body.push(`<div id="${marker}"></div>`);
        }
      }
      files.set(
        source,
        [
          'import DrumPattern from "../../src/components/DrumPattern.astro";',
          'import Notation from "../../src/components/notation/Notation.astro";',
          'import NotationKeyboard from "../../src/components/notation/NotationKeyboard.astro";',
          "",
          ...body,
          "",
        ].join("\n\n"),
      );
      entry.lessons.push({ slug, title, source, visuals });
    });
    index.modules.push(entry);
  }
  return { index, files };
}

async function writeChanged(file: string, value: string): Promise<void> {
  try {
    if ((await readFile(file, "utf8")) === value) return;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

let writeQueue: Promise<void> = Promise.resolve();

export function syncModuleArchives(
  db: ModulesDatabase,
  root = process.cwd(),
): Promise<void> {
  const operation = writeQueue.then(async () => {
    const { index, files } = createModuleArchive(db);
    const archiveRoot = path.join(root, "module-archives");
    const indexPath = path.join(archiveRoot, "index.json");
    let previous: ModuleArchiveIndex = { modules: [] };
    try {
      previous = JSON.parse(
        await readFile(indexPath, "utf8"),
      ) as ModuleArchiveIndex;
      if (!Array.isArray(previous.modules))
        throw new Error("Ungültiger Archivindex.");
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    for (const old of previous.modules) {
      if (!index.modules.some((entry) => entry.id === old.id)) {
        index.modules.push({ ...old, present: false });
      }
    }
    for (const [source, content] of files) {
      await writeChanged(path.join(archiveRoot, source), content);
    }
    await writeChanged(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    const overview = [
      "# Modularchiv",
      "Im Browser: [Modulübersicht](http://localhost:8888/module-archives/).",
      "Die MDX-Dateien werden beim lokalen Speichern im Builder aktualisiert. Sie sind lesbare Kopien, nicht die Datenquelle des Moduls. Im Archiv werden keine Lernfortschritte oder XP gespeichert.",
      ...index.modules.flatMap((entry) => [
        `## ${entry.title}${!entry.present ? " (nicht mehr im Builder)" : entry.archived ? " (Blocklager)" : ""}`,
        ...entry.lessons.map(
          (lesson) => `- [${lesson.title}](${lesson.source})`,
        ),
      ]),
      "",
    ].join("\n\n");
    await writeChanged(path.join(archiveRoot, "README.md"), overview);
  });
  // Der Aufrufer erhält Fehler; spätere Speichervorgänge bleiben möglich.
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function syncModuleArchivesAfterSave(
  db: ModulesDatabase,
): Promise<void> {
  try {
    await syncModuleArchives(db);
  } catch (cause) {
    throw new ModuleArchiveSyncError(
      "Die Moduldaten wurden gespeichert, aber die MDX-Kopien konnten nicht aktualisiert werden. Bitte `npm run archive:modules` ausführen und den Worktree prüfen.",
      { cause },
    );
  }
}
