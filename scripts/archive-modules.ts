import { syncModuleArchives } from "../src/lib/module-archive.ts";
import type { ModulesDatabase } from "../src/lib/module-schema.ts";
import { validateModuleInput, validateQuestionInput } from "../src/lib/module-store.ts";

const args = process.argv.slice(2);
try {
  if (args.length !== 0 && (args.length !== 2 || args[0] !== "--url")) {
    throw new Error("Aufruf: npm run archive:modules -- [--url http://localhost:8888/api/modules]");
  }
  const response = await fetch(args[1] ?? "http://localhost:8888/api/modules", {
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Modulkatalog antwortet mit HTTP ${response.status}.`);
  const raw: unknown = await response.json();
  if (
    typeof raw !== "object" || raw === null ||
    !("modules" in raw) || !Array.isArray(raw.modules) ||
    !("questions" in raw) || !Array.isArray(raw.questions)
  ) throw new Error("Ungültiger Modulkatalog.");
  for (const module of raw.modules) {
    const validation = validateModuleInput(module);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
  }
  const db = raw as ModulesDatabase;
  for (const question of db.questions) {
    const validation = validateQuestionInput(question, db.modules);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
  }
  await syncModuleArchives(db);
  console.log(`MDX-Kopien und Übersicht aktualisiert: ${db.modules.length} Module. Live-Daten unverändert.`);
} catch (error) {
  console.error("Modularchiv konnte nicht aktualisiert werden:", error);
  process.exitCode = 1;
}
