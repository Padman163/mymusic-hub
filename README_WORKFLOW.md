# Mein Entwicklungsworkflow

`main` ist der Hauptbranch und wird nur selten deployed. Neue Features entstehen auf `feat/<featurename>`; abgeschlossene Features werden unter `archive/feat/<featurename>` gesichert.

## 1. Workspace vorbereiten

Im neuen Workspace das Repository einrichten und den benötigten Branch auschecken: [Workspace-Setup](README_WORKSPACE_SETUP.md). Alltagsbefehle stehen im [Cheatsheet](README_CHEATSHEET.md).

Vor einem Workspace-Wechsel Änderungen prüfen, committen und den aktuellen Branch pushen. Nicht eingecheckte Daten separat und sicher übertragen.

Nach Paket- oder Netlify-Änderungen den Workspace erneut synchronisieren:

1. Sind in `package.json` neue Pakete ergänzt oder wurden Abhängigkeiten geändert, anschließend erneut `npm install` ausführen und `package-lock.json` mit committen.
2. Nach neuen Netlify-Einstellungen oder Änderungen an der Site-Verknüpfung erneut bei Netlify anmelden und die Verknüpfung prüfen:

```bash
npx netlify-cli login
npx netlify-cli status
```

Die Netlify CLI bezieht die benötigten Informationen aus der Anmeldung und der
Site-Verknüpfung. Für Blob-Tokens ist keine `.env` erforderlich; für Netlify
Identity und den optionalen Online-Daten-Modus legt `npm run env:netlify` jedoch
die lokale, nicht versionierte `.env.local` mit `LOCAL_NETLIFY_IDENTITY_ORIGIN`
und `LOCAL_NETLIFY_ONLINE_DATA=true` an (Details: [Workspace-Setup](README_WORKSPACE_SETUP.md)).

3. Danach einen laufenden `npx netlify-cli dev`-Prozess vollständig stoppen und mit der aktualisierten Umgebung neu starten.

Bei Modul-Builder, Beiträgen und anderen Netlify-Functions ausschließlich `http://localhost:8888` öffnen. Port `4321` ist der von der Netlify CLI intern gestartete reine Astro-Server; dort fehlen die Backend-Routen und Browserfehler mit HTML-Antworten sind dann erwartbar. Eine `404 text/html` von `/api/modules` oder `/api/contributions` bedeutet daher zuerst: richtige URL und richtigen Server prüfen.

Die Blob-Transferbefehle verwenden die Anmeldung aus `npx netlify-cli login`
und benötigen weder `NETLIFY_AUTH_TOKEN` noch die früheren `GITHUB_*`-Werte in
einer lokalen `.env`.

## 2. Feature entwickeln

Vom aktuellen `main` einen neuen Feature-Branch erstellen:

```bash
git switch main
git pull origin main
git switch -c feat/<featurename>
```

Auf diesem Branch entwickeln und Änderungen regelmäßig committen und pushen. Soll ein neues Feature auf einem noch nicht in `main` übernommenen Feature aufbauen, bewusst von dessen Archiv-Branch abzweigen statt von `main`.

Beiträge und Lernmodule verwenden bereits Netlify Blobs (`mymusic-hub-data`); persönliche Lernstände liegen nach Anmeldung getrennt im Store `mymusic-hub-user-data`. Lokal und online gelten jedoch unterschiedliche Speicher- und Zugriffsregeln:

- Ohne `LOCAL_NETLIFY_ONLINE_DATA=true` liest und schreibt `npx netlify-cli dev` für gemeinsame Daten einen eigenen dauerhaften Store unter `.netlify/`, derzeit `.netlify\blobs-serve\`.
- Ein leerer lokaler Store wird aus `data\blob-snapshot\contributions.json` und `data\blob-snapshot\modules.json` initialisiert.
- Schon vorhandene lokale Blob-Keys haben Vorrang. Ein Git-Branch-Wechsel lädt deshalb keine neueren Snapshot-Daten in diesen Store.
- Lokale Schreibvorgänge über die Functions aktualisieren zusätzlich die versionierten Snapshots, ändern aber noch nicht die Cloud.
- Mit `LOCAL_NETLIFY_ONLINE_DATA=true` in `.env.local` leiten lokale Daten-APIs stattdessen direkt an die konfigurierte Online-Site weiter und spiegeln erfolgreiche Schreibzugriffe lokal nach `data\blob-snapshot\` (und bei Modulen in die lesbaren MDX-Kopien).
- Schreibzugriffe auf gemeinsame Beiträge und Module erfordern serverseitig die Netlify-Identity-Rolle `admin` und einen passenden Origin — auch in Deploy Previews (Details: [Authentifizierungs-Referenz](features/README_FEAT_AUTHENTICATION.md)).
- `npm run blobs:push` erstellt vorher ein Cloud-Backup und lädt danach beide lokalen Snapshots in den siteweiten Store.
- Branch Deploys und Deploy Previews teilen den Cloud-Store mit Production, überschreiben ihn aber nicht mehr aus ihrem Build.
- Der im Repository konfigurierte Build importiert keine Snapshots. Der Online-Store bleibt beim Deploy maßgeblich; ein gegebenenfalls separat konfigurierter Snapshot-Import in Netlify muss dafür deaktiviert sein.
- Admins können auf dem veröffentlichten Produktions-Deploy und in Deploy Previews Sicherungen im Store `mymusic-hub-backups` anlegen und den gemeinsamen Online-Stand nach Vorschau wiederherstellen (siehe [Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md#online-backups-im-admin-bereich)).

Wenn der lokale Stand nach einem Branch-Wechsel hinter dem versionierten Snapshot zurückbleibt, Netlify Dev zuerst stoppen und den benannten Reset-Befehl verwenden:

```bash
npm run blobs:reset
npx netlify-cli dev
```

Das entfernt ausschließlich `.netlify/blobs-serve`. Vorher nicht als Snapshot
gesicherte lokale Änderungen erhalten. Für eine frische lokale Kopie des
aktuellen Online-Stands:

```bash
npm run blobs:pull
npm run blobs:reset
npx netlify-cli dev
```

Nach lokalen Änderungen die Snapshot-Diff prüfen und ausdrücklich hochladen:

```bash
git diff -- data/blob-snapshot
npm run blobs:push
```

Der Push erstellt vor dem überschreibenden Zugriff ein Archiv beider Cloud-Blobs.
Token-Regeln und Deploy-Verhalten stehen in der
[Blob-Referenz](features/README_FEAT_NETLIFYBLOB.md).

## 3. Automatisch testen

Keine Tests automatisch nach einzelnen Änderungen ausführen. Copilot fragt nach jeweils zehn Nutzer-Prompts im laufenden Chat, ob passende Unit- und Komponententests (Stufen 1 und 2) ausgeführt werden sollen. Erst nach Zustimmung oder ausdrücklichem Testauftrag testen. Kein Preflight für Zwischenschritte, Zwischen-Commits oder Zwischen-Pushes. Details und Befehle: [Testing](README_TESTING.md).

Bei Bedarf kann Biome sichere Formatierungs- und Lint-Korrekturen direkt anwenden:

```bash
npm run fix
```

Die anschließende Validierung mit Biome, Astro und TypeScript läuft als Stufe 0 ausschließlich im manuell vom Nutzer gestarteten `npm run preflight`; `npm run validate` nicht separat starten. Der Preflight ersetzt weder die gezielten Tests während der Entwicklung noch das separate manuelle `npm run audit`.

## 4. Cleanup und Abschlussprüfung

Die fünf Schritte der [Cleanup-Anleitung](README_CLEANUP.md) durchgehen. Löschungen und Migrationen erst nach Prüfung und Freigabe durchführen. Stufen 0, 3 und 4 laufen erst am fertigen Branch im manuell vom Nutzer gestarteten `npm run preflight`. Er umfasst auch die vollständigen Unit- und Komponententests sowie Lighthouse; `npm run audit` führt der Nutzer separat aus. Copilot startet diese Abschlussprüfung nicht. Anschließend den endgültigen Stand committen.


## 5. Dokumentations-, Wiki- und Featureprüfung

### Zentraler Dokumentations-Prompt

Kopiere den folgenden Prompt direkt in Copilot (gilt sowohl für den Feature-Abschluss als auch für die vollständige README- und Wiki-Pflege beim Cleanup):

> Prüfe alle gepflegten Dokumentationen im Repository fachlich gegen den aktuellen Code- und Branchstand, fasse Informationen logisch zusammen, ergänze fehlende Feature-Dokumentation und aktualisiere die Anleitungen und Wikis unter **Sonstiges**:
>
> 1. **Kontext und Quelle der Wahrheit ermitteln:** Lies `git branch --show-current`, `git status --short` sowie – sofern ein `feat/`-Branch aktiv ist – die Commits und Änderungen seit dem tatsächlichen Basis-Branch (jüngster passender `archive/feat/*`-Vorläufer oder `main`, falls direkt von `main` abgezweigt wurde). Nutze den aktuellen Code (`src/`, `netlify/functions/`, `scripts/`, `tests/`, `package.json`, `astro.config.mjs`, `netlify.toml`, `vitest.config.ts`, `playwright.config.ts`) als Quelle der Wahrheit; ältere READMEs und Handoffs sind keine Belege für den Ist-Stand. Starte keine Tests, `npm run cleanup:check`, `npm run preflight` oder einzelne Preflight-Stufen automatisch und behaupte keine ungeprüften Ergebnisse; Tests laufen nur nach ausdrücklichem Testauftrag oder nach der vorgesehenen Rückfrage und Zustimmung, und den Preflight startet ausschließlich der Nutzer manuell am Branch-Ende.
> 2. **Alle READMEs prüfen und logisch konsolidieren:** Erfasse alle gepflegten README-Dateien im Repository – einschließlich aller Root-Leitfäden (`README*.md`), `.github/copilot-instructions.md`, `features/README_FEAT.md`, aller `features/README_FEAT_*.md`, `module-archives/README.md` sowie Asset-READMEs (z. B. `public/sounds/drums/README.md`). Ignoriere generierte Kopien unter `dist/` und Dateien in `node_modules/`. Vergleiche Aussagen zu Architektur, Navigation, Datenfluss, Speicherorten, Funktionen, Voraussetzungen, Props/Konfiguration, Befehlen, Randfällen, Testumfang und Links mit den tatsächlichen Quellen. Halte die Single Source of Truth ein: Bündele verstreute oder doppelte Angaben logisch in der fachlich führenden Datei und verlinke aus anderen Dokumenten dorthin, statt Inhalte mehrfach zu pflegen. Unterscheide sauber zwischen gemeinsamem siteweitem Store (`mymusic-hub-data`), Online-Backups (`mymusic-hub-backups`), kontogebundenem Lernstand (`mymusic-hub-user-data`), Browser-Cache, lokalem Store (`.netlify/blobs-serve/`) und Online-Proxy (`LOCAL_NETLIFY_ONLINE_DATA=true`) sowie zwischen UI-Navigation und serverseitigem `admin`-Rollen-/Origin-Schutz je Deploy-Kontext (Production, Deploy Preview, Branch Deploy, Lokal). Behaupte keine Bearbeitungsoberfläche oder Funktion, die der aktuelle Code nicht anbietet. Prüfe `module-archives/README.md` gegen `module-archives/index.json`; regeneriere Archive nicht manuell und lösche oder ersetze keine bestehenden Archivseiten oder Live-Inhalte.
> 3. **Fehlende Features ergänzen oder einpflegen:** Gleiche die tatsächlich implementierten Funktionen und Subsysteme (`src/components/`, `src/lib/`, `src/pages/`, `netlify/functions/`, `scripts/`, `astro.config.mjs`) mit den vorhandenen Dokumenten ab. Fehlt die Dokumentation zu einem implementierten Feature oder Teilbereich, pflege sie logisch in die fachlich passende bestehende `features/README_FEAT_*.md` bzw. den passenden Leitfaden ein – oder lege für ein eigenständiges Feature ohne passende Referenz eine neue `features/README_FEAT_<NAME>.md` mit einer `#`-Hauptüberschrift für das Admin-Wiki an und verlinke sie in `features/README_FEAT.md` sowie bei neuen Haupt-Leitfäden in `README.md`. Beschreibe ausschließlich verifizierte Implementierung: Zweck, Einbindung, Architektur und Dateien, Verhalten, Props/Konfiguration, Randfälle, Persistenz-/Rollenmodell und passende Tests. Erstelle keine manuelle Abnahmeliste in Feature-Referenzen und keine zusätzlichen Audit- oder Planungsdateien. Archiviere oder lösche Handoffs nicht ohne Freigabe.
> 4. **Anleitungen, Wikis und Referenzseiten unter „Sonstiges“ anpassen:** Prüfe alle Nutzer-Anleitungen unter `src/content/docs/wiki/` sowie die Erklär- und Referenzseiten unter `src/content/docs/audio/referenzen-werkzeuge/` gegen den aktuellen Code und die aktualisierten READMEs und korrigiere veraltete oder widersprüchliche Angaben. Erstelle oder aktualisiere für nutzerseitig bedienbare Features eine verständliche Anleitung im Wiki unter `src/content/docs/wiki/` (Was können Nutzer tun und wie bedienen sie es?; technische Details gehören in die Feature-Referenz). Halte die Navigation unter **Sonstiges** in `astro.config.mjs`, die Verlinkung bei der zugehörigen Oberfläche (`src/content/docs/` und `src/pages/`) sowie die Verweise in `README.md` und `features/README_FEAT.md` konsistent. Ändere didaktische Lehrgangs- und Songwriting-Seiten (`audio/theory/100-*` bis `500-*`, `audio/songwriting/`) nur bei fehlerhaften Bedienhinweisen, defekten Links oder veralteten Komponentenangaben, nicht aber inhaltlich ohne Auftrag.
> 5. **IssueTracker-Entwurf für die Admin-UI (nur bei aktivem `feat/`-Branch):** Ist ein `feat/`-Branch aktiv und ergibt sich daraus ein klares Hauptfeature (mit zugehörigen Teilbereichen), leite nach der Dokumentationsanpassung den Feature-Beitrag aus der aktualisierten Feature-Referenz ab; auf anderen Branches oder bei unklarer Zuordnung überspringe diesen Schritt und melde das knapp. Prüfe für den Vertrag bei Bedarf `features/README_FEAT_CONTRIBUTIONS.md`, `src/components/IssueTrackerForm.astro`, `src/components/ContributionList.astro`, `src/lib/contribution-*.ts` sowie `netlify/functions/contributions.ts`. Suche vorab nach einem bestehenden Beitrag (bei laufendem lokalem Netlify Dev lesend per `GET http://localhost:8888/api/contributions`; ohne laufenden Server `data/blob-snapshot/contributions.json` nur als unverbindlichen Hinweis nutzen und Online-Prüfung vor Übernahme vermerken). Verwende gültige Werte: Typ `Feature`, Bereich (`Theorie`, `Praxis` oder `Komponente`; Pflichtfeld), Priorität bei Unklarheit `Mittel`, Status bei neuem Beitrag `New` (bei bestehenden Beiträgen vorhandenen `status`, `area`, gesetzte Häkchen, manuelle Checklistenpunkte und Notizen in der Beschreibung erhalten). Prüfe alle Grenzen vor der Ausgabe: Titel 1–120 Zeichen nach Bereinigung, Beschreibung max. 10.000 Zeichen mit Verweis auf Feature-Referenz (und ggf. Admin-Wiki-/Wiki-Route), max. 100 Checklistenpunkte je 1–200 Zeichen nach Bereinigung, gesamte Nutzlast max. 500.000 Bytes; bekannte Prüfstände übernehmen, keine erfolgreichen Prüfungen erfinden. Führe standardmäßig keinen Schreibzugriff auf `/api/contributions` aus und schreibe niemals direkt in `data/blob-snapshot/contributions.json` oder `.netlify/blobs-serve/` (Admin-Auth + `Origin`-Schutz; `http://localhost:8888` leitet bei `LOCAL_NETLIFY_ONLINE_DATA=true` in den gemeinsamen Online-Store weiter), sondern gib den übernahmefähigen Entwurf für **Admin → Beiträge** (`/projektierung/beitraege/`) aus, klar gekennzeichnet als **Neuer Beitrag** oder **Ergänzung zu bestehendem Beitrag** (Titel/ID + Änderungen). Nur auf ausdrücklichen Schreibauftrag, nach geprüfter Zielumgebung und mit gültiger Admin-Sitzung darf über die API geschrieben werden (`POST` neu, `PATCH` mit `expected` + `fields` bestehend; bei `401`/`403`/`404`/`409` oder unklarer Zielumgebung sofort stoppen, keine Zugangsdaten anfordern und beim Entwurf bleiben; Snapshot-Aktualisierung im Worktree beachten).
> 6. **Qualität, Hygiene und knappe Ausgabe:** Schreibe keine vollständigen bestehenden Dokumente ohne Grund neu. Verwende keine Quellenmarker, HTML-Zitat-Tags oder Fußnoten-Zitate und übernimm keine Zugangsdaten, Tokens, `.env.local`-Inhalte oder echte personenbezogene Testdaten. Prüfe geänderte Aussagen, relative Links, `#`-Anker, `#`-Hauptüberschriften fürs Admin-Wiki und dokumentierte `npm run`-Skriptnamen anhand der Dateien und `package.json`, ohne unausgeführte Tests zu behaupten. Gib bei bestehenden Markdown-/MDX-Dateien im Chat nur geänderte Abschnitte oder einen knappen Diff aus. Berichte knapp, welche Dateien geändert oder neu angelegt wurden, welche geprüft und unverändert blieben, welche offenen Punkte eine Entscheidung benötigen und welche Tests nicht gelaufen sind – gefolgt vom geprüften IssueTracker-Entwurf für die Admin-UI (falls ein `feat/`-Branch aktiv ist).

## 6. Feature archivieren und neues beginnen

Auf dem fertigen Feature-Branch:

```bash
git branch -m archive/feat/<featurename>
git push -u origin archive/feat/<featurename>
git push origin --delete feat/<featurename>
```

Den Archiv-Branch auf GitHub prüfen. Ein bereits gepushter `feat/`-Branch bleibt dort bestehen; eine spätere Löschung ist eine separate Entscheidung.

Vor dem Archivieren eines Features prüfen, ob neue Snapshots unter `data/blob-snapshot/` entstehen und vollständig im Branch enthalten sind. Vor einem späteren Deploy Branch-Freigabe, Netlify-Umgebungsvariablen und Cloud-Datenbackup getrennt prüfen. Das Archivieren des Codes sichert keine Daten in Netlify Blobs.

Archivieren übernimmt **keine** Änderungen nach `main`. Eine Übernahme per Pull Request und ein Deployment werden später separat entschieden. Danach mit Schritt 2 das nächste Feature beginnen.
