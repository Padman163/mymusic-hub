import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reviewItems = new Set();
const scanExtensions = new Set([
  ".astro",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".toml",
  ".yaml",
  ".yml",
]);
const ignoredDirectories = new Set([
  ".astro",
  ".git",
  ".netlify",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function relativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function listFiles(directory, extensions = scanExtensions) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...listFiles(path.join(directory, entry.name), extensions));
      }
    } else if (
      entry.isFile() &&
      extensions.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function runGit(args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function addReviewItem(message) {
  reviewItems.add(message);
}

console.log(
  "Cleanup-Check: lesender Bericht; Dateien werden nicht gelöscht oder verschoben.",
);

console.log("\n=== Schritt 1/5: Git-Hygiene und Artefakte ===");
const branch = runGit(["branch", "--show-current"]);
const worktree = runGit(["status", "--short"]);
if (
  branch.error ||
  worktree.error ||
  branch.status !== 0 ||
  worktree.status !== 0
) {
  console.log("PRÜFEN: Git-Status konnte nicht vollständig ermittelt werden.");
  addReviewItem("Git-Status oder Branch konnte nicht ermittelt werden.");
} else {
  console.log(`Branch: ${branch.stdout.trim() || "(detached HEAD)"}`);
  const worktreeEntries = worktree.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (worktreeEntries.length === 0) {
    console.log("Arbeitsbaum: sauber");
  } else {
    console.log(
      "PRÜFEN: Änderungen im Arbeitsbaum (vor Cleanup sichern und abgrenzen):",
    );
    for (const entry of worktreeEntries) console.log(`  ${entry}`);
    addReviewItem("Arbeitsbaum enthält Änderungen.");
  }
}

const ignoreRules = new Set(
  readFileSync(path.join(root, ".gitignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim()),
);
const expectedIgnoreRules = [
  "dist/",
  ".astro/",
  "node_modules/",
  "test-results/",
  "playwright-report/",
  ".lighthouseci/",
  ".env",
  ".env.*",
  "!.env.example",
  ".netlify",
];
const missingIgnoreRules = expectedIgnoreRules.filter(
  (rule) => !ignoreRules.has(rule),
);
if (missingIgnoreRules.length === 0) {
  console.log("Ignore-Regeln: alle erwarteten Regeln in .gitignore vorhanden.");
} else {
  console.log(
    `PRÜFEN: Fehlende oder abweichende .gitignore-Regeln: ${missingIgnoreRules.join(", ")}`,
  );
  addReviewItem("Erwartete .gitignore-Regeln fehlen oder weichen ab.");
}

const localPaths = [
  "dist/",
  ".astro/",
  "node_modules/",
  "test-results/",
  "playwright-report/",
  ".lighthouseci/",
  ".netlify/",
  ".env",
];
for (const localPath of localPaths) {
  const exists = existsSync(path.join(root, localPath));
  const ignore = runGit(["check-ignore", "--no-index", "-q", "--", localPath]);
  const ignored = ignore.status === 0;
  const state = !exists
    ? "nicht vorhanden"
    : ignored
      ? "lokal vorhanden, ignoriert"
      : "lokal vorhanden, NICHT ignoriert";
  console.log(`  ${localPath}: ${state}`);
  if (exists && !ignored) {
    addReviewItem(`${localPath} ist lokal vorhanden und nicht ignoriert.`);
  }
}

const trackedArtifactsResult = runGit([
  "ls-files",
  "-z",
  "--",
  "dist",
  ".astro",
  "node_modules",
  "test-results",
  "playwright-report",
  ".lighthouseci",
  ".netlify",
  ".env",
  ".env.*",
]);
if (trackedArtifactsResult.error || trackedArtifactsResult.status !== 0) {
  console.log(
    "PRÜFEN: Getrackte generierte Dateien konnten nicht ermittelt werden.",
  );
  addReviewItem("Git konnte getrackte Artefakte nicht prüfen.");
} else {
  const trackedArtifacts = trackedArtifactsResult.stdout
    .split("\0")
    .filter(Boolean)
    .filter((filePath) => path.basename(filePath) !== ".env.example");
  if (trackedArtifacts.length === 0) {
    console.log(
      "Getrackte generierte Artefakte oder .env-Dateien: keine gefunden.",
    );
  } else {
    console.log(
      "PRÜFEN: Getrackte Artefakte (nur nach Sichtprüfung aus dem Index entfernen):",
    );
    for (const filePath of trackedArtifacts) console.log(`  ${filePath}`);
    addReviewItem(
      `${trackedArtifacts.length} generierte oder lokale Datei(en) sind getrackt.`,
    );
  }
}

console.log("\n=== Schritt 2/5: Dokumentation ===");
const handoffFiles = listFiles(
  path.join(root, "features"),
  new Set([".md"]),
).filter((filePath) => /HANDOFF/i.test(path.basename(filePath)));
if (handoffFiles.length === 0) {
  console.log("Handoffs: keine gefunden.");
} else {
  for (const filePath of handoffFiles) {
    const text = readFileSync(filePath, "utf8");
    const unchecked = (text.match(/^\s*[-*]\s+\[\s\]/gm) ?? []).length;
    console.log(
      `PRÜFEN: ${relativePath(filePath)} — ${unchecked} offene Checkbox(en); Abschluss und Links manuell prüfen.`,
    );
    addReviewItem(`Handoff manuell prüfen: ${relativePath(filePath)}.`);
  }
}

console.log(
  "Dokumentations- und Linktest: npm test -- tests/documentation.test.ts",
);
const npmCli = process.env.npm_execpath;
let docsTestPassed = false;
if (!npmCli) {
  console.log(
    "FEHLER: npm CLI nicht verfügbar; starte den Bericht über `npm run cleanup:check`.",
  );
} else {
  const docsTest = spawnSync(
    process.execPath,
    [npmCli, "run", "test", "--", "tests/documentation.test.ts"],
    { cwd: root, stdio: "inherit" },
  );
  docsTestPassed = !docsTest.error && docsTest.status === 0;
  console.log(
    `${docsTestPassed ? "BESTANDEN" : "FEHLGESCHLAGEN"}: Dokumentationstest ${
      docsTest.error ? docsTest.error.message : `Exit-Code ${docsTest.status}`
    }`,
  );
}
if (!docsTestPassed)
  addReviewItem("Dokumentationstest starten oder Fehler beheben.");

console.log("\n=== Schritt 3/5: Ungenutzte Dateien und Assets ===");
const sourceFiles = [
  ...["src", "tests", "netlify"].flatMap((directory) =>
    listFiles(path.join(root, directory)),
  ),
  ...[
    "astro.config.mjs",
    "netlify.toml",
    "package.json",
    "playwright.config.ts",
    "tsconfig.json",
    "vitest.config.ts",
  ]
    .map((filePath) => path.join(root, filePath))
    .filter(existsSync),
].map((filePath) => ({
  path: relativePath(filePath),
  text: readFileSync(filePath, "utf8").toLowerCase(),
}));

const candidateExtensions = new Set([
  ".astro",
  ".css",
  ".js",
  ".mjs",
  ".musicxml",
  ".ts",
  ".tsx",
]);
const candidateFiles = [
  ...["src/components", "src/lib", "src/styles", "public/scores"].flatMap(
    (directory) => listFiles(path.join(root, directory), candidateExtensions),
  ),
];
let referencedCandidates = 0;
const unreferencedCandidates = [];
for (const filePath of candidateFiles) {
  const relative = relativePath(filePath);
  const stem = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const references = sourceFiles
    .filter((source) => source.path !== relative && source.text.includes(stem))
    .map((source) => source.path);
  if (references.length > 0) {
    referencedCandidates += 1;
  } else {
    unreferencedCandidates.push(relative);
  }
}
console.log(
  `Statische Namenssuche: ${candidateFiles.length} Datei(en), ${referencedCandidates} mit Erwähnung, ${unreferencedCandidates.length} ohne direkte Erwähnung.`,
);
if (unreferencedCandidates.length === 0) {
  console.log("Keine Prüfkandidaten ohne direkte Erwähnung gefunden.");
} else {
  console.log("PRÜFEN — mögliche Kandidaten, KEINE Löschfreigabe:");
  for (const filePath of unreferencedCandidates) {
    const publicAsset = filePath.startsWith("public/scores/");
    console.log(
      `  ${filePath}${publicAsset ? " — öffentliche/dynamische oder externe Nutzung nicht ausgeschlossen" : ""}`,
    );
  }
  addReviewItem(
    `${unreferencedCandidates.length} Datei(en) ohne direkte statische Namens-Erwähnung.`,
  );
}
console.log(
  "Hinweis: Die Suche kann dynamische Imports, Markdown-Beispiele und externe Asset-URLs nicht sicher bewerten.",
);
console.log(
  "`data/`, lokale Blob-Daten und Netlify-Cloud-Einstellungen werden absichtlich nicht durchsucht.",
);

console.log("\n=== Schritt 4/5: Abgelöste Features und Wrapper ===");
const legacyPattern = /GITHUB_[A-Z0-9_]*|github-contribution-store/gi;
const legacyMatches = sourceFiles
  .map(({ path: filePath, text }) => ({
    path: filePath,
    count: [...text.matchAll(legacyPattern)].length,
  }))
  .filter(({ count }) => count > 0);
if (legacyMatches.length === 0) {
  console.log("GitHub-Storage-Bezeichner im gescannten Code: keine gefunden.");
} else {
  console.log(
    "PRÜFEN: GitHub-Storage-Bezeichner im Code (Werte werden nicht ausgegeben):",
  );
  for (const match of legacyMatches)
    console.log(`  ${match.path}: ${match.count} Treffer`);
  addReviewItem("Mögliche alte GitHub-Storage-Referenzen im Code.");
}

const notationFiles = listFiles(
  path.join(root, "src/components/notation"),
  new Set([".astro"]),
);
for (const filePath of notationFiles) {
  const relative = relativePath(filePath);
  const stem = path.basename(filePath, ".astro").toLowerCase();
  const callers = sourceFiles
    .filter((source) => source.path !== relative && source.text.includes(stem))
    .map((source) => source.path);
  console.log(
    `${callers.length > 0 ? "REFERENZ GEFUNDEN" : "PRÜFEN"}: ${relative}${
      callers.length > 0
        ? ` ← ${callers.slice(0, 4).join(", ")}`
        : " — keine direkte Erwähnung gefunden"
    }`,
  );
  if (callers.length === 0)
    addReviewItem(`Notation-Wrapper manuell prüfen: ${relative}.`);
}

const oldStorePath = "netlify/functions/lib/github-contribution-store.ts";
console.log(
  `${existsSync(path.join(root, oldStorePath)) ? "PRÜFEN: alter Store vorhanden" : "Alter GitHub-Store: nicht vorhanden"}${existsSync(path.join(root, oldStorePath)) ? ` (${oldStorePath})` : ""}`,
);
const netlifyConfigPath = path.join(root, "netlify.toml");
const netlifyConfig = readFileSync(netlifyConfigPath, "utf8").split(/\r?\n/);
const dataRules = netlifyConfig
  .map((line, index) => ({ line: index + 1, text: line }))
  .filter(({ text }) => /data\s*\/\*\*/i.test(text));
if (dataRules.length === 0) {
  console.log("netlify.toml: keine alte data/**-Regel gefunden.");
} else {
  console.log("PRÜFEN: data/**-Regeln in netlify.toml:");
  for (const rule of dataRules)
    console.log(`  netlify.toml:${rule.line}: ${rule.text.trim()}`);
  addReviewItem("Mögliche data/**-Ignore-Regel in netlify.toml.");
}
console.log(
  "Manuell prüfen: Netlify-Dashboard-Variablen, Rollback-Abhängigkeiten und Status der Handoffs.",
);
addReviewItem(
  "Externe Netlify-Variablen und Rollback-Abhängigkeiten sind lokal nicht prüfbar.",
);

console.log("\n=== Schritt 5/5: Tests und Abschluss ===");
console.log(
  `${docsTestPassed ? "BESTANDEN" : "FEHLGESCHLAGEN"}: automatischer Dokumentationstest ${
    docsTestPassed
      ? "ist durchgelaufen"
      : "muss ausgeführt oder korrigiert werden"
  }.`,
);
console.log(
  "Nicht automatisch ausgeführt: vollständiges `npm run preflight` und manuelle Funktions-/Visuelltests.",
);
console.log(
  "Nach freigegebenen Änderungen: `npm run preflight`, `git status --short` und `git diff --check`.",
);

console.log("\n=== Auswertung ===");
console.log(`Manuelle Prüfpunkte: ${reviewItems.size}`);
for (const item of reviewItems) console.log(`- PRÜFEN: ${item}`);
console.log("Löschungen, Verschiebungen und Indexänderungen: keine.");
console.log(
  "Nur nach Prüfung und Freigabe löschen; dynamische oder externe Nutzung ist nicht automatisch ausschließbar.",
);
process.exitCode = docsTestPassed ? 0 : 1;
