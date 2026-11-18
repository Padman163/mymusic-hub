// @vitest-environment node
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createModuleArchive, syncModuleArchives } from "../src/lib/module-archive";
import { createEmptyModulesDatabase, upsertModule, upsertQuestion } from "../src/lib/module-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function temporaryRoot() {
  const directory = await mkdtemp(path.join(tmpdir(), "mymusic-module-archive-"));
  temporaryDirectories.push(directory);
  return directory;
}

function database() {
  let db = upsertModule(createEmptyModulesDatabase(), {
    id: "rhythmus", title: "Rhythmus", level: 100,
    theoryBlocks: [
      { id: "theory", order: 0, title: "Puls", markdownContent: "Der Puls bleibt gleich." },
      {
        id: "intro", order: 1, title: "Drei Muster", role: "exercise_intro",
        markdownContent: '<DrumPattern steps={4} interactive={false} patternData={[]} />',
      },
    ],
  });
  db = upsertQuestion(db, {
    id: "question", moduleIds: ["rhythmus"], targetLane: "leicht",
    questionType: "single_choice", title: "Vergleichen", prompt: "Welches Muster?",
    options: ["A", "B"], correctAnswers: ["B"], simpleHint: "Zähle die Felder.",
    strongHint: "Achte auf die 1.", explanation: "B hat weniger Klänge.",
  });
  db.modules[0].contentOrder = [
    { kind: "theory", id: "theory" },
    { kind: "theory", id: "intro", groupId: "tasks", groupTitle: "Muster vergleichen" },
    { kind: "exercise", id: "question", groupId: "tasks", groupTitle: "Muster vergleichen" },
  ];
  return upsertModule(db, {
    id: "lager", title: "Blocklager", archived: true,
    theoryBlocks: [{ id: "saved", order: 0, title: "Aufbewahrt", markdownContent: "Originaltext" }],
  });
}

describe("lesbare Modularchive", () => {
  it("übernimmt dieselben zwei Lektionsseiten einschließlich Einleitung, Antworten und Blocklager ohne Datenänderung", () => {
    const db = database();
    const original = structuredClone(db);
    const { index, files } = createModuleArchive(db);
    expect(index.modules.map((module) => [module.id, module.archived, module.lessons.length]))
      .toEqual([["rhythmus", false, 2], ["lager", true, 1]]);
    expect(index.modules[0].lessons.map((lesson) => lesson.title))
      .toEqual(["101: Puls", "102: Muster vergleichen"]);
    expect(files.get("rhythmus/01-theorie.mdx")).toContain("Der Puls bleibt gleich.");
    const tasks = files.get("rhythmus/02-aufgaben.mdx") ?? "";
    expect(tasks.indexOf("<DrumPattern steps=")).toBeLessThan(tasks.indexOf("Welches Muster?"));
    for (const text of [
      "## Aufgabe: Vergleichen", "- A", "- B", "Zähle die Felder.", "Achte auf die 1.",
      "**Richtige Antwort:** B", "B hat weniger Klänge.",
    ]) expect(tasks).toContain(text);
    expect(files.get("lager/01-theorie.mdx")).toContain("Originaltext");
    expect(db).toEqual(original);
  });

  it("schreibt unveränderte Seiten nicht erneut und behält entfernte Module als letzten Stand", async () => {
    const root = await temporaryRoot();
    const db = database();
    await syncModuleArchives(db, root);
    const file = path.join(root, "module-archives", "rhythmus", "01-theorie.mdx");
    const original = await readFile(file, "utf8");
    const timestamp = new Date("2020-01-01T00:00:00Z");
    await utimes(file, timestamp, timestamp);
    await syncModuleArchives(db, root);
    expect((await stat(file)).mtimeMs).toBe(timestamp.getTime());
    await syncModuleArchives(createEmptyModulesDatabase(), root);
    expect(await readFile(file, "utf8")).toBe(original);
    const index = JSON.parse(await readFile(path.join(root, "module-archives", "index.json"), "utf8"));
    expect(index.modules.map((module: { present: boolean }) => module.present)).toEqual([false, false]);
    expect(await readFile(path.join(root, "module-archives", "README.md"), "utf8"))
      .toContain("[101: Puls](rhythmus/01-theorie.mdx)");
  });

  it("hält Modul-IDs im Archivverzeichnis und meldet Schreibfehler ohne spätere Exporte zu blockieren", async () => {
    const db = database();
    db.modules[0].id = "../../outside";
    const { index } = createModuleArchive(db);
    expect(index.modules[0].directory).not.toContain(".");
    expect(index.modules[0].directory).not.toMatch(/[\\/]/);
    const blockedRoot = await temporaryRoot();
    await writeFile(path.join(blockedRoot, "module-archives"), "Keine Verzeichnisstruktur");
    await expect(syncModuleArchives(db, blockedRoot)).rejects.toThrow();
    const validRoot = await temporaryRoot();
    await expect(syncModuleArchives(db, validRoot)).resolves.toBeUndefined();
  });
});
