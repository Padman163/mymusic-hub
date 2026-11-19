# Netlify Blobs: Persistenz für Beiträge und Lernmodule

Netlify Blobs (`@netlify/blobs`) ersetzt die GitHub REST API als Datenspeicher. Schreibzugriffe erzeugen keine Git-Commits und lösen damit keine Builds aus. Der JSON-Store `mymusic-hub-data` ist vom geplanten Store `mymusic-hub-media` für Audio und Bilder getrennt; Medien werden noch nicht gespeichert.

## Setup und Branch-Wechsel

Die Abhängigkeit wurde mit `npm install @netlify/blobs` hinzugefügt. In einem frischen Workspace genügt die normale Installation über das Lockfile.

1. Stelle sicher, dass der Deploy-Branch den Netlify-Blobs-Code und die
Transfer-Skripte enthält.
2. Im Netlify Dashboard unter **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts** den Branch für Branch Deploys/Deploy Previews freigeben oder bewusst als Production Branch setzen.
3. Unter **Environment variables** die alten `GITHUB_*`-Variablen für die Datenspeicherung nach dem Wechsel entfernen, sofern sie nicht von anderen Verbrauchern benötigt werden. Für noch aktive alte Deploys oder einen geplanten Rollback erst deren Abhängigkeiten klären. Netlify stellt den Blob-Kontext für die Functions bereit.

**Wichtig:** [`getStore`](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore) ist **siteweit**. Production, Branch Deploys und Previews derselben Site verwenden dieselben Daten und können sie ändern. Für isolierte Online-Abnahmen eine separate Netlify-Site verwenden; Branch-Freigabe und Deploy-Kontext allein isolieren den Store nicht. `getDeployStore` wäre dagegen deployspezifisch und wird hier bewusst nicht verwendet.

## Empfohlener Datenfluss

Die Cloud-Datenbank und der lokale Netlify-Dev-Store sind getrennte Speicher:

```text
Netlify Cloud: mymusic-hub-data
       ↓ npm run blobs:pull
data/blob-snapshot/{contributions,modules}.json
       ↓ npm run blobs:reset
.netlify/blobs-serve
       ↓ npx netlify-cli dev
lokales Erstellen und Bearbeiten
       ↓ automatische Snapshot-Aktualisierung
data/blob-snapshot/{contributions,modules}.json
       ↓ npm run blobs:push
Cloud-Backup unter data/blob-archive/<Zeitstempel>/
       ↓
Netlify Cloud: mymusic-hub-data
```

`npx netlify-cli dev` initialisiert fehlende lokale Keys aus den versionierten
Snapshots. Vorhandene lokale Keys bleiben bestehen. Schreibvorgänge über die
Functions aktualisieren die Snapshot-Dateien, aber nicht automatisch die Cloud.

Vor der Arbeit am neuesten Online-Stand:

```bash
npx netlify-cli link
npm run blobs:pull
npm run blobs:reset
npx netlify-cli dev
```

`blobs:reset` fragt vor dem Entfernen des lokalen Blob-Stands unter
`.netlify/blobs-serve` nach Bestätigung. Zuerst Netlify Dev stoppen und nicht
gespeicherte lokale Änderungen sichern. Beim nächsten Start werden die beiden
Keys aus den Snapshots neu angelegt.

Nach lokalen Änderungen:

```bash
git diff -- data/blob-snapshot
npm run blobs:push
```

`blobs:push` lädt beide Cloud-Blobs, erstellt daraus automatisch ein gemeinsames
Archiv unter `data/blob-archive/<Zeitstempel>/`, fragt nach Bestätigung und
schreibt anschließend beide lokalen Snapshots in die Cloud. Ohne die interaktive
Bestätigung wird nichts hochgeladen. `npm run blobs:push -- --yes` ist nur für
bewusst automatisierte Abläufe gedacht.

Für eine separate Sicherung ohne Upload:

```bash
npm run blobs:backup
```

Die Transferbefehle verwenden die normale Netlify-CLI-Anmeldung. Führe einmal
`npx netlify-cli login` und `npx netlify-cli link` aus. Eine lokale `.env` und
ein Token im Repository werden dafür nicht benötigt.

## Deploy Preview und Branch Deploy

Production, Deploy Previews und Branch Deploys lesen dieselbe siteweite
Cloud-Datenbank. Ihre laufenden Functions dürfen diese Daten jedoch nicht direkt
überschreiben. Schreibende Requests erhalten in gehosteten Kontexten
`405 Method Not Allowed`. So kann nur der kontrollierte lokale Snapshot-Transfer
Cloud-Daten ändern.
Netlify-Builds schreiben keine Blob-Daten. `netlify.toml` führt ausschließlich
den Astro-Build aus; Cloud-Änderungen erfolgen nur über `npm run blobs:push`.

Vor dem Öffnen einer Preview wird der aktuelle lokale Stand mit `blobs:push`
hochgeladen. Dadurch ist er in Production und jeder Vorschau sofort sichtbar.
Die Befehle nutzen die normale Netlify-CLI-Anmeldung und benötigen keine lokale
`.env` und keinen Token im Repository.

**Überschreibungswirkung:** Kein Deploy importiert Daten. Dadurch kann ein alter
Branch den Cloud-Stand nicht durch seinen Build zurücksetzen. Vor einem
Cloud-Upload den vorgeschlagenen Backup-/Bestätigungsablauf von `blobs:push`
abschließen.

## Architektur und Datenfluss

| Datei | Verantwortung |
| --- | --- |
| [`blob-store.ts`](../netlify/functions/lib/blob-store.ts) | Kapselt Store-Namen, typisierte JSON-Keys, Initialisierung und konfliktgeschützte Schreibzugriffe. |
| [`contribution-store.ts`](../netlify/functions/lib/contribution-store.ts) | Fachliche Änderungen am Key `contributions` und Abgleich mit dem erwarteten Beitragsstand. |
| [`contributions.ts`](../netlify/functions/contributions.ts) | HTTP-API und Validierung für Beiträge. |
| [`modules.ts`](../netlify/functions/modules.ts) | HTTP-API für den Key `modules` (Module, Aufgaben und Quiz-Einstellungen); Fachregeln bleiben in [`module-store.ts`](../src/lib/module-store.ts). |
| [`local-blob-snapshot.ts`](../netlify/functions/lib/local-blob-snapshot.ts) | Spiegelt lokale Netlify-Dev-Schreibvorgänge in versionierte Snapshot-Dateien. |
| [`netlify-blob-transfer.ts`](../scripts/netlify-blob-transfer.ts) | Lädt Cloud-Daten, erstellt Archive, bestätigt Uploads und setzt den lokalen Blob-Store zurück. |
| [`astro.config.mjs`](../astro.config.mjs) | Nur beim reinen Astro-Start liest und schreibt `localModulesApiPlugin()` direkt in `data/modules.json`. Unter Netlify CLI ist dieses Plugin deaktiviert. |

Die Functions lesen mit starker Konsistenz. Fehlt `contributions`, wird `[]` gespeichert. Fehlt `modules`, startet der Katalog mit `{ modules: [], questions: [] }`. Bis Quiz-Einstellungen gespeichert werden, gelten die Schema-Standardwerte. `onlyIfNew` verhindert, dass ein paralleler Erstzugriff vorhandene Daten überschreibt. Spätere Änderungen nutzen ETags (`onlyIfMatch`) mit bis zu drei Versuchen, um parallele Änderungen nicht zu verlieren.

Cloud-Daten vor einem Upload oder größeren Umbau mit `npm run blobs:backup`
sichern. Ein neuer Store übernimmt keine Daten aus anderen Stores oder Git. Ein
Rollback des Codes synchronisiert Blob-Schreibvorgänge nicht zurück nach Git.

`npx netlify-cli dev` stellt einen lokalen Blob-Server bereit. Die Daten liegen
unter `.netlify/blobs-serve/`. Der lokale Store wird nur durch die dokumentierten
Transferbefehle mit der Cloud abgeglichen. Ein leerer lokaler Store wird aus den
Snapshot-Dateien wiederhergestellt. **`.netlify/blobs-serve` nicht als
allgemeinen Build-Cache behandeln oder löschen**, solange lokale Änderungen
nicht als Snapshot oder Cloud-Backup gesichert sind.

Vor dem produktiven Umstieg den Cloud-Datenbestand sichern und die Datenübernahme sowie Rollback-Abhängigkeiten prüfen. Schreibtests in der Cloud nur auf einer isolierten Netlify-Site durchführen.

## Qualitätssicherung

```bash
npx vitest run tests/documentation.test.ts
```

Die Integrationstests laufen erst am Branch-Abschluss im manuell vom Nutzer gestarteten Preflight (siehe [Testing-Leitfaden](../README_TESTING.md)):

```bash
npm run preflight
```
