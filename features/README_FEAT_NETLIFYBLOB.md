# Netlify Blobs: Persistenz für Beiträge und Lernmodule

Netlify Blobs (`@netlify/blobs`) ersetzt die GitHub REST API als Datenspeicher. Schreibzugriffe erzeugen keine Git-Commits und lösen damit keine Builds aus. Der JSON-Store `mymusic-hub-data` ist vom geplanten Store `mymusic-hub-media` für Audio und Bilder getrennt; Medien werden noch nicht gespeichert.

## Setup und Branch-Wechsel

Die Abhängigkeit wurde mit `npm install @netlify/blobs` hinzugefügt. In einem frischen Workspace genügt die normale Installation über das Lockfile.

1. `feat/netlify-blobs` auschecken. Solange der alte GitHub-Backendstand noch läuft, in der lokalen `.env` vorübergehend `GITHUB_BRANCH=feat/netlify-blobs` setzen, wenn dies der gewünschte Quelldatenstand ist. Nach der Umstellung diese Einstellung entfernen oder auskommentieren: Sie wählt **keinen** Blob-Store.
2. Im Netlify Dashboard unter **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** den Branch für Branch Deploys/Deploy Previews freigeben oder bewusst als Production Branch setzen.
3. Unter **Environment variables** die alten `GITHUB_*`-Variablen für die Datenspeicherung nach dem Wechsel entfernen, sofern sie nicht von anderen Verbrauchern benötigt werden. Für noch aktive alte Deploys oder einen geplanten Rollback erst deren Abhängigkeiten klären. Netlify stellt den Blob-Kontext für die Functions bereit.

**Wichtig:** [`getStore`](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore) ist **siteweit**. Production, Branch Deploys und Previews derselben Site verwenden dieselben Daten und können sie ändern. Für isolierte Online-Abnahmen eine separate Netlify-Site verwenden; Branch-Freigabe und Deploy-Kontext allein isolieren den Store nicht. `getDeployStore` wäre dagegen deployspezifisch und wird hier bewusst nicht verwendet.

## Architektur und Datenfluss

| Datei | Verantwortung |
| --- | --- |
| [`blob-store.ts`](../netlify/functions/lib/blob-store.ts) | Kapselt Store-Namen, typisierte JSON-Keys, Initialisierung und konfliktgeschützte Schreibzugriffe. |
| [`contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) | Fachliche Änderungen am Key `contributions` und Abgleich mit dem erwarteten Beitragsstand. |
| [`contributions.ts`](../netlify/functions/contributions.ts) | HTTP-API und Validierung für Beiträge. |
| [`modules.ts`](../netlify/functions/modules.ts) | HTTP-API für den Key `modules` (Module, Aufgaben und Quiz-Einstellungen); Fachregeln bleiben in [`module-store.ts`](../src/lib/module-store.ts). |
| [`astro.config.mjs`](../astro.config.mjs) | Nur beim reinen Astro-Start liest und schreibt `localModulesApiPlugin()` direkt in `data/modules.json`. Unter Netlify CLI ist dieses Plugin deaktiviert. |

Die Functions lesen mit starker Konsistenz. Fehlt `contributions`, wird `[]` gespeichert. Fehlt `modules`, startet der Katalog mit `{ modules: [], questions: [] }`. Bis Quiz-Einstellungen gespeichert werden, gelten die Schema-Standardwerte. `onlyIfNew` verhindert, dass ein paralleler Erstzugriff vorhandene Daten überschreibt. Spätere Änderungen nutzen ETags (`onlyIfMatch`) mit bis zu drei Versuchen, um parallele Änderungen nicht zu verlieren.

Cloud-Daten bei Bedarf direkt aus Netlify Blobs sichern. Ein neuer Store übernimmt keine Daten aus anderen Stores oder Git. Ein Rollback des Codes synchronisiert Blob-Schreibvorgänge nicht zurück nach Git.

`npx netlify-cli dev` stellt einen lokalen Blob-Server bereit. Die Daten liegen unter `.netlify/` im Workspace, je nach CLI-Version unter `.netlify/blobs/` bzw. bei aktueller CLI unter `.netlify/blobs-serve/`. Sie werden weder nach einem Branch-Wechsel automatisch getrennt noch mit der Cloud synchronisiert. Für einen lokalen Reset den Dev-Server stoppen, Testdaten bei Bedarf sichern und nur das tatsächlich verwendete lokale Blob-Verzeichnis entfernen. Keine Cloud-Keys für einen lokalen Reset löschen.

Vor dem produktiven Umstieg den Cloud-Datenbestand sichern und die Datenübernahme sowie Rollback-Abhängigkeiten prüfen. Schreibtests in der Cloud nur auf einer isolierten Netlify-Site durchführen.

## Qualitätssicherung

```bash
npx vitest run tests/documentation.test.ts
```

Integrationstests und Preflight erst am Branch-Abschluss ausführen (siehe [Testing-Leitfaden](../README_TESTING.md)):

```bash
npx vitest run tests/blob-store.test.ts tests/integration/contributions.test.ts tests/module-builder.test.mjs
npm run preflight
```
