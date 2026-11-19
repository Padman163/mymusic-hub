import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
  isLearningConfiguration,
  isQuizSettings,
  normalizeLegacyDatabase,
  type ModulesDatabase,
} from "../src/lib/module-schema.ts";
import {
  validateModuleInput,
  validateQuestionInput,
} from "../src/lib/module-store.ts";

type BlobKey = "contributions" | "modules";
type BlobData = {
  contributions: unknown[];
  modules: ModulesDatabase;
};

const storeName = "mymusic-hub-data";
const snapshotDirectory = path.resolve("data", "blob-snapshot");
const archiveDirectory = path.resolve("data", "blob-archive");
const localBlobDirectory = path.resolve(".netlify", "blobs-serve");

function parseContributions(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Der Beitrags-Stand muss ein JSON-Array enthalten.");
  }
  return value;
}

function parseModules(value: unknown): ModulesDatabase {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("modules" in value) ||
    !Array.isArray(value.modules) ||
    !("questions" in value) ||
    !Array.isArray(value.questions)
  ) {
    throw new Error("Der Modul-Stand hat ein ungültiges Format.");
  }
  if (
    "quizSettings" in value &&
    value.quizSettings !== undefined &&
    !isQuizSettings(value.quizSettings)
  ) {
    throw new Error("Die Quiz-Einstellungen im Modul-Stand sind ungültig.");
  }
  if (
    "learningConfig" in value &&
    value.learningConfig !== undefined &&
    !isLearningConfiguration(value.learningConfig)
  ) {
    throw new Error("Die Lernkonfiguration im Modul-Stand ist ungültig.");
  }

  const database = normalizeLegacyDatabase(value as ModulesDatabase);
  for (const module of database.modules) {
    const validation = validateModuleInput(module);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
  }
  for (const question of database.questions) {
    const validation = validateQuestionInput(question, database.modules);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
  }
  return database;
}

function parseBlobData(value: unknown, key: BlobKey): BlobData[BlobKey] {
  return key === "contributions"
    ? (parseContributions(value) as BlobData[BlobKey])
    : (parseModules(value) as BlobData[BlobKey]);
}

async function readSnapshot(key: BlobKey): Promise<BlobData[BlobKey]> {
  const contents = await readFile(
    path.join(snapshotDirectory, `${key}.json`),
    "utf8",
  );
  return parseBlobData(JSON.parse(contents), key);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNetlifyBlobs(args: string[]): void {
  const result = spawnSync(
    "npx",
    ["netlify-cli", ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || "Unbekannter Fehler";
    throw new Error(
      `Netlify-Blobs-Befehl fehlgeschlagen. Prüfe Login und Site-Link.\n${detail}`,
    );
  }
}

async function downloadCloudKey(
  key: "contributions",
  destination: string,
): Promise<unknown[]>;
async function downloadCloudKey(
  key: "modules",
  destination: string,
): Promise<ModulesDatabase>;
async function downloadCloudKey(
  key: BlobKey,
  destination: string,
): Promise<BlobData[BlobKey]> {
  runNetlifyBlobs(["blobs:get", storeName, key, "--output", destination]);
  return parseBlobData(
    JSON.parse(await readFile(destination, "utf8")),
    key,
  );
}

async function readCloudData(): Promise<BlobData> {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "mymusic-hub-blobs-"),
  );
  try {
    return {
      contributions: await downloadCloudKey(
        "contributions",
        path.join(temporaryDirectory, "contributions.json"),
      ),
      modules: await downloadCloudKey(
        "modules",
        path.join(temporaryDirectory, "modules.json"),
      ),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function uploadCloudKey(key: BlobKey, filePath: string): void {
  runNetlifyBlobs([
    "blobs:set",
    storeName,
    key,
    "--input",
    filePath,
    "--force",
  ]);
}

async function saveCloudData(data: BlobData): Promise<void> {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "mymusic-hub-blobs-upload-"),
  );
  try {
    const contributionPath = path.join(temporaryDirectory, "contributions.json");
    const modulesPath = path.join(temporaryDirectory, "modules.json");
    await writeJson(contributionPath, data.contributions);
    await writeJson(modulesPath, data.modules);
    uploadCloudKey("contributions", contributionPath);
    uploadCloudKey("modules", modulesPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function archiveCloudData(data: BlobData): Promise<string> {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const directory = path.join(archiveDirectory, timestamp);
  await writeJson(path.join(directory, "contributions.json"), data.contributions);
  await writeJson(path.join(directory, "modules.json"), data.modules);
  return directory;
}

async function confirmPush(force: boolean): Promise<void> {
  if (force) return;
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Cloud-Blobs mit den lokalen Snapshots überschreiben? Vorher wird ein Cloud-Backup erstellt. [y/N] ",
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    throw new Error("Cloud-Upload abgebrochen.");
  }
}

async function confirmReset(force: boolean): Promise<void> {
  if (force) return;
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Lokalen Netlify-Blob-Store löschen und beim nächsten Start aus den Snapshots neu aufbauen? Nicht gesicherte lokale Änderungen gehen verloren. [y/N] ",
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    throw new Error("Lokaler Blob-Reset abgebrochen.");
  }
}

async function pull(): Promise<void> {
  const data = await readCloudData();
  await writeJson(
    path.join(snapshotDirectory, "contributions.json"),
    data.contributions,
  );
  await writeJson(path.join(snapshotDirectory, "modules.json"), data.modules);
  console.log(
    `Cloud-Stand geladen: ${data.contributions.length} Beiträge, ${data.modules.modules.length} Module und ${data.modules.questions.length} Aufgaben.`,
  );
}

async function backup(): Promise<void> {
  const directory = await archiveCloudData(await readCloudData());
  console.log(`Cloud-Backup gespeichert: ${path.relative(process.cwd(), directory)}`);
}

async function push(force: boolean): Promise<void> {
  const contributions = parseContributions(await readSnapshot("contributions"));
  const modules = parseModules(await readSnapshot("modules"));
  await confirmPush(force);
  const archivePath = await archiveCloudData(await readCloudData());
  await saveCloudData({ contributions, modules });
  console.log(
    `Cloud-Stand aktualisiert: ${contributions.length} Beiträge, ${modules.modules.length} Module und ${modules.questions.length} Aufgaben.`,
  );
  console.log(`Vorheriger Cloud-Stand: ${path.relative(process.cwd(), archivePath)}`);
}

async function resetLocal(force: boolean): Promise<void> {
  await confirmReset(force);
  await rm(localBlobDirectory, { recursive: true, force: true });
  console.log(
    "Lokaler Netlify-Blob-Store entfernt. Starte danach `npx netlify-cli dev`; fehlende Keys werden aus data/blob-snapshot initialisiert.",
  );
}

const [action, ...args] = process.argv.slice(2);
if (!["pull", "backup", "push", "reset"].includes(action)) {
  throw new Error(
    "Aufruf: npm run blobs:pull | blobs:backup | blobs:push -- [--yes] | blobs:reset -- [--yes]",
  );
}

if (action === "pull") await pull();
if (action === "backup") await backup();
if (action === "push") await push(args.includes("--yes"));
if (action === "reset") await resetLocal(args.includes("--yes"));
