# Netlify Blobs: Persistenz für Beiträge und Lernmodule

Netlify Blobs (`@netlify/blobs`) ersetzt die GitHub REST API als Datenspeicher. Schreibzugriffe erzeugen keine Git-Commits und lösen damit keine Builds aus. Der JSON-Store `mymusic-hub-data` ist vom geplanten Store `mymusic-hub-media` für Audio und Bilder getrennt; Medien werden noch nicht gespeichert.

## Setup und Branch-Wechsel

Die Abhängigkeit wurde mit `npm install @netlify/blobs` hinzugefügt. In einem frischen Workspace genügt die normale Installation über das Lockfile.

1. `feat/netlify-blobs` auschecken. Solange der alte GitHub-Backendstand noch läuft, in der lokalen `.env` vorübergehend `GITHUB_BRANCH=feat/netlify-blobs` setzen, wenn dies der gewünschte Quelldatenstand ist. Nach der Umstellung diese Einstellung entfernen oder auskommentieren: Sie wählt **keinen** Blob-Store.
2. Im Netlify Dashboard unter **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** den Branch für Branch Deploys/Deploy Previews freigeben oder bewusst als Production Branch setzen.
3. Unter **Environment variables** die alten `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_BRANCH`, `GITHUB_DATA_PATH` und `GITHUB_MODULES_PATH` nach dem Wechsel entfernen, sofern sie nicht von anderen Verbrauchern benötigt werden. Für noch aktive alte Deploys oder einen geplanten Rollback erst deren Abhängigkeiten klären. Netlify stellt den Blob-Kontext für die Functions bereit.

**Wichtig:** [`getStore`](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore) ist **siteweit**. Production, Branch Deploys und Previews derselben Site verwenden dieselben Daten und können sie ändern. Für isolierte Online-Abnahmen eine separate Netlify-Site verwenden; Branch-Freigabe und Deploy-Kontext allein isolieren den Store nicht. `getDeployStore` wäre dagegen deployspezifisch und wird hier bewusst nicht verwendet.

## Architektur und Datenfluss

| Datei | Verantwortung |
| --- | --- |
| [`blob-store.ts`](../netlify/functions/lib/blob-store.ts) | Kapselt Store-Namen, typisierte JSON-Keys, Initial-Seed und konfliktgeschützte Schreibzugriffe. |
| [`contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) | Fachliche Änderungen am Key `contributions` und Abgleich mit dem erwarteten Beitragsstand. |
| [`contributions.ts`](../netlify/functions/contributions.ts) | HTTP-API und Validierung für Beiträge. |
| [`modules.ts`](../netlify/functions/modules.ts) | HTTP-API für den Key `modules` (Module, Aufgaben und Quiz-Einstellungen); Fachregeln bleiben in [`module-store.ts`](../src/lib/module-store.ts). |
| [`astro.config.mjs`](../astro.config.mjs) | Nur beim reinen Astro-Start liest und schreibt `localModulesApiPlugin()` direkt in `data/modules.json`. Unter Netlify CLI ist dieses Plugin deaktiviert. |

Die Functions lesen mit starker Konsistenz. Liefert ein Key `null`, liest der Adapter den Stand aus `data/contributions.json` bzw. `data/modules.json`, die als Seed-Dateien mit den Functions ausgeliefert werden. Fehlt die Datei, verwendet er `[]` bzw. `{ modules: [], questions: [] }`. Defekte Dateien führen zu einem Fehler statt zu einem leeren Ersatz. `onlyIfNew` verhindert, dass ein paralleler Erstzugriff vorhandene Daten überschreibt. Spätere Änderungen nutzen ETags (`onlyIfMatch`) mit bis zu drei Versuchen, um parallele Änderungen nicht zu verlieren.

**Vor dem ersten Zugriff** den letzten gewünschten Datenstand aus dem bisherigen GitHub-Pfad bzw. -Branch sichern und in die Seed-Dateien des Deploys übernehmen. Zum Umschalten alte Schreibzugriffe pausieren, damit zwischen Export und Seed keine Daten verloren gehen. Der Seed importiert keine Remote-Dateien und überschreibt keine vorhandenen Keys. Spätere Änderungen an den Seed-Dateien wirken erst bei einem noch nicht vorhandenen Key. Ein Rollback des Codes synchronisiert Blob-Schreibvorgänge nicht zurück nach Git.

`npx netlify-cli dev` stellt einen lokalen Blob-Server bereit. Die Daten liegen unter `.netlify/` im Workspace, je nach CLI-Version unter `.netlify/blobs/` bzw. bei aktueller CLI unter `.netlify/blobs-serve/`. Sie werden weder nach einem Branch-Wechsel automatisch getrennt noch mit der Cloud synchronisiert. Für einen lokalen Reset den Dev-Server stoppen, Testdaten bei Bedarf sichern und nur das tatsächlich verwendete lokale Blob-Verzeichnis entfernen. Keine Cloud-Keys für einen lokalen Reset löschen.

## Qualitätssicherung und manuelle Abnahme

```bash
npx vitest run tests/documentation.test.ts
npx vitest run tests/blob-store.test.ts tests/integration/contributions.test.ts tests/module-builder.test.mjs
npm run preflight
```

- [ ] Den letzten GitHub-Datenstand sichern, mit dem geplanten Seed vergleichen und den Cloud-Store vor dem ersten Zugriff auf vorhandene Keys prüfen.
- [ ] Den Branch im Dashboard freigeben und die alten Variablen nach erfolgreichem Wechsel bereinigen.
- [ ] Lokal unter Netlify CLI beide APIs aufrufen: Seed-Daten einschließlich Quiz-Grenzen prüfen, Testdaten speichern und nach Neustart erneut abrufen. Die Seed-Dateien dürfen dabei unverändert bleiben.
- [ ] Mit reinem `npm run dev` prüfen, dass die Modul-API weiterhin `data/modules.json` als lokalen Fallback nutzt.
- [ ] Auf einer isolierten Netlify-Site einen Deploy prüfen: Beiträge, Module und Aufgaben anlegen, ändern und löschen; Quiz-Einstellungen speichern. Anschließend die Persistenz über einen weiteren Deploy bestätigen.
- [ ] Dokumentationscheck und vollständiges Preflight bestehen; produktiven Rollout erst nach der Datenabnahme freigeben.
