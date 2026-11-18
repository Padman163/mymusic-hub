import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
const results = [];

if (!npmCli) {
  console.error("npm konnte nicht ermittelt werden. Bitte `npm run preflight` starten.");
  process.exitCode = 1;
} else {
  function runStep(name, command, run, correction) {
    console.log(`\n=== ${name} ===`);
    console.log(`$ ${command}`);

    const result = run();
    const passed = !result.error && result.status === 0;
    const detail = result.error
      ? `Start fehlgeschlagen: ${result.error.message}`
      : result.status === null
        ? `Beendet durch ${result.signal ?? "unbekanntes Signal"}`
        : `Exit-Code ${result.status}`;

    results.push({
      name,
      status: passed ? "BESTANDEN" : "FEHLGESCHLAGEN",
      detail,
      correction: passed ? undefined : correction,
    });
    console.log(`\n${passed ? "BESTANDEN" : "FEHLGESCHLAGEN"}: ${name} (${detail})`);
    return passed;
  }

  function runNpm(name, script, correction, command = `npm run ${script}`) {
    const args = script === "test" ? ["test"] : ["run", script];
    return runStep(
      name,
      command,
      () => spawnSync(process.execPath, [npmCli, ...args], { stdio: "inherit" }),
      correction,
    );
  }

  runNpm("Validierung", "validate", "Biome-, Astro- oder TypeScript-Fehler beheben.");
  runNpm("Vitest", "test", "Fehlgeschlagene Tests anhand der Ausgabe oben korrigieren.", "npm test");
  const buildPassed = runNpm("Produktions-Build", "build", "Buildfehler anhand der Astro-/Vite-Ausgabe beheben.");

  if (buildPassed) {
    runNpm("Playwright E2E", "test:e2e", "Fehlgeschlagene Browser-Tests anhand der Playwright-Ausgabe korrigieren.");
    runNpm("Lighthouse CI", "audit:lhci", "Lighthouse-Befunde und konfigurierte Grenzwerte prüfen.");
  } else {
    for (const [name, correction] of [
      ["Playwright E2E", "Zuerst den Build erfolgreich abschließen."],
      ["Lighthouse CI", "Zuerst den Build erfolgreich abschließen."],
    ]) {
      results.push({
        name,
        status: "ÜBERSPRUNGEN",
        detail: "Der Produktions-Build ist fehlgeschlagen.",
        correction,
      });
    }
  }

  runStep(
    "Diff-Prüfung",
    "git diff --check",
    () => spawnSync("git", ["diff", "--check"], { stdio: "inherit" }),
    "Whitespace-Fehler im Git-Diff beheben.",
  );

  const failures = results.filter((result) => result.status === "FEHLGESCHLAGEN");
  console.log("\n=== Preflight-Auswertung ===");
  for (const result of results) {
    console.log(`- ${result.status}: ${result.name} — ${result.detail}`);
    if (result.correction) console.log(`  Nächster Schritt: ${result.correction}`);
  }
  console.log("\n`npm audit` ist nicht Teil des Preflights; separat ausführen: `npm run audit`.");

  if (failures.length > 0) {
    console.error(`Preflight fehlgeschlagen: ${failures.length} Schritt(e) müssen korrigiert werden.`);
    process.exitCode = 1;
  } else {
    console.log("Preflight erfolgreich: alle ausgeführten Schritte bestanden.");
  }
}
